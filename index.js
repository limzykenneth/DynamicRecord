require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const f = require("util").format;
const fs = Promise.promisifyAll(require("fs"));
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

	// Read and define schema
	Schema.prototype.read = function(tableName){
		return fs.readFileAsync(`./schemas/schema_${tableName}.json`).then((data) => {
			this.tableName = tableName;
			this.definition = JSON.parse(data);

			return Promise.resolve();
		}).catch((err) => {
			throw err;
		});
	};

	Schema.prototype.define = function(tableName, def){
		// Create schema in RMDB, do nothing in NoSQL

		// Write schemas definition to schemas.json file
		// schemas.json must have parity with database schema
		var oldTableName = this.tableName;
		var oldDef = this.definition;
		this.tableName = tableName;
		this.definition = def;

		return this._saveSchemaFile().catch((err) => {
			this.tableName = oldTableName;
			this.definition = oldDef;
			throw err;
		});
	};

	Schema.prototype.restore = function(){
		this.read();

		// Populate columns in RDB with columns
	};

	Schema.prototype.createTable = function(tableName){
		return connect.then((db) => {
			return db.createCollection(tableName).then((col) => {
				this.tableName = tableName;
				return Promise.resolve(col);
			});
		}).then((col) => {
			return fs.writeFileAsync(`./schemas/schema_${this.tableName}.json`, "")
				.catch((err) => {
					throw err;
				});
		});
	};

	// Columns functions
	Schema.prototype.addColumn = function(label, type){
		// RDB need to add the column then do the rest


		this.definition.push({
			label,
			type
		});

		return this._saveSchemaFile().catch((err) => {
			this.definition.pop();
			throw err;
		});
	};

	Schema.prototype.renameColumn = function(label, newLabel){
		// RDB implementation


		var index = _.findIndex(this.definition, (el) => {
			return el.label = label;
		});

		this.definition[index].label = newLabel;

		return this._saveSchemaFile().catch((err) => {
			this.definition[index].label = label;
			throw err;
		});
	};

	Schema.prototype.changeColumnType = function(label, newType){
		// RDB implementation

		var index = _.findIndex(this.definition, (el) => {
			return el.label = label;
		});
		var oldType = this.definition[index].type;
		this.definition[index].type = newType;

		return this._saveSchemaFile().catch((err) => {
			this.definition[index].type = oldType;
			throw err;
		});
	};

	Schema.prototype.removeColumn = function(label){
		// RDB implementation


		var index = _.findIndex(this.definition, (el) => {
			return el.label = label;
		});
		var deleted = this.definition.splice(index, 1);

		return this._saveSchemaFile().catch((err) => {
			this.definition.splice(index, 0, ...deleted);
			throw err;
		});
	};

	// Utils
	Schema.prototype._saveSchemaFile = function(){
		if(this.tableName){
			return fs.writeFileAsync(`./schemas/schema_${this.tableName}.json`, JSON.stringify(this.definition));
		}else{
			throw new Error("Schema must first be defined or read from file");
		}
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

			var results = [];
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
			results.init();

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