require("dotenv").config();
import Promise = require("bluebird");
import _ = require("lodash");

let connect;
const schemaValidator = new (require("./schemaValidation.js"))(connect);

interface Definition{
	description:string;
	type:string;
	isIndex?:boolean;
	isAutoIncrement?:boolean;
	isUnique?:boolean;
}

interface SchemaDefinitions{
	[key:string]:Definition
}

interface IndexOptions{
	name:string;
	autoIncrement?:boolean;
	unique?:boolean;
}

interface TableSchema{
	$schema:string;
	$id:string;
	title:string;
	description:string
	type:string;
	properties:SchemaDefinitions
	required?:Array<Definition>
}

// Let's get mongodb working first
/**
 * Create an new DynamicSchema instance
 *
 * @name DynamicSchema
 * @class
 */
class Schema{
	tableName:string;

	tableSlug:string;

	definition:SchemaDefinitions;

	constructor(){
		/**
		 * The name of the table.
		 *
		 * @name tableName
		 * @type string
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.tableName = null;

		/**
		 * The slug of the table.
		 *
		 * @name tableSlug
		 * @type string
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.tableSlug = null;

		/**
		 * The table's column definitions.
		 *
		 * @name definition
		 * @type object
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.definition = {};

		// Async setup, should be moved to a one time setup script
		// connect.then((db) => {
		// 	return db.collection("_schema").indexExists("_$id").then((result) => {
		// 		if(!result){
		// 			return Promise.resolve(db);
		// 		}
		// 	});
		// }).then((db) => {
		// 	return db.collection("_schema").createIndex("_$id", {
		// 		unique: true
		// 	});
		// });
	}

	/**
	 * Create a new table with the given schema. Schema must adhere to the
	 * JSON Schema definition set out in
	 * [https://json-schema.org/](https://json-schema.org/)
	 *
	 * Each property corresponds to each column in the database. A few
	 * custom attributes to each property can be included for use by
	 * DynamicSchema to generate columns for special behaviour.
	 *
	 * These properties are:
	 * - `isIndex`: Whether the column is an index field
	 * - `isUnique`: Whether the column is an unique field
	 * - `isAutoIncrement`: Whether the column is an auto-incrementing integer
	 *
	 * @method createTable
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} schema
	 * @param {string} schema.$id - ID of the table, must be unique
	 * @param {string} [schema.title] - Defaults to `schema.$id`
	 * @param {object} schema.properties - The column definitions of the table
	 * @return {Promise}
	 */
	createTable(schema:TableSchema){
		if(!schemaValidator.validate("rootSchema", schema)){
			return Promise.reject(schemaValidator.errors);
		}

		const tableSlug:string = schema.$id;
		const tableName:string = schema.title || schema.$id;
		const columns:SchemaDefinitions = schema.properties;

		return connect.then((db) => {
			const promises = [];

			// NOTE: Do we need to check for existence first?
			promises.push(db.createCollection(tableSlug).then((col) => {
				this.tableName = tableName;
				this.tableSlug = tableSlug;
				return Promise.resolve(db);
			}));

			promises.push(db.createCollection("_counters").then((col) => {
				return col.indexExists("_$id").then((result) => {
					if(result === false){
						return col.createIndex("_$id", {unique: true}).then(() => {
							return Promise.resolve();
						});
					}else{
						return Promise.resolve();
					}
				}).then(() => {
					return col.insertOne({
						_$id: tableSlug,
						sequences: {}
					}).then(() => {
						return Promise.resolve(db);
					});
				});
			}));

			const databaseInsert = {
				_$schema: schema.$schema,
				_$id: schema.$id,
				title: schema.title,
				description: schema.description,
				type: schema.type,
				properties: schema.properties,
				required: schema.required
			}
			promises.push(db.collection("_schema").insertOne(databaseInsert));

			this.definition = columns;
			promises.push(this._writeSchema());

			return Promise.all(promises);

		}).then(() => {
			// Handle index columns
			let promises = [];

			_.each(columns, (column, key) => {
				if(column.isIndex){
					promises.push(this.addIndex({
						name: key,
						unique: column.isUnique,
						autoIncrement: column.isAutoIncrement
					}));
				}
			});

			return Promise.all(promises);

		}).catch((err) => {
			this.tableName = null;
			this.tableSlug = null;
			throw Promise.reject(err);
		});
	}


	/**
	 * Drop the table from the database.
	 *
	 * @method dropTable
	 * @memberOf DynamicSchema
	 * @instance
	 * @return {Promise}
	 */
	dropTable(){
		return connect.then((db) => {
			return db.collection("_schema").deleteOne({"_$id": this.tableSlug}).then((result) => {
				return db.collection(this.tableSlug).drop();
			}).then(() => {
				return db.collection("_counters").deleteOne({"_$id": this.tableSlug});
			}).then(() => {
				this.tableName = null;
				this.tableSlug = null;
				this.definition = {};
				return Promise.resolve();
			});
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	/**
	 * Rename the table.
	 *
	 * @method renameTable
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} newSlug
	 * @param {string} [newName] Defaults to newSlug
	 * @return {Promise}
	 */
	renameTable(newSlug:string, newName:string){
		return connect.then((db) => {
			const promises = [];

			promises.push(db.collection("_schema").findOneAndUpdate({"_$id": this.tableSlug}, {
				$set: {
					"_$id": newSlug,
					"title": newName || newSlug
				}
			}));
			promises.push(db.collection("_counters").findOneAndUpdate({"_$id": this.tableSlug}, {
				$set: {
					"_$id": newSlug
				}
			}));
			promises.push(db.renameCollection(this.tableSlug, newSlug));

			return Promise.all(promises);
		}).then(() => {
			this.tableSlug = newSlug;
			this.tableName = newName || newSlug;
			return Promise.resolve();
		});
	}

	/**
	 * Add an index to the table's schema.
	 *
	 * @method addIndex
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} options
	 * @param {string} options.name - The name of the column to be used as index
	 * @param {boolean} [options.unique] - Whether the index is unique or not
	 * @param {boolean} [options.autoInrement] - Whether it is an
	 *                  auto-incrementing index or not. If true, `options.unique`
	 *                  is automatically set to true
	 * @return {Promise}
	 */
	addIndex(options:IndexOptions){
		const columnName:string = options.name;
		const isAutoIncrement:boolean = options.autoIncrement;
		let unique:boolean = options.unique;
		if(isAutoIncrement && unique === false){
			console.warn("Auto increment index must be unique, setting to unique.");
			unique = true;
		}

		if(typeof unique === "undefined"){
			unique = true;
		}

		return connect.then((db) => {
			return db.collection(this.tableSlug).createIndex(columnName, {unique: unique, name: columnName});
		}).then(() => {
			if(isAutoIncrement){
				return this._setCounter(this.tableSlug, columnName);
			}else{
				return Promise.resolve();
			}
		}).catch((err) => {
			throw err;
		});
	}

	renameIndex(columnName, newColumnName){
		// Maybe drop index then recreate but do consider why you need to do this
	}

	/**
	 * Remove an index to the table's schema
	 *
	 * @method removeIndex
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} columnName - The name of the index to remove
	 * @return {Promise}
	 */
	removeIndex(columnName:string){
		return connect.then((db) => {
			return db.collection(this.tableSlug).dropIndex(columnName)
				.then(() => {
					return Promise.resolve(db);
				});
		}).then((db) => {
			if(columnName === "_uid"){
				return db.collection("_counters").findOneAndDelete({
					_$id: this.tableSlug
				});
			}else{
				return Promise.resolve();
			}
		}).catch((err) => {
			throw err;
		});
	}

	/**
	 * Read the schema definition from the database.
	 *
	 * @method read
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} tableSlug - The name of the table schema to retrieve
	 * @return {Promise} - Return promise, resolves to this object instance
	 */
	read(tableSlug:string){
		return connect.then((db) => {
			return db.collection("_schema").findOne({_$id: tableSlug});
		}).then((data) => {
			if(data){
				this.tableName = data.title;
				this.tableSlug = data._$id;
				this.definition = data.properties;
			}else{
				this.tableName = "";
				this.tableSlug = "";
				this.definition = {};
			}

			return Promise.resolve(this);
		}).catch((err) => {
			throw err;
		});
	}

	/**
	 * Define the table's columns. Passed object must adhere to `properties`
	 * attribute of [JSON Schema](https://json-schema.org/)'s definition.
	 *
	 * @method define
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} definition - Definition of the table columns
	 * @return {Promise}
	 */
	define(def:SchemaDefinitions){
		const oldDef:SchemaDefinitions = this.definition;
		this.definition = def;

		// Create schema in RMDB, do nothing in NoSQL
		return connect.then((db) => {
			return db.collection("_schema").findOneAndUpdate({
				_$id: this.tableSlug,
			}, {
				$set:{
					properties: def
				}
			}, {
				upsert: true
			});
		}).catch((err) => {
			this.definition = oldDef;
			throw err;
		});
	}

	/**
	 * Add a single column to the table's schema definition.
	 *
	 * @method addColumn
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name - The name of the column to add
	 * @param {string} type - Type of the column to add
	 * @param {string} [description] - Description of the column to add
	 * @return {Promise}
	 */
	addColumn(name:string, type:string, description:string = ""){
		if(!this.definition[name]){
			this.definition[name] = {
				description: description,
				type: type
			}
		}else{
			// Column name already exist
			throw new Error("Column name already exist");
		}

		return this._writeSchema().catch((err) => {
			delete this.definition[name];
			throw err;
		});
	}

	/**
	 * Add multiple columns to the table's schema definition.
	 *
	 * @method addColumns
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} definitions - Object of objects containing new columns
	 *                               definitions
	 * @return {Promise}
	 */
	addColumns(def:SchemaDefinitions){
		const oldDefinition:SchemaDefinitions = _.cloneDeep(this.definition);
		this.definition = _.assign(this.definition, def);

		return this._writeSchema().catch((err) => {
			this.definition = _.cloneDeep(oldDefinition);
			throw err;
		});
	}

	/**
	 * Rename a single column in the table's schema definition.
	 *
	 * @method renameColumn
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name - The name of the column to rename
	 * @param {string} newName - The new name of the target column
	 * @return {Promise}
	 */
	renameColumn(name:string, newName:string){
		this.definition[newName] = _.cloneDeep(this.definition[name]);
		delete this.definition[name];

		return connect.then((db) => {
			return this._writeSchema().then(() => {
				return db.collection("_counters").findOne({"_$id": this.tableSlug});
			}).then((entry) => {
				if(entry){
					const sequences = _.cloneDeep(entry.sequences);
					sequences[newName] = sequences[name];
					delete sequences[name];
					return db.collection("_counters").findOneAndUpdate({"_$id": this.tableSlug},
						{
							$set: {
								sequences: sequences
							}
						}
					);
				}else{
					return Promise.resolve();
				}
			}).catch((err) => {
				this.definition[name] = _.cloneDeep(this.definition[newName]);
				delete this.definition[newName];
				throw err;
			});
		});
	}

	/**
	 * Change the type of a single column in the table's schema definition.
	 *
	 * @method changeColumnType
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name - The name of the column to change type
	 * @param {string} newType - The new type of the target column
	 * @return {Promise}
	 */
	changeColumnType(name:string, newType:string){
		const oldType:string = this.definition[name].type;
		this.definition[name].type = newType;

		return this._writeSchema().catch((err) => {
			this.definition[name].type = oldType;
			throw err;
		});
	}

	/**
	 * Remove a single column from the table's schema definition.
	 *
	 * @method removeColumn
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name - The name of the column to remove
	 * @return {Promise}
	 */
	removeColumn(name:string){
		const deleted:Definition = _.cloneDeep(this.definition[name]);
		delete this.definition[name];

		return this._writeSchema().catch((err) => {
			this.definition[name] = deleted;
			throw err;
		});
	}

	// Utils --------------------------------------------------------
	/**
	 * Update the new schema structure into the database
	 *
	 * @method _writeSchema
	 * @memberOf DynamicSchema
	 * @instance
	 * @private
	 * @return {Promise}
	 */
	private _writeSchema(){
		return connect.then((db) => {
			return db.collection("_schema").findOneAndUpdate({_$id: this.tableSlug}, {
				$set: {
					properties: this.definition
				}
			});
		});
	}

	/**
	 * Set an autoincrementing field to the _counters table (MongoDB only)
	 *
	 * @method _setCounter
	 * @memberOf DynamicSchema
	 * @instance
	 * @private
	 * @param {string} collection - The slug of the collection to set
	 * @param {string} columnLabel - The slug of the column set as an autoincrementing index
	 * @return {Promise}
	 */
	private _setCounter(collection:string, columnLabel:string){
		return connect.then((db) => {
			const sequenceKey = `sequences.${columnLabel}`;

			return db.collection("_counters").findOneAndUpdate({
				_$id: collection
			}, {
				$set: {
					[sequenceKey]: 0
				}
			});
		});
	}

	/**
	 * Increment an autoincrementing index (MongoDB only)
	 *
	 * @method _setCounter
	 * @memberOf DynamicSchema
	 * @instance
	 * @private
	 * @param {string} collection - The slug of the collection to target
	 * @param {string} columnLabel - The slug of the autoincrementing column
	 * to increment
	 * @return {Promise} - Promise of the next number in the sequence
	 */
	private _incrementCounter(collection:string, columnLabel:string){
		return connect.then((db) => {
			return db.collection("_counters").findOne({
				_$id: collection
			}).then((result) => {
				const newSequence = result.sequences[columnLabel] + 1;
				const sequenceKey = `sequences.${columnLabel}`;

				return db.collection("_counters").findOneAndUpdate({
					_$id: collection
				}, {
					$set: {
						[sequenceKey]: newSequence
					}
				}).then(() => {
					return Promise.resolve(newSequence);
				});
			});
		});
	}

	private _validate(){
		// Validate database schema with this.definition
		// Return boolean
	}
}

module.exports = function(connection){
	connect = connection;
	return Schema;
};