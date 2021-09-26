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
const mysql = require("mysql2/promise");
const connect = mysql.createConnection(url);

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

after(async function(){
	await Random.closeConnection();
	await utils.dropTestTable();
	await utils.cleanUpSuite();
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("DynamicRecord", function(){
	beforeEach(async function(){
		// Fill with dummy data
		const connection = await connect;
		const fields = [];
		const values = [];
		testData.forEach((data) => {
			_.each(data, (val, key) => {
				console.error("We stopped here");
			});
		});
		// connection.execute(`INSERT INTO ${testSchema.$id} () VALUES ()`, []);
	});

	afterEach(function(){

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
		it("should retrieve an entry from the database matching the query", async function(){
			const model = await Random.findBy({"string": testData[0].string});
			assert.equal(model.data.string, testData[0].string, "string property matches test data");
			assert.equal(model.data.int, testData[0].int, "int property matches test data");
			assert.equal(model.data.float, testData[0].float, "float property matches test data");
		});
		it("should return a single object of type DynamicRecord.Model", async function(){
			const model = await Random.findBy({"string": testData[0].string});
			assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
		});
		it("should return null if an entry is not found", async function(){
			const model = await Random.findBy({"string": "Not found"});
			assert.isNull(model, "object is not null");
		});
		it("should populate the _original property of the returned model", async function(){
			const model = await  Random.findBy({"string": testData[0].string});
			assert.isNotNull(model._original, "'model._original' is populated");
			assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
		});
	});

	describe("where()", function(){
		it("should retrieve all entries from the database matching the query", async function(){
			const col = await Random.where({"wholeNumber": testData[0].wholeNumber});
			assert.deepInclude(col.data, testData[0], "collection data includes first test data");
			assert.deepInclude(col.data, testData[1], "collection data includes second test data");
			assert.notDeepInclude(col.data, testData[2], "collection data does not include third data");
		});
		it("should return an array descendent of type DynamicCollection", async function(){
			const col = await Random.where({"floatingPoint": testData[1].floatingPoint});
			assert.instanceOf(col, Array, "collection is an instance of Array");
			assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
		});
		it("should return an empty array descendent if query returns nothing", async function(){
			const col = await Random.where({"string": "Not exist"});
			assert.instanceOf(col, Array, "collection is an instance of Array");
			assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
			assert.isEmpty(col, "collection is empty");
			assert.isEmpty(col.data, "collection data is empty");
		});
		it("should populate the _original property of all the returned models", async function(){
			const col = await Random.where({"float": testData[1].float});
			col.forEach((model) => {
				assert.isNotNull(model._original, "'model._original' is populated");
				assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
			});
		});
		it("should return maximum of specified number of entries when 'limit' query option is supplied", async function(){
			const col = await Random.where({"wholeNumber": testData[0].wholeNumber}, {limit: 1});
			assert.lengthOf(col, 1, "collection only contains 1 entry");
		});
		it("should offset the starting query position if 'offset' query option is specified", async function(){
			const col = await Random.where({"wholeNumber": testData[0].wholeNumber}, {offset: 1});
			assert.deepEqual(col.data[0], testData[1], "collection data is offset by 1");
		});
		it("should return entries sorted according to provided 'sort' query option", async function(){
			let col = await Random.where({"wholeNumber": testData[0].wholeNumber}, {
				sort: {
					floatingPoint: "ASC"
				}
			});
			assert.deepEqual(col.data[0], testData[1], "collection order matches expected order");
			assert.deepEqual(col.data[1], testData[0], "collection order matches expected order");

			col = await Random.where({"floatingPoint": testData[1].floatingPoint}, {
				sort: {
					wholeNumber: "DESC"
				}
			});
			assert.deepEqual(col.data[0], testData[2], "collection order matches expected order");
			assert.deepEqual(col.data[1], testData[1], "collection order matches expected order");
		});
	});

	describe("all()", function(){
		it("should retrieve all entries from the database", async function(){
			const col = await Random.all();
			assert.deepInclude(col.data, testData[0], "collection data includes first test data");
			assert.deepInclude(col.data, testData[1], "collection data includes second test data");
			assert.deepInclude(col.data, testData[2], "collection data includes third test data");
		});
		it("should return an array descendent of type DynamicCollection", async function(){
			const col = await Random.all();
			assert.instanceOf(col, Array, "collection is an instance of Array");
			assert.instanceOf(col, DynamicCollection, "collection is an instance of DynamicCollection");
		});
		it("should return an empty DynamicCollection if database is empty");
		it("should populate the _original property of all the returned models", async function(){
			const col = await Random.all();
			col.forEach((model) => {
				assert.isNotNull(model._original, "'model._original' is populated");
				assert.deepEqual(model.data, model._original, "'model._original' is a copy of 'model.data'");
			});
		});
	});

	describe("first()", function(){
		it("should retrieve one latest entry from the database", async function(){
			const model = await Random.first();
			assert.deepEqual(model.data, testData[0], "model should equal testData");
		});
		it("should return a single object of type DynamicRecord.Model", async function(){
			const model = await Random.first();
			assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
		});
		it("should return null if an entry is not found");
		it("should return n number of values when given n as a parameter", async function(){
			const col = await Random.first(2);
			assert.instanceOf(col, DynamicCollection, "resolves to an instance of DynamicCollection");
			assert.lengthOf(col, 2, "has a length of two");
			assert.deepEqual(col.data[0], testData[0], "retrieved first entry");
			assert.deepEqual(col.data[1], testData[1], "retrieved second entry");
			assert.notDeepInclude(col.data, testData[2], "not retrieved third entry");
		});
	});

	describe("last()", function(){
		it("should retrieve one latest entry from the database", async function(){
			const model = await Random.last();
			assert.deepEqual(model.data, testData[2], "model is last item in testData");
		});
		it("should return a single object of type DynamicRecord.Model", async function(){
			const model = await Random.last();
			assert.instanceOf(model, Random.Model, "'model' is and instance of 'Random.Model'");
		});
		it("should return null if an entry is not found", async function(){
			const client = await connect;
			const db = client.db();

			await db.collection(testSchema.$id).deleteMany({});

			const model = await Random.last();
			assert.isNull(model, "'model' is null");
		});
		it("should return n number of values when given n as a parameter", async function(){
			const col = await Random.last(2);
			assert.instanceOf(col, DynamicCollection, "resolves to an instance of DynamicCollection");
			assert.lengthOf(col, 2, "has a length of two");
			assert.deepEqual(col.data[0], testData[2], "retrieved third entry");
			assert.deepEqual(col.data[1], testData[1], "retrieved second entry");
			assert.notDeepInclude(col.data, testData[0], "not retrieved first entry");
		});
	});
});