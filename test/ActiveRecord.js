// For setup and clean ups
require("dotenv").config();
const f = require("util").format;
const Promise = require("bluebird");
const _ = require("lodash");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const connect = MongoClient.connect(mongoURL);

// Test dependencies
const ActiveRecord = require("../build/ActiveRecord.js");
const ActiveCollection = require("../build/ActiveCollection.js");
const utils = new (require("./utils.js"))(connect);
const chai = require("chai");
const assert = chai.assert;

let Random;

// ------------------ Setups ------------------
// Clear table and insert dummy data
before(function(done){
	utils.dropTestTable(function(reply){
		Random = new ActiveRecord({
			tableSlug: "random_table",
			tableName: "Random Table"
		});
		done();
	});
});

// Close all database connections
after(function(done){
	utils.dropTestTable(function(reply){
		Random.closeConnection();
		connect.then((db) => {
			db.close();
		});
		done();
	});
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("ActiveRecord", function(){
	// Data to be inserted into database for testing
	// Each element in array correspond to an entry in database
	// Objects keys are just for reference, not meant to represent actual types
	const testData = [
		{
			"string": "Velit tempor.",
			"int": 42,
			"float": 3.1415926536
		},
		{
			"string": "Fugiat laboris cillum quis pariatur.",
			"int": 42,
			"float": 2.7182818285
		},
		{
			"string": "Reprehenderit sint.",
			"int": 10958,
			"float": 2.7182818285
		}
	];

	before(function(done){
		// Fill with dummy data
		connect.then((db) => {
			return db.collection("random_table").insertMany(testData);
		}).then((r) => {
			done();
		}).catch((err) => {
			done(err);
		});
	});

	after(function(done){
		connect.then((db) => {
			return db.collection("random_table").deleteMany({});
		}).then((r) => {
			done();
		}).catch((err) => {
			done(err);
		});
	});

	// Tests
	describe("Constructor", function(){
		it("should retrieve the specified table or collection from the database");
	});

	describe("findBy()", function(){
		it("should retrieve an entry from the database matching the query", function(done){
			Random.findBy({"string": testData[0].string}).then((model) => {
				assert.equal(model.data.string, testData[0].string, "string property matches test data");
				assert.equal(model.data.int, testData[0].int, "int property matches test data");
				assert.equal(model.data.float, testData[0].float, "float property matches test data");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return a single object of type ActiveRecord.Model", function(done){
			Random.findBy({"string": testData[0].string}).then((model) => {
				assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return null if an entry is not found", function(done){
			Random.findBy({"string": "Not found"}).then((model) => {
				assert.isNull(model.data, "data object is not null");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("where()", function(){
		it("should retrieve all entries from the database matching the query", function(done){
			Random.where({"int": testData[0].int}).then((col) => {
				assert.deepInclude(col.data, testData[0], "collection data includes first test data");
				assert.deepInclude(col.data, testData[1], "collection data includes second test data");
				assert.notDeepInclude(col.data, testData[2], "collection data does not include third data");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an array descendent of type ActiveCollection", function(done){
			Random.where({"float": testData[1].float}).then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, ActiveCollection, "collection is an instance of ActiveCollection");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an empty array descendent if query returns nothing", function(done){
			Random.where({"string": "Not exist"}).then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, ActiveCollection, "collection is an instance of ActiveCollection");
				assert.isEmpty(col, "collection is empty");
				assert.isEmpty(col.data, "collection data is empty");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("all()", function(){
		it("should retrieve all entries from the database", function(done){
			Random.all().then((col) => {
				assert.deepInclude(col.data, testData[0], "collection data includes first test data");
				assert.deepInclude(col.data, testData[1], "collection data includes second test data");
				assert.deepInclude(col.data, testData[2], "collection data includes third test data");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an array descendent of type ActiveCollection", function(done){
			Random.all().then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, ActiveCollection, "collection is an instance of ActiveCollection");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an empty array descendent if database is empty");
	});

	describe("first()", function(){
		it("should retrieve one latest entry from the database", function(done){
			Random.first().then((model) => {
				assert.deepEqual(model.data, testData[0], "model should equal testData");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return a single object of type ActiveRecord.Model", function(done){
			Random.first().then((model) => {
				assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return null if an entry is not found");
	});
});
// --------------------------------------------