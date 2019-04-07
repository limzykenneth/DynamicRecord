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
after(function(done){
	utils.dropTestTable().then(() => {
		Random.closeConnection();
		connect.then((db) => {
			db.close();
			done();
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
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			});
			assert.exists(model.data, "'model.data' exists");
			assert.deepEqual(model.data, {
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			}, "'model.data' is as defined");
		});
		it("should make a deep copy of the object if _preserveOriginal is truthy", function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			}, true);
			assert.exists(model.data, "'model.data' exists");
			assert.exists(model._original, "'model._original' exists");
			assert.deepEqual(model.data, model._original, "'model.data' and 'model._original' are the same");
		});
		it("should have a null _original object if _preserveOriginal is falsy", function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			}, false);
			assert.notDeepEqual(model.data, model._original, "'model.data' and 'model._original' are not the same");
			assert.isNull(model._original, "'model._original' is null");
		});
	});

	describe("save()", function(){
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
			connect.then((db) => {
				// Fill with dummy data
				return db.collection(testSchema.$id).insertMany(testData);
			}).then((r) => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		after(function(done){
			connect.then((db) => {
				// Clear out dummy data
				return db.collection(testSchema.$id).deleteMany({});
			}).then((r) => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		// Tests
		it("should insert the corresponding entry in the database if not exist", function(done){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			});
			model.save().then((col) => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).findOne({
						"string": "Laborum non culpa.",
						"int": 27,
						"float": 6.2831853072
					});
				});
			}).then((m) => {
				assert.isNotNull(m, "returned result is not null");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should update the corresponding entry in the database if exist", function(done){
			let model;
			Random.findBy({"int": 10958}).then((m) => {
				model = m;
				model.data.string = "New string";
				return model.save();
			}).then((col) => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).findOne({"int": 10958});
				});
			}).then((m) => {
				assert.deepEqual(m, model.data, "returned result is equal to 'model.data'");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should update the deep copy of the data into _original", function(done){
			let model;
			Random.findBy({"int": 10958}).then((m) => {
				model = m;
				model.data.string = "New string";
				return model.save();
			}).then((col) => {
				assert.equal(model._original.string, "New string", "string of original is as defined");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("destroy()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				db.collection(testSchema.$id).insertOne({
					"string": "Delete me"
				}).then((r) => {
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				db.collection(testSchema.$id).deleteOne({
					"string": "Delete me"
				}).then((r) => {
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});

		it("should delete the corresponding entry in the database", function(done){
			let testModel;
			Random.findBy({"string": "Delete me"}).then((model) => {
				testModel = model;
				return connect.then((db) => {
					return db.collection(testSchema.$id).findOne({"string": "Delete me"});
				});
			}).then((model) => {
				assert.isNotNull(model, "model is not null");
				assert.equal(model.string, "Delete me", "string of model is defined");
				return testModel.destroy();
			}).then(() => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).findOne({"string": "Delete me"});
				});
			}).then((model) => {
				assert.isNull(model, "model is null");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should clear remaining data in data and _original object", function(done){
			let model;
			Random.findBy({"string": "Delete me"}).then((m) => {
				model = m;
				return model.destroy();
			}).then(() => {
				assert.isNull(model.data, "data is null");
				assert.isNull(model._original, "original is null");
				done();
			}).catch((err) => {
				done(err);
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