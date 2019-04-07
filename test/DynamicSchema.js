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
describe("Schema", function(){
	// Tests
	describe("createTable()", function(){
		beforeEach(function(){
			return utils.dropTestTable();
		});

		afterEach(function(done){
			connect.then((db) => {
				var promises = [db.dropCollection("_schema"), db.dropCollection(testSchema.$id)];
				return Promise.all(promises);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should create an empty table or collection in the database", function(done){
			let table = Random.Schema;
			table.createTable(testSchema).then((col) => {
				return connect.then((db) => {
					return db.listCollections().toArray();
				});
			}).then((cols) => {
				// List all collections and find the newly created collection
				let result = _.find(cols, function(el){
					return el.name == testSchema.$id;
				});
				assert.exists(result, "collection exists in database");

				// Check for entry in schema
				return connect.then((db) => {
					return db.collection("_schema").findOne({_$id: testSchema.$id});
				});
			}).then((col) => {
				assert.isNotNull(col);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should create an empty table or collection with provided index", function(done){
			let table = Random.Schema;
			table.createTable(testSchema).then(() => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).indexExists("int");
				});
			}).then((res) => {
				assert.isTrue(res);
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("addIndex()", function(){
		// Instance of DynamicSchema used for testing
		let table;

		beforeEach(function(done){
			utils.dropTestTable().then((reply) => {
				table = Random.Schema;
				table.createTable(testSchema).then(() => {
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});
		afterEach(function(done){
			connect.then((db) => {
				var promises = [db.dropCollection("_schema"), db.dropCollection(testSchema.$id), db.dropCollection("_counters")];
				return Promise.all(promises);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should create a new index", function(done){
			table.addIndex({
				name: "testIndex"
			}, true).then(() => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).indexExists("testIndex");
				});
			}).then((res) => {
				assert.isTrue(res, "index exists in database");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should make the index unique by default", function(done){
			table.addIndex({
				name: "testIndex"
			}).then(() => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).listIndexes().toArray();
				});
			}).then((res) => {
				var index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isTrue(index.unique, "index is marked as unique");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should not make the index unique if passed false to unique", function(done){
			table.addIndex({
				name: "testIndex",
				unique: false
			}).then(() => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).listIndexes().toArray();
				});
			}).then((res) => {
				var index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isNotOk(index.unique, "index is not marked as unique");
				done();
			}).catch((err) => {
				done(err);
			});
		});

		describe("auto increment", function(){
			it("should create an entry in _counters collection if set as auto increment", function(done){
				table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					return connect.then((db) => {
						return db.collection("_counters").findOne({_$id: testSchema.$id});
					});
				}).then((res) => {
					assert.isNotNull(res, "entry not found in _counters collection");
					assert.isDefined(res.sequences, "entry not defined correctly");
					assert.strictEqual(res.sequences.testIndex, 0, "entry not initialized correctly");
					done();
				}).catch((err) => {
					done(err);
				});
			});
			it("should make the index unique if set as auto increment", function(done){
				table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					return connect.then((db) => {
						return db.collection(testSchema.$id).listIndexes().toArray();
					});
				}).then((res) => {
					var index = _.find(res, function(el){
						return el.name == "testIndex";
					});
					assert.isTrue(index.unique, "index is marked as unique");
					done();
				}).catch((err) => {
					done(err);
				});
			});
			// Following potentially tested in DynamicRecordModel.js
			it("should increment the counter when a new entry is added", function(done){
				table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					let model = new Random.Model({
						"string": "Laborum non culpa.",
						"int": 27,
						"float": 6.2831853072
					});

					return model.save();
				}).then((col) => {
					return connect.then((db) => {
						return db.collection(testSchema.$id).findOne({
							"string": "Laborum non culpa."
						});
					});
				}).then((m) => {
					assert.equal(m.testIndex, 1, "auto increment index is set to 1");

					let model2 = new Random.Model({
						"string": "Fugiat laboris cillum quis pariatur.",
						"int": 42,
						"float": 2.7182818285
					});

					return model2.save();
				}).then((col) => {
					return connect.then((db) => {
						return db.collection(testSchema.$id).findOne({
							"string": "Fugiat laboris cillum quis pariatur."
						});
					});
				}).then((m) => {
					assert.equal(m.testIndex, 2, "auto increment index is set to 2");
					done();
				}).catch((err) => {
					done(err);
				});
			});
			it("should increment entry in the _counters collection", function(done){
				table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					let model = new Random.Model({
						"string": "Laborum non culpa.",
						"int": 27,
						"float": 6.2831853072
					});

					return model.save();
				}).then((col) => {
					return connect.then((db) => {
						return db.collection("_counters").findOne({_$id: testSchema.$id});
					});
				}).then((res) => {
					assert.equal(res.sequences.testIndex, 1);

					let model2 = new Random.Model({
						"string": "Fugiat laboris cillum quis pariatur.",
						"int": 42,
						"float": 2.7182818285
					});

					return model2.save();
				}).then((col) => {
					return connect.then((db) => {
						return db.collection("_counters").findOne({_$id: testSchema.$id});
					});
				}).then((res) => {
					assert.equal(res.sequences.testIndex, 2);
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});
	});

	describe("removeIndex()", function(){
		// Instance of DynamicSchema used for testing
		let table;

		beforeEach(function(done){
			utils.dropTestTable().then((reply) => {
				table = Random.Schema;
				table.createTable(testSchema).then(() => {
					return table.addIndex({
						name: "testIndex",
					});
				}).then(() => {
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				var promises = [db.dropCollection("_schema"), db.dropCollection(testSchema.$id)];
				return Promise.all(promises);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should remove the column from the index list", function(done){
			table.removeIndex("testIndex").then(() => {
				return connect.then((db) => {
					return db.collection(testSchema.$id).listIndexes().toArray();
				});
			}).then((res) => {
				var index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isUndefined(index, "index does not exist in database");
				done();
			}).catch((err) => {
				done(err);
			});
		});

		describe("auto increment", function(){
			beforeEach(function(done){
				table.addIndex({
					name: "autoIncrement",
					autoIncrement: true
				}).then(() => {
					done();
				});
			});

			it("should remove relevant entry from _counters collection", function(done){
				table.removeIndex("autoIncrement").then(() => {
					return connect.then((db) => {
						return db.collection(testSchema.$id).listIndexes().toArray();
					}).then((res) => {
						var index = _.find(res, function(el){
							return el.name == "autoIncrement";
						});
						assert.isUndefined(index, "index does not exist in database");
						done();
					}).catch((err) => {
						done(err);
					});
				});
			});
		});
	});

	describe("read()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.createCollection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				return db.dropCollection("_schema");
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should read the schema entry from the database correctly", function(done){
			let table = Random.Schema;
			table.read(testSchema.$id).then(() => {
				assert.equal(table.tableSlug, testSchema.$id, "object slug is equal to testSchema.$id");
				assert.deepEqual(table.definition, testSchema.properties, "object definition is as defined");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("define()", function(){
		afterEach(function(done){
			connect.then((db) => {
				return db.dropCollection("_schema");
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should write the schema definition to the database", function(done){
			let table = Random.Schema;
			table.define(testSchema.$id, testSchema.properties).then(() => {
				return connect.then((db) => {
					return db.collection("_schema").findOne({_$id: testSchema.$id});
				});
			}).then((data) => {
				assert.deepEqual(data.properties, testSchema.properties, "database entry has correct definition");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should set the correct name and slug", function(done){
			let table = Random.Schema;
			table.define("random_table", testSchema.properties).then(() => {
				assert.equal(table.tableSlug, "random_table", "object slug is set correctly");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should set the correct definition", function(done){
			let table = Random.Schema;
			table.define("random_table", testSchema.properties).then(() => {
				assert.deepEqual(table.definition, testSchema.properties, "object definition is set correctly");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("addColumn()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.createCollection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				return db.dropCollection("_schema");
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should add a column entry to the definition and database", function(done){
			let table = Random.Schema;
			table.read(testSchema.$id).then(() => {
				assert.isDefined(table.tableSlug);
				assert.isDefined(table.definition);

				return table.addColumn("test_column", "string", "test description");
			}).then(() => {
				assert.deepInclude(table.definition, {
					"test_column": {
						"description": "test description",
						"type": "string"
					}
				}, "object definition include new column");

				return connect.then((db) => {
					return db.collection("_schema").findOne({_$id: testSchema.$id});
				});
			}).then((data) => {
				assert.deepInclude(data.properties, {
					"test_column": {
						"description": "test description",
						"type": "string"
					}
				}, "database entry include new column");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("removeColumn()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.createCollection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				return db.dropCollection("_schema");
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should remove a specified column entry from the definition", function(done){
			let table = Random.Schema;

			table.read(testSchema.$id).then(() => {
				assert.isDefined(table.tableSlug);
				assert.isDefined(table.definition);

				return table.removeColumn("float");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "number"
					}
				}, "removed field is not in object definition");

				return connect.then((db) => {
					return db.collection("_schema").findOne({_$id: testSchema.$id});
				});
			}).then((data) => {
				assert.notDeepInclude(data.properties, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "number"
					}
				}, "removed field is not in database entry");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("renameColumn()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.createCollection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				return db.dropCollection("_schema");
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should rename a specified column entry in the definition", function(done){
			let table = Random.Schema;

			table.read(testSchema.$id).then(() => {
				assert.isDefined(table.tableSlug);
				assert.isDefined(table.definition);

				return table.renameColumn("int", "number");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"int": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": "true",
						"isUnique": "true",
						"isAutoIncrement": "true"
					}
				}, "object definition does not include old label");
				assert.deepInclude(table.definition, {
					"number": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": "true",
						"isUnique": "true",
						"isAutoIncrement": "true"
					}
				}, "object definition includes new label");

				return connect.then((db) => {
					return db.collection("_schema").findOne({_$id: testSchema.$id});
				});
			}).then((data) => {
				assert.notDeepInclude(data.properties, {
					"int": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": "true",
						"isUnique": "true",
						"isAutoIncrement": "true"
					}
				}, "database entry does not include old label");
				assert.deepInclude(data.properties, {
					"number": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": "true",
						"isUnique": "true",
						"isAutoIncrement": "true"
					}
				}, "database entry includes new label");

				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should rename the _counter entry if it is an auto incrementing index");
	});

	describe("changeColumnType()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.createCollection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				return db.dropCollection("_schema");
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should change the specified column type in the definition", function(done){
			let table = Random.Schema;

			table.read(testSchema.$id).then(() => {
				assert.isDefined(table.tableSlug);
				assert.isDefined(table.definition);

				return table.changeColumnType("float", "integer");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "number"
					}
				}, "object definition does not include old type");
				assert.deepInclude(table.definition, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "integer"
					}
				}, "object definition includes new type");

				return connect.then((db) => {
					return db.collection("_schema").findOne({_$id: testSchema.$id});
				});
			}).then((data) => {
				assert.notDeepInclude(data.properties, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "number"
					}
				}, "database entry does not include old type");
				assert.deepInclude(data.properties, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "integer"
					}
				}, "database entry includes new type");

				done();
			}).catch((err) => {
				done(err);
			});
		});
	});
});
// --------------------------------------------