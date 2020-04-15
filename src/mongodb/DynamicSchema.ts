import * as _ from "lodash";
import {TableSchema, SchemaDefinitions, IndexOptions, DynamicSchema as Schema} from "../DynamicSchema";

let connect;
const schemaValidator = new (require("./schemaValidation.js"))(connect);

class DynamicSchema extends Schema{
	constructor(){
		super();
	}

	createTable(schemaInput:TableSchema){
		const schema = _.cloneDeep(schemaInput);
		const tableSlug:string = schema.$id;
		const tableName:string = schema.title || schema.$id;
		const columns:SchemaDefinitions = schema.properties;
		const required = _.cloneDeep(schema.required) || [];
		const description = schema.description || "";
		let db;

		return connect.then((opts) => {
			db = opts.db;

			// Create the collection, ensuring that is doesn't already exist
			// in the database
			return db.createCollection(tableSlug, {strict: true}).then(() => {
				return new Promise((resolve, reject) => {
					db.collection("_counters", {strict: true}, (err, col) => {
						if(err) return reject(err);

						col.insertOne({
							_$id: tableSlug,
							sequences: {}
						}).then(() => {
							resolve();
						});
					});
				});
			}).then(() => {
				const databaseInsert = schema;
				schema._$schema = schema.$schema;
				schema._$id = schema.$id;

				delete schema.$schema;
				delete schema.$id;

				return db.collection("_schema").insertOne(databaseInsert);
			}).then(() => {
				this.definition = columns;
				return this._writeSchema();
			});

		}).then(() => {
			this.tableName = tableName;
			this.tableSlug = tableSlug;
			this.required = required;
			this.description = description;
			this.jsonSchema = schema;

			// Handle index columns
			let promises = [];

			_.each(columns, (column, key) => {
				if(column.isAutoIncrement){
					column.isIndex = true;
					column.isUnique = true;
				}

				if(column.isIndex){
					promises.push(this.addIndex({
						name: key,
						unique: column.isUnique,
						autoIncrement: column.isAutoIncrement
					}));
				}
			});

			return Promise.all(promises);

		}).then(() => {
			return Promise.resolve(this);

		}).catch((err) => {
			this.tableName = null;
			this.tableSlug = null;
			this.required = [];
			this.description = "";
			this.jsonSchema = {};

			// Reverse database actions
			return Promise.all([
				// 1. Remove collection from database
				db.collection(tableSlug).drop(),
				// 2. Remove entry from _schema collection
				db.collection("_schema").deleteOne({"_$id": tableSlug}),
				// 3. Remove entry from _counters collection
				db.collection("_schema").deleteOne({"_$id": tableSlug})
			]).then(() => {
				return Promise.reject(err);
			}).catch((e) => {
				return Promise.reject(e);
			});
		});
	}

	dropTable(){
		return connect.then((opts) => {
			const db = opts.db;
			return db.collection("_schema").deleteOne({"_$id": this.tableSlug}).then((result) => {
				return db.collection(this.tableSlug).drop();
			}).then(() => {
				return db.collection("_counters").deleteOne({"_$id": this.tableSlug});
			}).then(() => {
				this.tableName = null;
				this.tableSlug = null;
				this.definition = {};
				return Promise.resolve(this);
			});
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	renameTable(newSlug:string, newName:string){
		return connect.then((opts) => {
			const db = opts.db;
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
			return Promise.resolve(this);
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

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

		return connect.then((opts) => {
			const db = opts.db;
			return db.collection(this.tableSlug).createIndex(columnName, {unique: unique, name: columnName});
		}).then(() => {
			if(isAutoIncrement){
				return this._setCounter(this.tableSlug, columnName);
			}else{
				return Promise.resolve();
			}
		}).then(() => {
			return Promise.resolve(this);
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	removeIndex(columnName:string){
		return connect.then((opts) => {
			const db = opts.db;
			return db.collection(this.tableSlug).dropIndex(columnName)
				.then(() => {
					return Promise.resolve(db);
				});
		}).then((db) => {
			return db.collection("_counters").findOne({_$id: this.tableSlug}).then((counter) => {
				delete counter.sequences[columnName];
				return db.collection("_counters").findOneAndUpdate({_$id: this.tableSlug}, {
					$set: {
						sequences: counter.sequences
					}
				});
			});
		}).then(() => {
			return Promise.resolve(this);
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	read(tableSlug:string){
		return connect.then((opts) => {
			const db = opts.db;
			return db.collection("_schema").findOne({_$id: tableSlug});
		}).then((data) => {
			if(data){
				this.tableName = data.title;
				this.tableSlug = data._$id;
				this.definition = data.properties;
				this.required = data.required;

				const jsonSchema = _.cloneDeep(data);
				jsonSchema.$schema = data._$schema;
				jsonSchema.$id = data._$id;
				delete jsonSchema._$schema;
				delete jsonSchema._$id;
				delete jsonSchema._id;
				this.jsonSchema = jsonSchema;
			}

			return Promise.resolve(this);
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	define(def:SchemaDefinitions){
		const oldDef:SchemaDefinitions = this.definition;
		this.definition = def;

		// Create schema in RMDB, do nothing in NoSQL
		return connect.then((opts) => {
			const db = opts.db;
			return db.collection("_schema").findOneAndUpdate({
				_$id: this.tableSlug,
			}, {
				$set:{
					properties: def
				}
			}, {
				upsert: true
			});
		}).then(() => {
			return Promise.resolve();
		}).catch((err) => {
			this.definition = oldDef;
			return Promise.reject(err);
		});
	}

	renameColumn(name:string, newName:string){
		this.definition[newName] = _.cloneDeep(this.definition[name]);
		delete this.definition[name];

		return connect.then((opts) => {
			const db = opts.db;
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
			}).then(() => {
				return Promise.resolve(this);
			}).catch((err) => {
				this.definition[name] = _.cloneDeep(this.definition[newName]);
				delete this.definition[newName];
				return Promise.reject(err);
			});
		});
	}

	// Utils --------------------------------------------------------
	_writeSchema(){
		return connect.then((opts) => {
			const db = opts.db;
			return db.collection("_schema").findOneAndUpdate({_$id: this.tableSlug}, {
				$set: {
					properties: this.definition
				}
			});
		}).then(() => {
			return Promise.resolve(this);
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	private _setCounter(collection:string, columnLabel:string){
		return connect.then((opts) => {
			const db = opts.db;
			const sequenceKey = `sequences.${columnLabel}`;

			return db.collection("_counters").findOneAndUpdate({
				_$id: collection
			}, {
				$set: {
					[sequenceKey]: 0
				}
			});
		}).then(() => {
			return Promise.resolve(this);
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	_incrementCounter(collection:string, columnLabel:string){
		return connect.then((opts) => {
			const db = opts.db;
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
		}).catch((err) => {
			return Promise.reject(err);
		});
	}

	_decrementCounter(collection:string, columnLabel:string){
		return connect.then((opts) => {
			const db = opts.db;
			return db.collection("_counters").findOne({
				_$id: collection
			}).then((result) => {
				const newSequence = result.sequences[columnLabel] - 1;
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
		}).catch((err) => {
			return Promise.reject(err);
		});
	}
}

export default function(connection){
	connect = connection;
	return DynamicSchema;
}