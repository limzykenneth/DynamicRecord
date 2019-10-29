// For setup and clean ups
require("dotenv").config();
const f = require("util").format;
const Promise = require("bluebird");
const _ = require("lodash");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const connect = MongoClient.connect(mongoURL, {useUnifiedTopology: true});

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
	utils.resetTestTables().then(() => {
		connect.then((client) => {
			const db = client.db();
			return db.createCollection(testSchema.$id).then(() => db.collection("_schema"));
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
		return connect.then((client) => {
			return client.close();
		});
	});
});
// --------------------------------------------

// ----------------- Tests --------------------
//-------------------------------------------------------------------//
// Model describes an individual entry in an active record instance  //
//-------------------------------------------------------------------//
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
		beforeEach(function(){
			return connect.then((client) => {
				const db = client.db();
				// Fill with dummy data
				return db.collection(testSchema.$id).insertMany(testData);
			});
		});

		afterEach(function(){
			return connect.then((client) => {
				const db = client.db();
				// Clear out dummy data
				return db.collection(testSchema.$id).deleteMany({});
			});
		});

		// Tests
		it("should insert the corresponding entry in the database if not exist", function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			});
			return model.save().then(() => {
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({
					"string": "Laborum non culpa.",
					"int": 27,
					"float": 6.2831853072
				});
			}).then((m) => {
				assert.isNotNull(m, "returned result is not null");
			});
		});
		it("should update the corresponding entry in the database if exist", function(){
			let model;
			return Random.findBy({"int": 10958}).then((m) => {
				model = m;
				model.data.string = "New string";
				return model.save();
			}).then(() => {
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({"int": 10958});
			}).then((m) => {
				delete m._id;
				assert.deepEqual(m, model.data, "returned result is equal to 'model.data'");
			});
		});
		it("should update the deep copy of the data into _original", function(){
			return Random.findBy({"int": 10958}).then((model) => {
				model.data.string = "New string";
				return model.save();
			}).then((model) => {
				assert.equal(model._original.string, "New string", "string of original is as defined");
			});
		});
		it("should return a rejected Promise if the new model doesn't match the schema definition", function(done){
			let model = new Random.Model();
			model.data.int = 100;
			model.data.float = "Not a float";
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
			Random.findBy({"int": 10958}).then((model) => {
				model.data.int = "Is a string";
				return model.save();
			}).then((model) => {
				done("model.save() is not rejecting a mismatch between data and schema");
			}).catch((err) => {
				// done();
				return Promise.resolve();
			}).then(() => {
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({"testIndex": 2});
			}).then((m) => {
				assert.notEqual(m.int, "Is a string", "`m.int` is not updated in the database");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("destroy()", function(){
		beforeEach(function(){
			return connect.then((client) => {
				const db = client.db();
				return db.collection(testSchema.$id).insertOne({
					"string": "Delete me"
				});
			});
		});

		afterEach(function(){
			return connect.then((client) => {
				const db = client.db();
				return db.collection(testSchema.$id).deleteOne({
					"string": "Delete me"
				});
			});
		});

		it("should delete the corresponding entry in the database", function(){
			let testModel;
			return Random.findBy({"string": "Delete me"}).then((model) => {
				testModel = model;
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({"string": "Delete me"});
			}).then((model) => {
				assert.isNotNull(model, "model is not null");
				assert.equal(model.string, "Delete me", "string of model is defined");
				return testModel.destroy();
			}).then(() => {
				return connect.then((client) => client.db());
			}).then((db) => {
				return db.collection(testSchema.$id).findOne({"string": "Delete me"});
			}).then((model) => {
				assert.isNull(model, "model is null");
			});
		});
		it("should clear remaining data in data and _original object", function(){
			let model;
			return Random.findBy({"string": "Delete me"}).then((m) => {
				model = m;
				return model.destroy();
			}).then(() => {
				assert.isNull(model.data, "data is null");
				assert.isNull(model._original, "original is null");
			});
		});
		it("should throw an error if an entry is not found in the database", function(done){
			Random.findBy({"string": "Not exist"}).then((model) => {
				return model.destroy();
			}).then(() => {
				done(new Error("expected function to throw an error."));
			}).catch((err) => {
				done();
			});
		});
	});
});
// --------------------------------------------