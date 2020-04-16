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
describe("DynamicCollection", function(){
	let col;
	beforeEach(function(){
		col = new DynamicCollection();
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
		assert.notInstanceOf(col.data, DynamicCollection, "collection data is not an instance of DynamicCollection");
	});
	it("should update 'data' property whenever its data is updated", function(){
		col.push(new Random.Model({
			"string": "Magna dolor."
		}));

		assert.deepInclude(col.data, {
			"string": "Magna dolor."
		}, "collection data include pushed entry");
	});

	describe("saveAll()", function(){
		let col;
		const testData = [
			{
				"string": "Velit tempor.",
				"wholeNumber": 42,
				"floatingPoint": 3.1415926536
			},
			{
				"string": "Fugiat laboris cillum quis pariatur.",
				"wholeNumber": 42,
				"floatingPoint": 2.7182818285
			},
			{
				"string": "Reprehenderit sint.",
				"wholeNumber": 10958,
				"floatingPoint": 2.7182818285
			}
		];
		beforeEach(function(){
			col = new DynamicCollection(Random.Model, ...testData);
		});

		afterEach(function(){
			return utils.resetTestTables();
		});

		it("should call save function of all the models in the collection", function(){
			return col.saveAll().then((res) => {
				return connect.then((client) => {
					const db = client.db();
					return db.collection(testSchema.$id).find().toArray();
				});
			}).then((res) => {
				_.each(col.data, (el) => {
					assert.deepInclude(res, el);
				});
			});
		});

		describe("autoIncrement", function(){
			beforeEach(function(){
				return connect.then((client) => {
					const db = client.db();
					return db.collection("_counters").insertOne({
						"_$id": testSchema.$id,
						sequences: {
							wholeNumber: 0
						}
					});
				});
			});

			afterEach(function(){
				return connect.then((client) => {
					const db = client.db();
					return db.collection("_counters").deleteOne({"_$id": testSchema.$id});
				});
			});

			it("should set the autoincrementing index correctly", function(){
				col.forEach((model) => {
					delete model.data.wholeNumber;
				});
				return col.saveAll().then((res) => {
					return connect.then((client) => {
						const db = client.db();
						return db.collection(testSchema.$id).find().toArray();
					});
				}).then((res) => {
					for(let i=0; i<res.length; i++){
						assert.equal(res[i].wholeNumber, i+1, `database entry has auto increment value ${i+1}`);
					}
					for(let i=0; i<col.length; i++){
						assert.equal(col[i].data.wholeNumber, i+1, `collection entry has auto increment value ${i+1}`);
					}
				});
			});
		});
	});

	describe("dropAll()", function(){
		let col;
		const testData = [
			{
				"string": "Velit tempor.",
				"wholeNumber": 42,
				"floatingPoint": 3.1415926536
			},
			{
				"string": "Fugiat laboris cillum quis pariatur.",
				"wholeNumber": 42,
				"floatingPoint": 2.7182818285
			},
			{
				"string": "Reprehenderit sint.",
				"wholeNumber": 10958,
				"floatingPoint": 2.7182818285
			}
		];
		beforeEach(function(){
			col = new DynamicCollection(Random.Model, ...testData);
		});

		afterEach(function(){
			return utils.resetTestTables();
		});

		it("should call save function of all the models in the collection", function(){
			return col.saveAll().then((res) => {
				return col.dropAll();
			}).then(() => {
				return connect.then((client) => {
					const db = client.db();
					return db.collection(testSchema.$id).find().toArray();
				});
			}).then((res) => {
				assert.lengthOf(res, 0, "collection doesn't exist in database");
				_.each(col.data, (el) => {
					assert.isNull(el, "models in collection are emptied out");
				});
			});
		});
	});
});
// --------------------------------------------