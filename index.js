require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const f = require("util").format;
const ActiveCollection = require("./ActiveCollection.js");

// Let's get mongodb working first
const MongoClient = require("mongodb").MongoClient;
let mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
let connect = MongoClient.connect(mongoURL, {poolSize: 10});

let ActiveRecord = function(tableName){
	var _collectionCreated = this._collectionCreated = connect.then((db) => {
		this._db = db;
		return db.createCollection(tableName).then((col) => {
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
		return _collectionCreated.then((col) => {
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
		return _collectionCreated.then((col) => {
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


	let Schema = this.Schema = function(){
		this.tableName = null;
		this.definition = [];
	};

	Schema.prototype.createTable = function(tableName){
		return connect.then((db) => {
			return db.createCollection(tableName).then((col) => {
				this.tableName = tableName;
				return Promise.resolve(db);
			});
		}).then((db) => {
			return db.collection("_schema").insertOne({
				collectionSlug: this.tableName,
				collectionName: this.tableName,
				fields: []
			}).catch((err) => {
				this.tableName = null;
				throw err;
			});
		}).catch((err) => {
			throw err;
		});
	};

	// Read and define schema
	Schema.prototype.read = function(tableName){
		return connect.then((db) => {
			return db.collection("_schema").findOne({collectionSlug: tableName});
		}).then((data) => {
			this.tableName = tableName;
			this.definition = data.fields;

			return Promise.resolve();
		}).catch((err) => {
			throw err;
		});
	};

	Schema.prototype.define = function(tableName, def){
		var oldTableName = this.tableName;
		var oldDef = this.definition;
		this.tableName = tableName;
		this.definition = def;

		// Create schema in RMDB, do nothing in NoSQL
		return connect.then((db) => {
			return db.collection("_schema").insertOne({
				collectionSlug: tableName,
				collectionName: tableName,
				fields: def
			});
		}).catch((err) => {
			this.tableName = oldTableName;
			this.definition = oldDef;
			throw err;
		});
	};

	Schema.prototype.restore = function(){
		this.read();

		// Populate columns in RDB with columns
	};

	// Columns functions
	Schema.prototype.addColumn = function(label, type){
		this.definition.push({
			name: label,
			slug: label,
			type: type
		});

		return this._writeSchema().catch((err) => {
			this.definition.pop();
			throw err;
		});
	};

	Schema.prototype.renameColumn = function(slug, newSlug){
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
	};

	Schema.prototype.changeColumnType = function(label, newType){
		var index = _.findIndex(this.definition, (el) => {
			return el.slug == label;
		});
		var oldType = this.definition[index].type;
		this.definition[index].type = newType;

		return this._writeSchema().catch((err) => {
			this.definition[index].type = oldType;
			throw err;
		});
	};

	Schema.prototype.removeColumn = function(label){
		var index = _.findIndex(this.definition, (el) => {
			return el.label == label;
		});
		var deleted = this.definition.splice(index, 1);

		return this._writeSchema().catch((err) => {
			this.definition.splice(index, 0, ...deleted);
			throw err;
		});
	};

	// Utils
	Schema.prototype._writeSchema = function(){
		return connect.then((db) => {
			return db.collection("_schema").findOneAndUpdate({collectionSlug: this.tableName}, {
				$set: {
					fields: this.definition
				}
			});
		});
	};

	Schema.prototype._validate = function(){
		// Validate database schema with this.definition
		// Return boolean
	};
};

ActiveRecord.prototype.closeConnection = function(){
	// Should only ever be called to terminate the node process
	this._collectionCreated.then((col) => {
		this._db.close();
	}).catch((err) => {
		// BY ANY MEANS NECESSARY
		this._db.close();
	});
};

ActiveRecord.prototype.findBy = function(query){
	return this._collectionCreated.then((col) => {
		return col.findOne(query).then((model) => {
			return Promise.resolve(new this.Model(model, true));
		});
	});
};

ActiveRecord.prototype.where = function(query, orderBy){
	return this._collectionCreated.then((col) => {
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
	return this._collectionCreated.then((col) => {
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
	return this._collectionCreated.then((col) => {
		return col.findOne().then((model) => {
			return Promise.resolve(new this.Model(model, true));
		});
	});
};

module.exports = ActiveRecord;