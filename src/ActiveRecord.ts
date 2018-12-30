require("dotenv").config();
import Promise = require("bluebird");
import _ = require("lodash");
import async = require("async");
const ActiveCollection = require("./ActiveCollection.js");
const ActiveSchema = require("./ActiveSchema.js");

// Let's get mongodb working first
const connect = require("./mongoConnection.js")(process.env.mongo_server, process.env.mongo_db_name, process.env.mongo_user, process.env.mongo_pass);

class ActiveRecord {
	static ActiveSchema = new (ActiveSchema(connect))();

	private _databaseConnection: any;
	private _ready: any;
	private _db: any;
	private _tableName: any;

	Schema: any;
	Model: any;

	constructor(options){
		let tableSlug = options.tableSlug;
		let tableName = options.tableName || options.tableSlug;
		let _db;
		this._databaseConnection = connect;
		let _schema;
		_schema = this.Schema = new (ActiveSchema(this._databaseConnection))();

		var _ready = this._ready = connect.then((db) => {
			_db = this._db = db;
			return db.createCollection(tableSlug).then((col) => {
				this._tableName = tableName;
				return Promise.resolve(col);
			});
		});

		var Model = this.Model = function(data, _preserveOriginal){
			this.data = data;

			if(_preserveOriginal){
				this._original = _.cloneDeep(data);
			}else{
				this._original = null;
			}
		};

		Model.prototype.save = function(){
			return _ready.then((col) => {
				if(this._original){
					return col.updateOne(this._original, this.data, {upsert: true}).then((result) => {
						this._original = _.cloneDeep(this.data);
						return Promise.resolve(col);
					});
				}else{
					// Check if collection contains index that needs auto incrementing
					return _db.collection("_counters").findOne({collection: tableSlug}).then((res) => {
						let promises = [];

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

		Model.prototype.validate = function(schema){
			var result = false;

			_.each(this.data, (el, key) => {
				var field = _.find(schema, (column) => {
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

	closeConnection(){
		// Should only ever be called to terminate the node process
		this._ready.then((col) => {
			this._db.close();
		}).catch((err) => {
			// BY ANY MEANS NECESSARY
			this._db.close();
		});
	}

	findBy(query){
		return this._ready.then((col) => {
			return col.findOne(query).then((model) => {
				return Promise.resolve(new this.Model(model, true));
			});
		});
	}

	where(query, orderBy){
		return this._ready.then((col) => {
			return col.find(query).toArray().then((models) => {
				if(orderBy){
					models = _.sortBy(models, orderBy);
				}

				var results = new ActiveCollection();
				_.each(models, (model, i) => {
					results.push(new this.Model(model, true));
				});

				return Promise.resolve(results);
			});
		});
	}

	all(){
		return this._ready.then((col) => {
			return col.find().toArray().then((models) => {
				var results = new ActiveCollection();
				_.each(models, (model, i) => {
					results.push(new this.Model(model, true));
				});

				return Promise.resolve(results);
			});
		});
	}

	first(){
		return this._ready.then((col) => {
			return col.findOne().then((model) => {
				return Promise.resolve(new this.Model(model, true));
			});
		});
	}
}

module.exports = ActiveRecord;