// Test dependencies
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const utility = require("../utils.js");
const url = utility.url;
const chai = require("chai");
const assert = chai.assert;
const DynamicRecord = require("../../build/main.js");
const DynamicCollection = DynamicRecord.DynamicCollection;
const DynamicSchema = DynamicRecord.DynamicSchema;

// Database specific dependencies
const MongoClient = require("mongodb").MongoClient;
const connect = MongoClient.connect(url, {useUnifiedTopology: true});

// Setup helpers
const utils = new utility.utils(connect);

// Schema definition
const testSchema = Object.freeze(require("../random_table.schema.json"));
const testData = utility.testData;

let Random;

// ------------------ Setups ------------------
// Clear table and insert dummy data
before(async function(){
	await utils.resetTestTables();
	await utils.setupSuite();

	Random = new DynamicRecord({
		tableSlug: testSchema.$id
	});
});

// Close all database connections
after(async function(){
	await Random.closeConnection();
	await utils.dropTestTable();
	await utils.cleanUpSuite();
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("DynamicRecord", function(){
	beforeEach(function(){
		// Fill with dummy data
		return connect.then((client) => {
			const db = client.db();
			return db.collection(testSchema.$id).insertMany(_.cloneDeep(testData));
		});
	});

	afterEach(function(){
		return connect.then((client) => {
			const db = client.db();
			return db.collection(testSchema.$id).deleteMany({});
		});
	});

	// Tests
	describe("Constructor", function(){
		it("should retrieve the specified table or collection from the database", function(){
			assert.equal(Random.schema.tableSlug, testSchema.$id);
			assert.equal(Random.schema.tableName, testSchema.title);
			assert.deepEqual(Random.schema.definition, testSchema.properties);
		});
	});

	describe("findBy()", function(){
		it("should retrieve an entry from the database matching the query", function(){
			return Random.findBy({"string": testData[0].string}).then((model) => {
				assert.equal(model.data.string, testData[0].string, "string property matches test data");
				assert.equal(model.data.int, testData[0].int, "int property matches test data");
				assert.equal(model.data.float, testData[0].float, "float property matches test data");
			});
		});
		it("should return a single object of type DynamicRecord.Model", function(){
			return Random.findBy({"string": testData[0].string}).then((model) => {
				assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
			});
		});
		it("should return null if an entry is not found", function(){
			return Random.findBy({"string": "Not found"}).then((model) => {
				assert.isNull(model, "object is not null");
			});
		});
		it("should populate the _original property of the returned model", function(){
			return Random.findBy({"string": testData[0].string}).then((model) => {
				assert.isNotNull(model._original, "'model._original' is populated");
				assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
			});
		});
	});

	describe("where()", function(){
		it("should retrieve all entries from the database matching the query", function(){
			return Random.where({"wholeNumber": testData[0].wholeNumber}).then((col) => {
				assert.deepInclude(col.data, testData[0], "collection data includes first test data");
				assert.deepInclude(col.data, testData[1], "collection data includes second test data");
				assert.notDeepInclude(col.data, testData[2], "collection data does not include third data");
			});
		});
		it("should return an array descendent of type DynamicCollection", function(){
			return Random.where({"floatingPoint": testData[1].floatingPoint}).then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
			});
		});
		it("should return an empty array descendent if query returns nothing", function(){
			return Random.where({"string": "Not exist"}).then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
				assert.isEmpty(col, "collection is empty");
				assert.isEmpty(col.data, "collection data is empty");
			});
		});
		it("should populate the _original property of all the returned models", function(){
			return Random.where({"float": testData[1].float}).then((col) => {
				_.each(col, (model) => {
					assert.isNotNull(model._original, "'model._original' is populated");
					assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
				});
			});
		});
	});

	describe("all()", function(){
		it("should retrieve all entries from the database", function(){
			return Random.all().then((col) => {
				assert.deepInclude(col.data, testData[0], "collection data includes first test data");
				assert.deepInclude(col.data, testData[1], "collection data includes second test data");
				assert.deepInclude(col.data, testData[2], "collection data includes third test data");
			});
		});
		it("should return an array descendent of type DynamicCollection", function(){
			return Random.all().then((col) => {
				assert.instanceOf(col, Array, "collection is an instance of Array");
				assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
			});
		});
		it("should return an empty DynamicCollection if database is empty", function(){
			return connect.then((client) => {
				const db = client.db();
				return db.collection(testSchema.$id).deleteMany({});
			}).then(() => {
				return Random.all();
			}).then((col) => {
				assert.isEmpty(col, "collection is empty");
			});
		});
		it("should populate the _original property of all the returned models", function(){
			return Random.all().then((col) => {
				_.each(col, (model) => {
					assert.isNotNull(model._original, "'model._original' is populated");
					assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
				});
			});
		});
	});

	describe("first()", function(){
		it("should retrieve one latest entry from the database", function(){
			return Random.first().then((model) => {
				assert.deepEqual(model.data, testData[0], "model should equal testData");
			});
		});
		it("should return a single object of type DynamicRecord.Model", function(){
			return Random.first().then((model) => {
				assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
			});
		});
		it("should return null if an entry is not found", function(){
			return connect.then((client) => {
				const db = client.db();
				return db.collection(testSchema.$id).deleteMany({});
			}).then(() => {
				return Random.first();
			}).then((model) => {
				assert.isNull(model, "'model' is null");
			});
		});
		it("should return n number of values when given n as a parameter", function(){
			return Random.first(2).then((col) => {
				assert.instanceOf(col, DynamicCollection, "resolves to an instance of DynamicCollection");
				assert.lengthOf(col, 2, "has a length of two");
				assert.deepInclude(col.data, testData[0], "retrieved first entry");
				assert.deepInclude(col.data, testData[1], "retrieved second entry");
				assert.notDeepInclude(col.data, testData[2], "not retrieved third entry");
			});
		});
	});
});
// --------------------------------------------