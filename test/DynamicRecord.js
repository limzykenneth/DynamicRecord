// For setup and clean ups
require("dotenv").config();
const f = require("util").format;
const Promise = require("bluebird");
const _ = require("lodash");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const connect = MongoClient.connect(mongoURL);

// Test dependencies
const DynamicRecord = require("../build/DynamicRecord.js");
const DynamicCollection = require("../build/DynamicCollection.js");
const utils = new (require("./utils.js"))(connect);
const chai = require("chai");
const assert = chai.assert;

// Schema definition
const testSchema = Object.freeze(require("./random_table.schema.json"));
// Data to be inserted into database for testing
// Each element in array correspond to an entry in database
// Objects keys are just for reference, not meant to represent actual types
const testData = Object.freeze([
	{
		"string": "Velit tempor.",
		"int": 42,
		"float": 3.1415926536,
		"testIndex": 0
	},
	{
		"string": "Fugiat laboris cillum quis pariatur.",
		"int": 42,
		"float": 2.7182818285,
		"testIndex": 1
	},
	{
		"string": "Reprehenderit sint.",
		"int": 10958,
		"float": 2.7182818285,
		"testIndex": 2
	}
]);

let Random;

// ------------------ Setups ------------------
// Clear table and insert dummy data
before(function(done){
	utils.dropTestTable().then(() => {
		connect.then((db) => {
			return db.createCollection(testSchema.$id).then(() => Promise.resolve(db));
		}).then((db) => {
			return db.createCollection("_schema");
		}).then((col) => {
			const databaseInsert = _.cloneDeep(testSchema);
			databaseInsert._$id = databaseInsert.$id;
			databaseInsert._$schema = databaseInsert.$schema;
			delete databaseInsert.$id;
			delete databaseInsert.$schema;
			return col.insertOne(databaseInsert);
		}).then(() => {
			Random = new DynamicRecord({
				tableSlug: testSchema.$id
			});
			done();
		});
	});
});

// Close all database connections
after(function(){
	return utils.dropTestTable().then(() => {
		return Random.closeConnection();
	}).then(() => {
		return connect.then((db) => {
			return db.close();
		});
	});
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("DynamicRecord", function(){
	before(function(done){
		// Fill with dummy data
		connect.then((db) => {
			return db.collection(testSchema.$id).insertMany(testData);
		}).then((r) => {
			done();
		}).catch((err) => {
			done(err);
		});
	});

	after(function(done){
		connect.then((db) => {
			return db.collection(testSchema.$id).deleteMany({});
		}).then((r) => {
			done();
		}).catch((err) => {
			done(err);
		});
	});

	// Tests
	describe("Constructor", function(){
		it("should retrieve the specified table or collection from the database", function(done){
			assert.equal(Random.schema.tableSlug, testSchema.$id);
			assert.equal(Random.schema.tableName, testSchema.title);
			assert.deepEqual(Random.schema.definition, testSchema.properties);
			done();
		});
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
		it("should return a single object of type DynamicRecord.Model", function(done){
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
		it("should populate the _original property of the returned model", function(done){
			Random.findBy({"string": testData[0].string}).then((model) => {
				assert.isNotNull(model._original, "'model._original' is populated");
				assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
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
		it("should return an array descendent of type DynamicCollection", function(done){
			Random.where({"float": testData[1].float}).then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an empty array descendent if query returns nothing", function(done){
			Random.where({"string": "Not exist"}).then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
				assert.isEmpty(col, "collection is empty");
				assert.isEmpty(col.data, "collection data is empty");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should populate the _original property of all the returned models", function(done){
			Random.where({"float": testData[1].float}).then((col) => {
				_.each(col, (model) => {
					assert.isNotNull(model._original, "'model._original' is populated");
					assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
				});
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
		it("should return an array descendent of type DynamicCollection", function(done){
			Random.all().then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an empty DynamicCollection if database is empty");
		it("should populate the _original property of all the returned models", function(done){
			Random.all().then((col) => {
				_.each(col, (model) => {
					assert.isNotNull(model._original, "'model._original' is populated");
					assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
				});
				done();
			}).catch((err) => {
				done(err);
			});
		});
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
		it("should return a single object of type DynamicRecord.Model", function(done){
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