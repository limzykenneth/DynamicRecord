import * as _ from "lodash";
import {Ajv} from "ajv";
import {Db, MongoClient} from "mongodb";
import {Model as ModelBase, DynamicRecord as DRBase} from "../DynamicRecord";
import {DynamicCollection} from "./DynamicCollection";
import {DynamicSchema} from "./DynamicSchema";
import {QueryOptions} from "../interfaces/DynamicRecord";
import {DRConnection} from "../interfaces/connection";
import SchemaValidator from "./schemaValidation";

export class DynamicRecord<DataObject extends {_id?: string}> extends DRBase<DataObject> {
	schema: Promise<DynamicSchema>;

	private _databaseConnection: DRConnection;
	private _ready: any;
	private _db: Db;
	private _client: MongoClient;
	private _schemaValidator: Ajv;

	constructor(options: {tableSlug: string, connection: DRConnection}){
		super(options);

		let _db, _client;
		const connect = this._databaseConnection = options.connection;
		const _schemaValidator = this._schemaValidator = SchemaValidator(this._databaseConnection);
		const tableSlug = options.tableSlug;

		const _schema: Promise<DynamicSchema> = this.schema = connect.interface.then(({db}) => {
			return new DynamicSchema({connection: this._databaseConnection});
		}).then((schema) => {
			return schema.read(tableSlug);
		}).then((schema) => {
			if(schema.tableSlug === null) return Promise.reject(`Table with name ${tableSlug} does not exist`);
			return schema;
		});

		// Initialize database connection and populate schema instance
		// Collection must already exist in database
		const _ready = this._ready = connect.interface.then(({db, client}) => {
			_db = this._db = db;
			_client = this._client = client;

			return this.schema;
		}).then((schema) => {
			const col = _db.collection(tableSlug);

			if(col){
				return Promise.resolve(col);
			}else{
				return Promise.reject(`Table with name ${tableSlug} does not exist`);
			}
		});

		const Model = this.Model = class Model<DataObject extends {_id?: string}> extends ModelBase<DataObject> {
			private _savePromise: Promise< Model<DataObject> >;
			private _id: string;

			constructor(data: DataObject, _preserveOriginal: boolean){
				let id = null;

				// Preserve mongodb _id if exist for faster saving
				if(_.has(data, "_id")){
					id = data._id;
					delete data._id;
				}

				super(data, _preserveOriginal);
				this._savePromise = null;
				this._id = id;
			}

			async save(): Promise< Model<DataObject> >{
				await _ready;

				const saveData = async () => {
					const col = await _ready;
					if(this._id){
						// Update existing entry
						await validateData(this.data);
						await col.updateOne({_id: this._id}, {$set: this.data});
						this._original = _.cloneDeep(this.data);
						return this;
					}else{
						// Create new entry
						// Check if collection contains index that needs auto incrementing
						return _db.collection("_counters").findOne({_$id: tableSlug}).then(async (res) => {
							const promises = [];
							if(res !== null){
								// Auto incrementing index exist
								_.each(res.sequences, (el, columnLabel) => {
									promises.push(_schema.then((schema) => {
										return schema._incrementCounter(tableSlug, columnLabel).then((newSequence) => {
											this.data[columnLabel] = newSequence;
											return Promise.resolve(newSequence);
										});
									}));
								});

								await Promise.all(promises);
							}

							await validateData(this.data);

							// Save data into the database
							await col.insertOne(this.data);

							if(_.has(this.data, "_id")){
								this._id = this.data._id;
								delete this.data._id;
							}

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
												promises.push(_schema.then((schema) => {
													return schema._decrementCounter(tableSlug, columnLabel);
												}));
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
				if(this._savePromise){
					await this._savePromise;
					this._savePromise = saveData();
				}else{
					this._savePromise = saveData();
				}
				return this._savePromise;

				async function validateData(data){
					const schema = await _schema;
					const validate = await _schemaValidator.compileAsync({$ref: schema.tableSlug});
					if(validate(data)){
						return Promise.resolve();
					}else{
						return Promise.reject(new Error(JSON.stringify(validate.errors, null, 2)));
					}
				}
			}

			async destroy(): Promise< Model<DataObject> >{
				const col = await _ready;
				const destroyData = async () => {
					if(this._original){
						await col.deleteOne(this._original);
						this._original = null;
						this.data = null;
						return this;
					}else{
						throw new Error("Model not saved in database yet.");
					}
				};

				// Wait for current queue of saves before continuing
				if(this._savePromise){
					await this._savePromise;
					this._savePromise = destroyData();
				}else{
					this._savePromise = destroyData();
				}
				return this._savePromise;
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

	async closeConnection(): Promise<void>{
		// Should only ever be called to terminate the node process
		try{
			await this._ready;
			this._client.close();
		} catch(e) {
			// BY ANY MEANS NECESSARY
			this._client.close();
		}
	}

	async findBy(query: object): Promise< ModelBase<DataObject> >{
		const col = await this._ready;
		const model = await col.findOne(query);

		if(model !== null){
			return new this.Model(model, true);
		}else{
			return null;
		}
	}

	async where(query: object, options?: QueryOptions): Promise< DynamicCollection<DataObject> >{
		const col = await this._ready;
		let models = await col.find(query)
			.limit(options?.limit || 0)
			.skip(options?.offset || 0)
			.sort(_.mapValues(options?.sort, (val) => {
				if(val === "ASC"){
					return 1;
				}else if(val === "DESC"){
					return -1;
				}else{
					return 0;
				}
			}))
			.toArray();

		const results = new DynamicCollection<DataObject>(this.Model, ...models);

		results.forEach((result) => {
			result._original = _.cloneDeep(result.data);
		});

		return results;
	}

	async all(): Promise< DynamicCollection<DataObject> >{
		const col = await this._ready;
		let models = await col.find().toArray();

		const results = new DynamicCollection<DataObject>(this.Model, ...models);

		results.forEach((result) => {
			result._original = _.cloneDeep(result.data);
		});

		return results;
	}

	async first(options?: QueryOptions): Promise< ModelBase<DataObject>|DynamicCollection<DataObject> >{
		const col = await this._ready;
		const models = await col.find({})
			.limit(options?.limit || 1)
			.skip(options?.offset || 0)
			.sort(_.assign(
				_.mapValues(options?.sort, (val) => {
					if(val === "ASC"){
						return 1;
					}else if(val === "DESC"){
						return -1;
					}else{
						return 0;
					}
				}),
				{
					_id: 1
				}
			))
			.toArray();

		if(models.length === 0 && _.isUndefined(options?.limit)){
			return null;
		}else if(models.length === 1 && _.isUndefined(options?.limit)){
			return new this.Model(models[0], true);
		}else{
			return new DynamicCollection<DataObject>(this.Model, ...models);
		}
	}

	async last(options?: QueryOptions): Promise< ModelBase<DataObject>|DynamicCollection<DataObject> >{
		const col = await this._ready;
		const models = await col.find({})
			.limit(options?.limit || 1)
			.skip(options?.offset || 0)
			.sort(_.assign(
				_.mapValues(options?.sort, (val) => {
					if(val === "ASC"){
						return 1;
					}else if(val === "DESC"){
						return -1;
					}else{
						return 0;
					}
				}),
				{
					_id: -1
				}
			))
			.toArray();

		if(models.length === 0 && _.isUndefined(options?.limit)){
			return null;
		}else if(models.length === 1 && _.isUndefined(options?.limit)){
			return new this.Model(models[0], true);
		}else{
			return new DynamicCollection<DataObject>(this.Model, ...models);
		}
	}
}