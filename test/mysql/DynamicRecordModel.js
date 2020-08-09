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

// Close all database connections
after(async function(){
	await Random.closeConnection();
	await utils.dropTestTable();
	await utils.cleanUpSuite();
});
// --------------------------------------------

// ----------------- Tests --------------------
//--------------------------------------------------------------------//
// Model describes an individual entry in an dynamic record instance  //
//--------------------------------------------------------------------//
describe("Model", function(){
	describe("Constructor", function(){
		it("should set the data object according to the object passed in", function(){
			let model = new Random.Model(testData[0]);
			assert.exists(model.data, "'model.data' exists");
			assert.deepEqual(model.data, testData[0], "'model.data' is as defined");
		});
		it("should make a deep copy of the object if _preserveOriginal is truthy", function(){
			let model = new Random.Model(testData[0], true);
			assert.exists(model.data, "'model.data' exists");
			assert.exists(model._original, "'model._original' exists");
			assert.deepEqual(model.data, model._original, "'model.data' and 'model._original' are the same");
		});
		it("should have a null _original object if _preserveOriginal is falsy", function(){
			let model = new Random.Model(testData[0], false);
			assert.notDeepEqual(model.data, model._original, "'model.data' and 'model._original' are not the same");
			assert.isNull(model._original, "'model._original' is null");
		});
	});

	describe("save()", function(){
		beforeEach(async function(){
			// Fill with dummy data
			const connection = await connect;
			const fields = [];
			const values = [];

			for(const data of testData){
				const keys = _.map(data, (val, key) => {
					return key;
				}).join(", ");
				const values = _.map(data, (val, key) => {
					return val;
				});
				const query = `INSERT INTO ${testSchema.$id} (${keys}) VALUES (${_.map(values, () => "?").join(", ")})`;
				await connection.execute(query, values);
			}
		});

		afterEach(async function(){
			// Clear out dummy data
			const connection = await connect;
			const fields = [];
			const values = [];
			const query = `DELETE FROM ${testSchema.$id}`;
			await connection.execute(query);
		});

		it("should insert the corresponding entry in the database if not exist", async function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"wholeNumber": 27,
				"floatingPoint": 6.2831853072
			});
			await model.save();

			const connection = await connect;
			const [result] = await connection.execute(`SELECT * FROM ${testSchema.$id} WHERE wholeNumber=27`);
			assert.lengthOf(result, 1, "retuend result is not empty");
			assert.equal(result[0].string, "Laborum non culpa.", "string entry is correct");
			assert.equal(result[0].wholeNumber, 27, "wholeNumber entry is correct");
			assert.equal(result[0].floatingPoint, 6.2831853072, "floatingPoint entry is correct");
		});
		it("should update the corresponding entry in the database if exist");
		it("should update the deep copy of the data into _original", async function(){
			let model = await Random.findBy({"wholeNumber": 10958});
			model.data.string = "New string";
			model = await model.save();
			assert.equal(model._original.string, "New string", "string of original is as defined");
		});
		// it("should return a rejected Promise if the new model doesn't match the schema definition");
		// it("should return a rejected Promise if the updated data doesn't match the schema definition");

		describe("Concurrent saves", function(){
			// it("should end up with the right data at the end of concurrent saves");
			// it("should have the right entry in database at the end of concurrent saves");
		});

		describe("Concurrent writes", function(){
			it("should wait for model to save before trying to delete in concurrent situation");
		});
	});

	// describe("destroy()", function(){
	// 	beforeEach(function(){

	// 	});

	// 	afterEach(function(){

	// 	});

	// 	it("should delete the corresponding entry in the database");
	// 	it("should clear remaining data in data and _original object", async function(){
	// 		let model = await Random.findBy({"string": "Delete me"});
	// 		await model.destroy();
	// 		assert.isNull(model.data, "data is null");
	// 		assert.isNull(model._original, "original is null");
	// 	});
	// 	it("should throw an error if an entry is not found in the database", function(done){
	// 		Random.findBy({"string": "Not exist"}).then((model) => {
	// 			return model.destroy();
	// 		}).then(() => {
	// 			done("expected function to throw an error.");
	// 		}).catch((err) => {
	// 			done();
	// 		});
	// 	});

	// 	describe("Concurrent writes", function(){
	// 		it("should wait for model to save before trying to delete in concurrent situation");
	// 	});
	// });
});