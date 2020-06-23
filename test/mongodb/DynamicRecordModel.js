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
	await DynamicRecord.closeConnection();
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
			const client = await connect;
			const db = client.db();
			// Fill with dummy data
			await db.collection(testSchema.$id).insertMany(testData);
		});

		afterEach(async function(){
			const client = await connect;
			const db = client.db();
			// Clear out dummy data
			await db.collection(testSchema.$id).deleteMany({});
		});

		it("should insert the corresponding entry in the database if not exist", async function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"wholeNumber": 27,
				"floatingPoint": 6.2831853072
			});
			await model.save();

			const client = await connect;
			const db = client.db();

			const m = await db.collection(testSchema.$id).findOne({
				"string": "Laborum non culpa.",
				"wholeNumber": 27,
				"floatingPoint": 6.2831853072
			});
			assert.isNotNull(m, "returned result is not null");
		});
		it("should update the corresponding entry in the database if exist", async function(){
			let model;
			const m = await Random.findBy({"wholeNumber": 10958});
			model = m;
			model.data.string = "New string";
			await model.save();

			const client = await connect;
			const db = client.db();

			const res = await db.collection(testSchema.$id).findOne({"wholeNumber": 10958});
			delete res._id;
			assert.deepEqual(res, model.data, "returned result is equal to 'model.data'");
		});
		it("should update the deep copy of the data into _original", async function(){
			let model = await Random.findBy({"wholeNumber": 10958});
			model.data.string = "New string";
			model = await model.save();
			assert.equal(model._original.string, "New string", "string of original is as defined");
		});
		it("should return a rejected Promise if the new model doesn't match the schema definition", function(done){
			let model = new Random.Model();
			model.data.wholeNumber = 100;
			model.data.floatingPoint = "Not a float";
			model.data.string = "Surely a string";
			model.data.testIndex = "4";
			model.save().then(() => {
				done("model.save() is not rejecting a mismatch between data and schema");
			}).catch(() => {
				return Promise.resolve();
			}).then(() => {
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({"testIndex": 4});
			}).then((m) => {
				assert.isNull(m, "model is not saved in the database");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return a rejected Promise if the updated data doesn't match the schema definition", function(done){
			Random.findBy({"wholeNumber": 10958}).then((model) => {
				model.data.wholeNumber = "Is a string";
				return model.save();
			}).then((model) => {
				done("model.save() is not rejecting a mismatch between data and schema");
			}).catch((err) => {
				return Promise.resolve();
			}).then(() => {
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({"testIndex": 2});
			}).then((m) => {
				assert.notEqual(m.wholeNumber, "Is a string", "`m.wholeNumber` is not updated in the database");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("destroy()", function(){
		beforeEach(async function(){
			const client = await connect;
			const db = client.db();
			await db.collection(testSchema.$id).insertOne({
				"string": "Delete me"
			});
		});

		afterEach(async function(){
			const client = await connect;
			const db = client.db();
			await db.collection(testSchema.$id).deleteOne({
				"string": "Delete me"
			});
		});

		it("should delete the corresponding entry in the database", async function(){
			const client = await connect;
			const db = client.db();

			const model = await Random.findBy({"string": "Delete me"});
			assert.isNotNull(model, "model is not null");
			assert.equal(model.data.string, "Delete me", "string of model is defined");

			await model.destroy();

			const res = await db.collection(testSchema.$id).findOne({"string": "Delete me"});
			assert.isNull(res, "model is null");
		});
		it("should clear remaining data in data and _original object", async function(){
			const model = await Random.findBy({"string": "Delete me"});
			await model.destroy();
			assert.isNull(model.data, "data is null");
			assert.isNull(model._original, "original is null");
		});
		it("should throw an error if an entry is not found in the database", function(done){
			Random.findBy({"string": "Not exist"}).then((model) => {
				return model.destroy();
			}).then(() => {
				done("expected function to throw an error.");
			}).catch((err) => {
				done();
			});
		});
	});
});
// --------------------------------------------