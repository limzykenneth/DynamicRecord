// For setup and clean ups
require("dotenv").config();
const f = require("util").format;
const Promise = require("bluebird");
const _ = require("lodash");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const connect = MongoClient.connect(mongoURL);

// Test dependencies
const ActiveRecord = require("../index.js");
const ActiveCollection = require("../ActiveCollection");
const chai = require("chai");
const assert = chai.assert;

let Random;
// Clear table and insert dummy data
before(function(done){
	dropTestTable(function(reply){
		Random = new ActiveRecord({
			tableSlug: "random_table",
			tableName: "Random Table"
		});
		done();
	});
});

// Close all database connections
after(function(done){
	dropTestTable(function(reply){
		Random.closeConnection();
		connect.then((db) => {
			db.close();
		});
		done();
	});
});

describe("ActiveCollection", function(){
	let col;
	beforeEach(function(){
		col = new ActiveCollection();
	});
	afterEach(function(){
		col = null;
	});

	it("should be an instance of Array", function(){
		assert.instanceOf(col, Array, "collection is an instance of Array");
	});
	it("should have the same methods as Array", function(){
		assert.isFunction(col.push, "collection has function push");
		assert.isFunction(col.pop, "collection has function pop");
		assert.isFunction(col.slice, "collection has function slice");
		assert.isFunction(col.splice, "collection has function splice");
		assert.isFunction(col.map, "collection has function map");
		assert.isFunction(col.reduce, "collection has function reduce");
	});
	it("should have a property 'data' that returns a regular array of data", function(){
		assert.exists(col.data, "collection data exist");
		assert.isArray(col.data, "collection data is an array");
		assert.notInstanceOf(col.data, ActiveCollection, "collection data is not an instance of ActiveCollection");
	});
	it("should update 'data' property whenever its data is updated", function(){
		col.push(new Random.Model({
			"string": "Magna dolor."
		}));

		assert.deepInclude(col.data, {
			"string": "Magna dolor."
		}, "collection data include pushed entry");
	});
});

// Utils
function dropTestTable(cb){
	connect.then((db) => {
		db.collection("random_table").drop().then(cb).catch((err) => {
			if(err.message == "ns not found"){
				cb();
			}else{
				console.error(err);
			}
		});
	});
}