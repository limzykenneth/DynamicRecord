import * as _ from "lodash";
import {Model as ModelBase, DynamicRecord as DRBase} from "../DynamicRecord";
import DynamicCollection from "./DynamicCollection";
import DynamicSchema from "./DynamicSchema";
import connect from "./connection";
const schemaValidator = new (require("./schemaValidation.js"))(connect);

class DynamicRecord extends DRBase {
	// Static constructors for their own separate use
	static DynamicSchema = DynamicSchema(connect);
	static DynamicCollection = DynamicCollection;

	private _databaseConnection: any;
	private _ready: any;
	private _db: any;
	private _client: any;

	static async closeConnection(){
		await super.closeConnection();
		const opts = await connect;
		await opts.client.close();
	}

	constructor(options){
		super(options);
		this._databaseConnection = connect;
		const _schema = this.schema = new (DynamicSchema(this._databaseConnection))();
		const tableSlug = options.tableSlug;
		let _db;
		let _client;

		// Initialize database connection and populate schema instance
		const _ready = this._ready = connect.then((opts) => {
			const db = _db = this._db = opts.db;
			_client = this._client = opts.client;

			// Collection must already exist in database
			return this.schema.read(tableSlug).then((schema) => {
				if(schema.tableSlug === "") return Promise.reject(`Table with name ${tableSlug} does not exist`);

				const col = db.collection(tableSlug);

				if(col){
					return Promise.resolve(col);
				}else{
					return Promise.reject(`Table with name ${tableSlug} does not exist`);
				}
			});
		});

		const Model = this.Model = class Model extends ModelBase{
			private _saveQueue: Array< Promise<any> >;

			constructor(data: any, _preserveOriginal: boolean){
				if(_.has(data, "_id")){
					delete data._id;
				}
				super(data, _preserveOriginal);
				this._saveQueue = [];
			}

			async save(): Promise<Model>{
				const saveData = async () => {
					const col = await _ready;
					if(this._original){
						await validateData(this.data);
						await col.updateOne(this._original, {$set: this.data});
						this._original = _.cloneDeep(this.data);
						return this;
					}else{
						// Check if collection contains index that needs auto incrementing
						return _db.collection("_counters").findOne({_$id: tableSlug}).then(async (res) => {
							const promises = [];
							if(res !== null){
								// Auto incrementing index exist
								_.each(res.sequences, (el, columnLabel) => {
									promises.push(_schema._incrementCounter(tableSlug, columnLabel).then((newSequence) => {
										this.data[columnLabel] = newSequence;
										return Promise.resolve(newSequence);
									}));
								});

								await Promise.all(promises);
							}
							await validateData(this.data);

							// Save data into the database
							await col.insertOne(this.data);
							this._original = _.cloneDeep(this.data);
							return this;
						}).catch(async (err) => {
							// Reverse database actions
							try{
								await Promise.all([
									// 1. Decrement autoincrement counter
									_db.collection("_counters").findOne({_$id: tableSlug}).then((res) => {
										const promises = [];
										if(res){
											_.each(res.sequences, (el, columnLabel) => {
												promises.push(_schema._decrementCounter(tableSlug, columnLabel));
											});
										}

										return Promise.all(promises);
									})
								]);
								return Promise.reject(err);
							} catch(e) {
								return Promise.reject(e);
							}
						});
					}
				};

				// Wait for current queue of saves before continuing
				return Promise.all(this._saveQueue).then(() => {
					this._saveQueue = [];
					const res = saveData();
					this._saveQueue.push(res);
					return res;
				});

				async function validateData(data){
					const validate = await schemaValidator.compileAsync({$ref: _schema.tableSlug});
					if(validate(data)){
						return Promise.resolve();
					}else{
						return Promise.reject(new Error(validate.errors));
					}
				}
			}

			async destroy(): Promise<Model>{
				const col = await _ready;

				// Wait for current queue of saves before continuing
				return Promise.all(this._saveQueue).then(async () => {
					if(this._original){
						await col.deleteOne(this._original);
						this._original = null;
						this.data = null;
						return this;
					}else{
						throw new Error("Model not saved in database yet.");
					}
				});
			}

			validate(schema): boolean{
				let result = false;

				_.each(this.data, (el, key) => {
					const field = _.find(schema, (column) => {
						return column.label == key;
					});

					if(field.type == "string"){
						result = _.isString(el);
					}else if(field.type == "int"){
						result = Number.isInteger(el);
					}
				});

				return result;
			}
		};
	}

	async closeConnection(): Promise<any>{
		// Should only ever be called to terminate the node process
		try{
			await this._ready;
			this._client.close();
		} catch(e) {
			// BY ANY MEANS NECESSARY
			this._client.close();
		}
	}

	async findBy(query: object): Promise<ModelBase>{
		// CONSIDER: Possibly implement our own unique id system
		const col = await this._ready;
		const model = await col.findOne(query);

		if(model !== null){
			// Delete mongodb added "_id" field
			delete model._id;
			return new this.Model(model, true);
		}else{
			return null;
		}
	}

	async where(query: object, orderBy: string | Function): Promise<DynamicCollection>{
		const col = await this._ready;
		let models = await col.find(query).toArray();

		if(orderBy){
			models = _.sortBy(models, orderBy);
		}

		// Delete mongodb added "_id" field
		models.forEach((el) => {
			delete el._id;
		});

		const results = new DynamicCollection(this.Model, ...models);

		results.forEach((result) => {
			result._original = _.cloneDeep(result.data);
		});

		return results;
	}

	async all(): Promise<DynamicCollection>{
		const col = await this._ready;
		let models = await col.find().toArray();
		// Delete mongodb added "_id" field
		models.forEach((el) => {
			delete el._id;
		});

		const results = new DynamicCollection(this.Model, ...models);

		results.forEach((result) => {
			result._original = _.cloneDeep(result.data);
		});

		return results;
	}

	async first(n?:number): Promise<ModelBase|DynamicCollection>{
		const col = await this._ready;
		if(typeof n === "undefined"){
			const model = await col.findOne();
			if(model !== null){
				// Delete mongodb added "_id" field
				delete model._id;
				return new this.Model(model, true);
			}else{
				return null;
			}
		}else{
			const models = await col.find({}).limit(n).toArray();
			// Delete mongodb added "_id" field
			models.forEach((el) => {
				delete el._id;
			});

			return new DynamicCollection(this.Model, ...models);
		}
	}
}

module.exports = DynamicRecord;