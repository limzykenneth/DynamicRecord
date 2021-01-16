import * as _ from "lodash";
import {TableSchema, SchemaDefinitions, IndexOptions, DynamicSchema as Schema} from "../DynamicSchema";

let connect;
const schemaValidator = new (require("./schemaValidation.js"))(connect);

class DynamicSchema extends Schema{
	constructor(){
		super();
	}

	async createTable(schemaInput:TableSchema): Promise<DynamicSchema>{
		const schema = _.cloneDeep(schemaInput);
		const tableSlug:string = schema.$id;
		const tableName:string = schema.title || schema.$id;
		const columns:SchemaDefinitions = schema.properties;
		const required = _.cloneDeep(schema.required) || [];
		const description = schema.description || "";
		const {db} = await connect;

		try{
			// Create the collection, ensuring that is doesn't already exist
			// in the database
			await db.createCollection(tableSlug);
			const col = await db.collection("_counters");
			await col.insertOne({
				_$id: tableSlug,
				sequences: {}
			});

			const databaseInsert = schema;
			schema._$schema = schema.$schema;
			schema._$id = schema.$id;

			delete schema.$schema;
			delete schema.$id;

			await db.collection("_schema").insertOne(databaseInsert);
			this.definition = columns;
			await this._writeSchema();

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

			await Promise.all(promises);

			return this;

		} catch(err) {
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
				db.collection("_counters").deleteOne({"_$id": tableSlug})
			]).then(() => {
				return Promise.reject(err);
			}).catch((e) => {
				return Promise.reject(e);
			});
		}
	}

	async dropTable(): Promise<DynamicSchema>{
		try{
			const {db} = await connect;
			await db.collection("_schema").deleteOne({"_$id": this.tableSlug});
			await db.collection(this.tableSlug).drop();
			await db.collection("_counters").deleteOne({"_$id": this.tableSlug});
			this.tableName = null;
			this.tableSlug = null;
			this.definition = {};
			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async renameTable(newSlug:string, newName?:string): Promise<DynamicSchema>{
		try{
			const {db} = await connect;
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

			await Promise.all(promises);

			this.tableSlug = newSlug;
			this.tableName = newName || newSlug;
			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async addIndex(options:IndexOptions): Promise<DynamicSchema>{
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

		try{
			const {db} = await connect;
			await db.collection(this.tableSlug).createIndex(columnName, {unique: unique, name: columnName});

			if(isAutoIncrement){
				await this._setCounter(this.tableSlug, columnName);
			}

			// Update schema entry in database
			const indexKey = `properties.${columnName}.isIndex`;
			const uniqueKey = `properties.${columnName}.isUnique`;
			const autoIncrementKey = `properties.${columnName}.isAutoIncrement`;
			await db.collection("_schema").updateOne({_$id: this.tableSlug}, {
				$set: {
					[indexKey]: true,
					[uniqueKey]: !!unique,
					[autoIncrementKey]: !!isAutoIncrement
				}
			});

			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async removeIndex(columnName:string): Promise<DynamicSchema>{
		try{
			const {db} = await connect;
			await db.collection(this.tableSlug).dropIndex(columnName);

			const counter = await db.collection("_counters").findOne({_$id: this.tableSlug});
			delete counter.sequences[columnName];

			await db.collection("_counters").findOneAndUpdate({_$id: this.tableSlug}, {
				$set: {
					sequences: counter.sequences
				}
			});

			// Update schema entry in database
			const indexKey = `properties.${columnName}.isIndex`;
			const uniqueKey = `properties.${columnName}.isUnique`;
			const autoIncrementKey = `properties.${columnName}.isAutoIncrement`;
			await db.collection("_schema").updateOne({_$id: this.tableSlug}, {
				$set: {
					[indexKey]: false,
					[uniqueKey]: false,
					[autoIncrementKey]: false
				}
			});

			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async read(tableSlug:string): Promise<DynamicSchema>{
		try{
			const {db} = await connect;
			const data = await db.collection("_schema").findOne({_$id: tableSlug});
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

			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async define(def:SchemaDefinitions, required:Array<string> = []): Promise<DynamicSchema>{
		const oldDef:SchemaDefinitions = _.cloneDeep(this.definition);
		this.definition = def;

		// Create schema in RMDB, do nothing in NoSQL
		try{
			const {db} = await connect;
			await db.collection("_schema").findOneAndUpdate({
				_$id: this.tableSlug,
			}, {
				$set:{
					properties: def,
					required: required
				}
			}, {
				upsert: true
			});
			
			return this;
		} catch(err) {
			this.definition = oldDef;
			return Promise.reject(err);
		}
	}

	async renameColumn(name:string, newName:string): Promise<DynamicSchema>{
		this.definition[newName] = _.cloneDeep(this.definition[name]);
		delete this.definition[name];

		try{
			const {db} = await connect;
			await this._writeSchema();
			const entry = await db.collection("_counters").findOne({"_$id": this.tableSlug});
			
			if(entry){
				const sequences = _.cloneDeep(entry.sequences);
				sequences[newName] = sequences[name];
				delete sequences[name];
				await db.collection("_counters").findOneAndUpdate({"_$id": this.tableSlug},
					{
						$set: {
							sequences: sequences
						}
					}
				);
			}

			return this;

		} catch(err) {
			this.definition[name] = _.cloneDeep(this.definition[newName]);
			delete this.definition[newName];
			return Promise.reject(err);
		}
	}

	// Utils --------------------------------------------------------
	async _writeSchema(): Promise<DynamicSchema>{
		try{
			const {db} = await connect;
			await db.collection("_schema").findOneAndUpdate({_$id: this.tableSlug}, {
				$set: {
					properties: this.definition
				}
			});
		
			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	private async _setCounter(collection:string, columnLabel:string): Promise<DynamicSchema>{
		try{
			const {db} = await connect;
			const sequenceKey = `sequences.${columnLabel}`;

			await db.collection("_counters").findOneAndUpdate({
				_$id: collection
			}, {
				$set: {
					[sequenceKey]: 0
				}
			});

			return this;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async _incrementCounter(collection:string, columnLabel:string): Promise<number>{
		try{
			const {db} = await connect;
			const result = await db.collection("_counters").findOne({
				_$id: collection
			});
			const newSequence = result.sequences[columnLabel] + 1;
			const sequenceKey = `sequences.${columnLabel}`;

			await db.collection("_counters").findOneAndUpdate({
				_$id: collection
			}, {
				$set: {
					[sequenceKey]: newSequence
				}
			});

			return newSequence;
		} catch(err) {
			return Promise.reject(err);
		}
	}

	async _decrementCounter(collection:string, columnLabel:string): Promise<number>{
		try{
			const {db} = await connect;
			const result = await db.collection("_counters").findOne({
				_$id: collection
			});
			const newSequence = result.sequences[columnLabel] - 1;
			const sequenceKey = `sequences.${columnLabel}`;

			await db.collection("_counters").findOneAndUpdate({
				_$id: collection
			}, {
				$set: {
					[sequenceKey]: newSequence
				}
			});
			return newSequence;
		} catch(err) {
			return Promise.reject(err);
		}
	}
}

export default function(connection){
	connect = connection;
	return DynamicSchema;
}