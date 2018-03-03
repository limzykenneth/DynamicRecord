require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const f = require("util").format;

// Let's get mongodb working first
const MongoClient = require("mongodb").MongoClient;
let mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
let connect = MongoClient.connect(mongoURL, {poolSize: 10});


class ActiveCollection extends Array{
	init(){
		_.each(this, function(el, i){
			this.data.push(el.data);
		});
	}
}

let ActiveRecord = function(tableName){
	var _collectionCreated = this._collectionCreated = connect.then((db) => {
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

	Model.prototype.validate = function(){

	};
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