require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");

// Let's get mongodb working first
const connect = require("./mongoConnection.js");

let Schema = this.Schema = function(){
	this.tableName = null;
	this.tableSlug = null;
	this.definition = [];
};

Schema.prototype.createTable = function(tableName, tableSlug=null){
	if(tableSlug === null){
		tableSlug = tableName;
	}

	return connect.then((db) => {
		return db.createCollection(tableName).then((col) => {
			this.tableName = tableName;
			this.tableSlug = tableSlug;
			return Promise.resolve(db);
		});
	}).then((db) => {
		return db.collection("_schema").insertOne({
			collectionSlug: this.tableSlug,
			collectionName: this.tableName,
			fields: []
		}).catch((err) => {
			this.tableName = null;
			this.tableSlug = null;
			throw err;
		});
	}).catch((err) => {
		throw err;
	});
};

// Read and define schema
Schema.prototype.read = function(tableSlug){
	return connect.then((db) => {
		return db.collection("_schema").findOne({collectionSlug: tableSlug});
	}).then((data) => {
		this.tableName = data.collectionName;
		this.tableSlug = data.collectionSlug;
		this.definition = data.fields;

		return Promise.resolve();
	}).catch((err) => {
		throw err;
	});
};

Schema.prototype.define = function(tableName, tableSlug, def){
	var oldTableName = this.tableName;
	var oldTableSlug = this.tableSlug;
	var oldDef = this.definition;
	this.tableName = tableName;
	this.tableSlug = tableSlug;
	this.definition = def;

	// Create schema in RMDB, do nothing in NoSQL
	return connect.then((db) => {
		return db.collection("_schema").insertOne({
			collectionSlug: tableSlug,
			collectionName: tableName,
			fields: def
		});
	}).catch((err) => {
		this.tableName = oldTableName;
		this.tableSlug = oldTableSlug;
		this.definition = oldDef;
		throw err;
	});
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
		return db.collection("_schema").findOneAndUpdate({collectionSlug: this.tableSlug}, {
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

module.exports = Schema;