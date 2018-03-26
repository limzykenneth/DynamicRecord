require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");

// Let's get mongodb working first
const connect = require("./mongoConnection.js");

class Schema {
	constructor(){
		this.tableName = null;
		this.tableSlug = null;
		this.definition = [];
	}
}

Schema.prototype.createTable = function(options){
	let tableSlug = options.tableSlug; // String
	let tableName = options.tableName; // String
	let indexColumns = options.indexColumns; // Array
	// Maybe just let the user handle it themselves?
	let autoIndex = options.autoIndex; // Boolean

	if(!tableName){
		tableName = tableSlug;
	}

	return connect.then((db) => {
		return db.createCollection(tableSlug).then((col) => {
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
			throw err;
		});
	}).then(() => {
		if(indexColumns){
			if(Array.isArray(indexColumns)){
				let promises = [];
				_.each(indexColumns, (el, i) => {
					promises.push(this.addIndex({
						name: el.name,
						unique: el.unique
					}));
				});
				return Promise.all(promises);
			}else{
				return this.addIndex({
					name: indexColumns.name,
					unique: indexColumns.unique
				});
			}
		}else{
			return Promise.resolve();
		}
	}).catch((err) => {
		this.tableName = null;
		this.tableSlug = null;
		throw err;
	});
};

// Add index
Schema.prototype.addIndex = function(options){
	let columnName = options.name;
	let unique = options.unique;

	if(unique === undefined){
		unique = true;
	}

	return connect.then((db) => {
		return db.collection(this.tableSlug).createIndex(columnName, {unique: unique});
	}).catch((err) => {
		throw err;
	});
};

// Rename index
Schema.prototype.renameIndex = function(columnName, newColumnName){
	// Maybe drop index then recreate but do consider why you need to do this
};

// Remove index
Schema.prototype.removeIndex = function(columnName){
	return connect.then((db) => {
		return db.collection(this.tableSlug).dropIndex(columnName);
	}).catch((err) => {
		throw err;
	});
};

// Auto-increment index
// Maybe just let the user handle it themselves?


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