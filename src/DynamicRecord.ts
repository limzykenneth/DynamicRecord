require("dotenv").config();
import Promise = require("bluebird");
import _ = require("lodash");
const DynamicCollection = require("./DynamicCollection.js");
const DynamicSchema = require("./DynamicSchema.js");

// Let's get mongodb working first
const connect = require("./mongoConnection.js")(process.env.mongo_server, process.env.mongo_db_name, process.env.mongo_user, process.env.mongo_pass);

/** @namespace DynamicRecord */
/**
 * Creates a new DynamicRecord instance.
 *
 * @class
 * @param {object} options
 * @param {string} options.tableSlug - The slug of the table. Must be lowercase only
 * and not containing any whitespace
 */
class DynamicRecord {
	// Static constructors for their own separate use
	static DynamicSchema = DynamicSchema(connect);
	static DynamicCollection = DynamicCollection;

	private _databaseConnection: any;
	private _ready: any;
	private _db: any;

	// Instance specific constructors
	Model: any;
	// Instance specific Schema object
	schema: any;

	constructor(options){
		this._databaseConnection = connect;
		const _schema = this.schema = new (DynamicSchema(this._databaseConnection))();
		const tableSlug = options.tableSlug;
		let _db;

		// Initialize database connection and populate schema instance
		const _ready = this._ready = connect.then((db) => {
			_db = this._db = db;

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
		 * Create a new DynamicRecord.Model instance
		 *
		 * @name DynamicRecord.Model
		 * @constructor
		 * @param {object} data - Object containing data for this instance of DynamicRecord.Model
		 */
		const Model = this.Model = function(data, _preserveOriginal){
			/**
			 * The data contained in this instance. It is not kept in sync with the database
			 * automatically.
			 *
			 * @property {object} data
			 */
			this.data = data;

			if(_preserveOriginal){
				this._original = _.cloneDeep(data);
			}else{
				this._original = null;
			}
		};

		/**
		 * Save the data in this instance to the database
		 *
		 * @method save
		 * @return {Promise}
		 */
		Model.prototype.save = function(){
			return _ready.then((col) => {
				if(this._original){
					return col.updateOne(this._original, this.data, {upsert: true}).then((result) => {
						this._original = _.cloneDeep(this.data);
						return Promise.resolve(col);
					});
				}else{
					// Check if collection contains index that needs auto incrementing
					return _db.collection("_counters").findOne({_$id: tableSlug}).then((res) => {
						const promises = [];
						if(res !== null){
							// Auto incrementing index exist
							_.each(res.sequences, (el, columnLabel) => {
								promises.push(_schema._incrementCounter(tableSlug, columnLabel).then((newSequence) => {
									this.data[columnLabel] = newSequence;
									return Promise.resolve(newSequence);
								}));
							});

							return Promise.all(promises);
						}else{
							// No auto incrementing index
							return Promise.resolve();
						}
					}).then(() => {
						// Save data into the database
						return col.insertOne(this.data).then((result) => {
							this._original = _.cloneDeep(this.data);
							return Promise.resolve(col);
						});
					});
				}
			});
		};

		/**
		 * Delete the entry this instance links to
		 *
		 * @method destroy
		 * @return {Promise}
		 */
		Model.prototype.destroy = function(){
			return _ready.then((col) => {
				if(this._original){
					return col.deleteOne(this._original).then((result) => {
						this._original = null;
						this.data = null;
						return Promise.resolve(col);
					});
				}else{
					throw new Error("Model not saved in database yet.");
				}
			});
		};

		/**
		 * Validate the data in this instance conform to its schema
		 *
		 * @method validate
		 * @return {Promise}
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
	 * Close the connection to the database server.
	 *
	 * @method closeConnection
	 */
	closeConnection(){
		// Should only ever be called to terminate the node process
		this._ready.then((col) => {
			this._db.close();
		}).catch((err) => {
			// BY ANY MEANS NECESSARY
			this._db.close();
		});
	}

	/**
	 * Find the latest entry in the table that match the query.
	 *
	 * @method findBy
	 * @param {object} query - A key value pair that will be used to match for entry
	 * in the database
	 * @return {DynamicRecord.Model} An instance of DynamicRecord.Model created from the
	 * retrieved data
	 */
	findBy(query: object){
		return this._ready.then((col) => {
			return col.findOne(query).then((model) => {
				return Promise.resolve(new this.Model(model, true));
			});
		});
	}

	/**
	 * Find all the entries in the table that match the query.
	 *
	 * @method where
	 * @param {object} query - A key value pair that will be used to match for entries
	 * @param {string|function} orderBy - The key to sort by or a sorting function
	 * @return {DynamicCollection} An instance of DynamicCollection containing a list of
	 * DynamicRecord.Model objects created from the retrieved data
	 */
	where(query: object, orderBy: string | Function){
		return this._ready.then((col) => {
			return col.find(query).toArray().then((models) => {
				if(orderBy){
					models = _.sortBy(models, orderBy);
				}

				const results = new DynamicCollection(this.Model, ...models);

				_.each(results, (result) => {
					result._original = _.cloneDeep(result.data)
				});

				return Promise.resolve(results);
			});
		});
	}

	/**
	 * Return all entries from the table
	 *
	 * @method all
	 * @return {DynamicCollection} An instance of DynamicCollection containing a list of
	 * DynamicRecord.Model objects created from all entries in the table
	 */
	all(){
		return this._ready.then((col) => {
			return col.find().toArray().then((models) => {
				const results = new DynamicCollection(this.Model, ...models);

				_.each(results, (result) => {
					result._original = _.cloneDeep(result.data)
				});

				return Promise.resolve(results);
			});
		});
	}

	/**
	 * Return the first entry in the table
	 *
	 * @method first
	 * @return {DynamicRecord.Model} An instance of DynamicRecord.Model created from the
	 * first entry in the table
	 */
	first(){
		return this._ready.then((col) => {
			return col.findOne().then((model) => {
				return Promise.resolve(new this.Model(model, true));
			});
		});
	}
}

module.exports = DynamicRecord;