require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const ActiveCollection = require("./ActiveCollection.js");
const ActiveSchema = require("./ActiveSchema.js");

// Let's get mongodb working first
const connect = require("./mongoConnection.js");

const ActiveRecord = function(options){
	let tableSlug = options.tableSlug;
	let tableName = options.tableName || options.tableSlug;
	this._databaseConnection = connect;
	this.Schema = ActiveSchema;

	var _ready = this._ready = connect.then((db) => {
		this._db = db;
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
				return col.insertOne(this.data).then((result) => {
					this._original = _.cloneDeep(this.data);
					return Promise.resolve(col);
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
};

ActiveRecord.prototype.closeConnection = function(){
	// Should only ever be called to terminate the node process
	this._ready.then((col) => {
		this._db.close();
	}).catch((err) => {
		// BY ANY MEANS NECESSARY
		this._db.close();
	});
};

ActiveRecord.prototype.findBy = function(query){
	return this._ready.then((col) => {
		return col.findOne(query).then((model) => {
			return Promise.resolve(new this.Model(model, true));
		});
	});
};

ActiveRecord.prototype.where = function(query, orderBy){
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
};

ActiveRecord.prototype.all = function(){
	return this._ready.then((col) => {
		return col.find().toArray().then((models) => {
			var results = new ActiveCollection();
			_.each(models, (model, i) => {
				results.push(new this.Model(model, true));
			});

			return Promise.resolve(results);
		});
	});
};

ActiveRecord.prototype.first = function(){
	return this._ready.then((col) => {
		return col.findOne().then((model) => {
			return Promise.resolve(new this.Model(model, true));
		});
	});
};

module.exports = ActiveRecord;