import _ = require("lodash");
const DynamicCollection = require("./DynamicCollection.js");
const DynamicSchema = require("./DynamicSchema.js");

// Let's get mongodb working first
const connect = require("./mongoConnection.js");
const schemaValidator = new (require("./schemaValidation.js"))(connect);

class DynamicRecord {
	// Static constructors for their own separate use
	static DynamicSchema = DynamicSchema(connect);
	static DynamicCollection = DynamicCollection;

	private _databaseConnection: any;
	private _ready: any;
	private _db: any;
	private _client: any;

	// Instance specific constructors
	Model: any;
	// Instance specific Schema object
	schema: any;

	/**
	 * Creates a new DynamicRecord instance.
	 *
	 * @name DynamicRecord
	 * @class
	 * @param {object} options
	 * @param {string} options.tableSlug - The slug of the table. Must be lowercase only
	 * and not containing any whitespace
	 */
	constructor(options){
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

		/**
		 * Create a new DynamicRecord.Model instance.
		 *
		 * @name DynamicRecord.Model
		 * @memberOf DynamicRecord
		 * @instance
		 * @constructor
		 * @param {object} data - Object containing data for this instance of
		 * DynamicRecord.Model
		 */
		const Model = this.Model = function(data, _preserveOriginal){
			/**
			 * The data contained in this instance. It is not kept in sync with
			 * the database automatically.
			 *
			 * You should be directly modifying this object. When done and you
			 * wish to save the data to the database, call `save()` on the
			 * parent object instance.
			 *
			 * @name data
			 * @type object
			 * @memberOf DynamicRecord.Model
			 * @instance
			 */
			this.data = data || {};

			if(_preserveOriginal){
				this._original = _.cloneDeep(data);
			}else{
				this._original = null;
			}
		};

		/**
		 * Save the data in this instance to the database.
		 *
		 * If you have a series of models of the same schema, it is recommended
		 * to put them in a DynamicCollection and calling `saveAll()` on it
		 * instead of attempting to save them all in parallel. This applies to
		 * schemas with auto incrementing counters.
		 *
		 * @method save
		 * @memberOf DynamicRecord.Model
		 * @instance
		 * @return {Promise} Return promise of this DynamicRecord.Model instance
		 */
		Model.prototype.save = async function(){
			return _ready.then(async (col) => {
				if(this._original){
					await validateData(this.data);
					await col.updateOne(this._original, {$set: this.data}, {upsert: true});
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
					}).catch((err) => {
						// Reverse database actions
						return Promise.all([
							// 1. Decrement autoincrement counter
							_db.collection("_counters").findOne({_$id: tableSlug}).then((res) => {
								const promises = [];
								_.each(res.sequences, (el, columnLabel) => {
									promises.push(_schema._decrementCounter(tableSlug, columnLabel));
								});

								return Promise.all(promises);
							})
						]).then(() => {
							return Promise.reject(err);
						}).catch((e) => {
							return Promise.reject(e);
						});
					});
				}
			}).catch((err) => {
				return Promise.reject(err);
			});

			async function validateData(data){
				const validate = await schemaValidator.compileAsync({$ref: _schema.tableSlug});
				if(validate(data)){
					return Promise.resolve();
				}else{
					return Promise.reject(new Error(validate.errors));
				}
			}
		};

		/**
		 * Delete the entry this instance links to. Clear the data property
		 * of this instance as well.
		 *
		 * @method destroy
		 * @memberOf DynamicRecord.Model
		 * @instance
		 * @return {Promise} Return promise of this DynamicRecord.Model instance
		 */
		Model.prototype.destroy = async function(){
			const col = await _ready;

			if(this._original){
				await col.deleteOne(this._original);
				this._original = null;
				this.data = null;
				return this;
			}else{
				throw new Error("Model not saved in database yet.");
			}
		};

		/**
		 * Validate the data in this instance conform to its schema.
		 *
		 * **Implementation not settled**
		 *
		 * @method validate
		 * @memberOf DynamicRecord.Model
		 * @instance
		 * @return {boolean}
		 */
		Model.prototype.validate = function(schema){
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
		};
	}

	/**
	 * Close the connection to the database server. Only used to terminate
	 * the running node instance.
	 *
	 * @method closeConnection
	 * @memberOf DynamicRecord
	 * @instance
	 */
	async closeConnection(){
		// Should only ever be called to terminate the node process
		try{
			await this._ready;
			this._client.close();
		} catch(e) {
			// BY ANY MEANS NECESSARY
			this._client.close();
		}
	}

	/**
	 * Find the latest entry in the table that match the query.
	 *
	 * @method findBy
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {object} query - A key value pair that will be used to match for entry
	 * in the database
	 * @return {Promise} Return promise of DynamicRecord.Model instance or null
	 */
	async findBy(query: object){
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

	/**
	 * Find all the entries in the table that match the query.
	 *
	 * You can sort the returned data by providing a string key to sort the
	 * data by or a sorting function to manually sort the data. By default
	 * they are sorted in the order they are in in the database.
	 *
	 * @method where
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {object} query - A key value pair that will be used to match for entries
	 * @param {string|function} orderBy - The key to sort by or a sorting function
	 * @return {Promise} Return promise of DynamicCollection instance
	 */
	async where(query: object, orderBy: string | Function){
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

	/**
	 * Return all entries from the table.
	 *
	 * @method all
	 * @memberOf DynamicRecord
	 * @instance
	 * @return {Promise} Return promise of DynamicCollection instance
	 */
	async all(){
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

	/**
	 * Return the first entry in the table. If provided with an integer
	 * argument n, it will return the first nth entry in the database wrapped
	 * in a Promise of DynamicCollection.
	 *
	 * @method first
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {number} [n] - The number of records to return
	 * @return {Promise} Return promise of DynamicRecord.Model instance,
	 * DynamicCollection instance, or null
	 */
	async first(n?:number){
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