require("dotenv").config();
import Promise = require("bluebird");
import _ = require("lodash");

let con;

interface Definition{
	name:string;
	slug:string;
	type:string;
}

interface SchemaDefinitions extends Array<Definition>{}{}

interface IndexOptions{
	name:string;
	autoIncrement?:boolean;
	unique?:boolean;
}

interface TableOptions{
	tableSlug:string;
	tableName:string;
	indexColumns:any;
}

// Let's get mongodb working first
class Schema{
	tableName:string;
	tableSlug:string;
	definition:SchemaDefinitions;

	constructor(){
		this.tableName = null;
		this.tableSlug = null;
		this.definition = [];
	}

	createTable(options:TableOptions){
		let tableSlug:string = options.tableSlug;
		let tableName:string = options.tableName;
		let indexColumns = options.indexColumns; // Array

		if(!tableName){
			tableName = tableSlug;
		}

		return con.then((db) => {
			let promises = [];

			promises.push(db.createCollection(tableSlug).then((col) => {
				this.tableName = tableName;
				this.tableSlug = tableSlug;
				return Promise.resolve(db);
			}));

			promises.push(db.createCollection("_counters").then((col) => {
				return col.indexExists("collection").then((result) => {
					if(result === false){
						return col.createIndex("collection", {unique: true}).then(() => {
							return Promise.resolve();
						});
					}else{
						return Promise.resolve();
					}
				}).then(() => {
					return col.insertOne({
						collection: tableSlug,
						sequences: {}
					}).then(() => {
						return Promise.resolve(db);
					});
				});
			}));

			promises.push(db.collection("_schema").insertOne({
				collectionSlug: tableSlug,
				collectionName: tableName,
				fields: []
			}));

			return Promise.all(promises);
		}).then(() => {
			if(indexColumns){
				if(Array.isArray(indexColumns)){
					let promises = [];
					_.each(indexColumns, (el, i) => {
						promises.push(this.addIndex({
							name: el.name,
							unique: el.unique,
							autoIncrement: el.autoIncrement
						}));
					});
					return Promise.all(promises);
				}else{
					return this.addIndex({
						name: indexColumns.name,
						unique: indexColumns.unique,
						autoIncrement: indexColumns.autoIncrement
					});
				}
			}else{
				return Promise.resolve();
			}
		}).catch((err) => {
			this.tableName = null;
			this.tableSlug = null;
			throw err;
		});
	}

	addIndex(options:IndexOptions){
		let columnName:string = options.name;
		let isAutoIncrement:boolean = options.autoIncrement;
		let unique:boolean = options.unique;
		if(isAutoIncrement && unique === false){
			console.warn("Auto increment index must be unique, setting to unique.");
			unique = true;
		}

		if(typeof unique === "undefined"){
			unique = true;
		}

		return con.then((db) => {
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

	removeIndex(columnName:string){
		return con.then((db) => {
			return db.collection(this.tableSlug).dropIndex(columnName)
				.then(() => {
					return Promise.resolve(db);
				});
		}).then((db) => {
			if(columnName === "_uid"){
				return db.collection("_counters").findOneAndDelete({
					collection: this.tableSlug
				});
			}else{
				return Promise.resolve();
			}
		}).catch((err) => {
			throw err;
		});
	}

	read(tableSlug:string){
		return con.then((db) => {
			return db.collection("_schema").findOne({collectionSlug: tableSlug});
		}).then((data) => {
			this.tableName = data.collectionName;
			this.tableSlug = data.collectionSlug;
			this.definition = data.fields;

			return Promise.resolve();
		}).catch((err) => {
			throw err;
		});
	}

	define(tableName:string, tableSlug:string, def:SchemaDefinitions){
		var oldTableName:string = this.tableName;
		var oldTableSlug:string = this.tableSlug;
		var oldDef:SchemaDefinitions = this.definition;
		this.tableName = tableName;
		this.tableSlug = tableSlug;
		this.definition = def;

		// Create schema in RMDB, do nothing in NoSQL
		return con.then((db) => {
			return db.collection("_schema").insertOne({
				collectionSlug: tableSlug,
				collectionName: tableName,
				fields: def
			});
		}).catch((err) => {
			this.tableName = oldTableName;
			this.tableSlug = oldTableSlug;
			this.definition = oldDef;
			throw err;
		});
	}

	addColumn(slug:string, type:string){
		this.definition.push({
			name: slug,
			slug: slug,
			type: type
		});

		return this._writeSchema().catch((err) => {
			this.definition.pop();
			throw err;
		});
	}

	addColumns(def:SchemaDefinitions){
		let oldDefinition:SchemaDefinitions = _.cloneDeep(this.definition);
		this.definition = this.definition.concat(def);

		return this._writeSchema().catch((err) => {
			this.definition = _.cloneDeep(oldDefinition);
			throw err;
		});
	}

	renameColumn(slug:string, newSlug:string){
		var index = _.findIndex(this.definition, (el) => {
			return el.slug == slug;
		});

		this.definition[index].name = newSlug;
		this.definition[index].slug = newSlug;

		return this._writeSchema().catch((err) => {
			this.definition[index].name = slug;
			this.definition[index].slug = slug;
			throw err;
		});
	}

	changeColumnType(slug:string, newType:string){
		var index:number = _.findIndex(this.definition, (el) => {
			return el.slug == slug;
		});
		var oldType:string = this.definition[index].type;
		this.definition[index].type = newType;

		return this._writeSchema().catch((err) => {
			this.definition[index].type = oldType;
			throw err;
		});
	}

	removeColumn(slug:string){
		var index:number = _.findIndex(this.definition, (el) => {
			return el.label == slug;
		});
		var deleted:Definition[] = this.definition.splice(index, 1);

		return this._writeSchema().catch((err) => {
			this.definition.splice(index, 0, ...deleted);
			throw err;
		});
	}

	// Utils --------------------------------------------------------
	private _writeSchema(){
		return con.then((db) => {
			return db.collection("_schema").findOneAndUpdate({collectionSlug: this.tableSlug}, {
				$set: {
					fields: this.definition
				}
			});
		});
	}

	private _setCounter(collection:string, columnLabel:string){
		return con.then((db) => {
			let sequenceKey = `sequences.${columnLabel}`;

			return db.collection("_counters").findOneAndUpdate({
				collection: collection
			}, {
				$set: {
					[sequenceKey]: 0
				}
			});
		});
	}

	private _incrementCounter(collection:string, columnLabel:string){
		return con.then((db) => {
			return db.collection("_counters").findOne({
				collection: collection
			}).then((result) => {
				let newSequence = result.sequences[columnLabel] + 1;
				let sequenceKey = `sequences.${columnLabel}`;

				return db.collection("_counters").findOneAndUpdate({
					collection: collection
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
	con = connection;
	return Schema;
};