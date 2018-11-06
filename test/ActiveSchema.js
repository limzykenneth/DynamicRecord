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
describe("Schema", function(){
	// Tests
	describe("createTable()", function(){
		beforeEach(function(done){
			utils.dropTestTable(function(reply){
				done();
			});
		});

		afterEach(function(done){
			connect.then((db) => {
				var promises = [db.dropCollection("_schema"), db.dropCollection("random_table")];
				return Promise.all(promises);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should create an empty table or collection in the database", function(done){
			let table = Random.Schema;
			table.createTable({
				tableSlug: "random_table",
				tableName: "Random Table"
			}).then((col) => {
				return connect.then((db) => {
					return db.listCollections().toArray();
				});
			}).then((cols) => {
				// List all collections and find the newly created collection
				let result = _.find(cols, function(el){
					return el.name == "random_table";
				});
				assert.exists(result, "collection exists in database");

				// Check for entry in schema
				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
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
			table.createTable({
				tableSlug: "random_table",
				tableName: "Random Table",
				indexColumns: {
					name: "tableSlug",
					unique: true
				}
			}).then(() => {
				return connect.then((db) => {
					return db.collection("random_table").indexExists("tableSlug");
				});
			}).then((res) => {
				assert.isTrue(res);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should create an empty table or collection with all provided indexes", function(done){
			let table = Random.Schema;
			table.createTable({
				tableSlug: "random_table",
				tableName: "Random Table",
				indexColumns: [
					{
						name: "tableSlug",
						unique: true
					},
					{
						name: "tableName",
						unique: false
					}
				]
			}).then(() => {
				return connect.then((db) => {
					return db.collection("random_table").indexExists(["tableSlug", "tableName"]);
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
		// Instance of ActiveSchema used for testing
		let table;

		beforeEach(function(done){
			utils.dropTestTable(function(reply){
				table = Random.Schema;
				table.createTable({
					tableSlug: "random_table",
					tableName: "Random Table"
				}).then(() => {
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});
		afterEach(function(done){
			connect.then((db) => {
				var promises = [db.dropCollection("_schema"), db.dropCollection("random_table"), db.dropCollection("_counters")];
				return Promise.all(promises);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should create a new index", function(done){
			table.addIndex({
				name: "tableSlug"
			}, true).then(() => {
				return connect.then((db) => {
					return db.collection("random_table").indexExists("tableSlug");
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
				name: "tableSlug"
			}).then(() => {
				return connect.then((db) => {
					return db.collection("random_table").listIndexes().toArray();
				});
			}).then((res) => {
				var index = _.find(res, function(el){
					return el.name == "tableSlug";
				});
				assert.isTrue(index.unique, "index is marked as unique");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should not make the index unique if passed false to unique", function(done){
			table.addIndex({
				name: "tableSlug",
				unique: false
			}).then(() => {
				return connect.then((db) => {
					return db.collection("random_table").listIndexes().toArray();
				});
			}).then((res) => {
				var index = _.find(res, function(el){
					return el.name == "tableSlug";
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
					name: "tableSlug",
					autoIncrement: true
				}).then(() => {
					return connect.then((db) => {
						return db.collection("_counters").findOne({collection: "random_table"});
					});
				}).then((res) => {
					assert.isNotNull(res, "entry not found in _counters collection");
					assert.isDefined(res.sequences, "entry not defined correctly");
					assert.strictEqual(res.sequences.tableSlug, 0, "entry not initialized correctly");
					done();
				}).catch((err) => {
					done(err);
				});
			});
			it("should make the index unique if set as auto increment", function(done){
				table.addIndex({
					name: "tableSlug",
					autoIncrement: true
				}).then(() => {
					return connect.then((db) => {
						return db.collection("random_table").listIndexes().toArray();
					});
				}).then((res) => {
					var index = _.find(res, function(el){
						return el.name == "tableSlug";
					});
					assert.isTrue(index.unique, "index is marked as unique");
					done();
				}).catch((err) => {
					done(err);
				});
			});
			// Following potentially tested in ActiveRecordModel.js
			it("should increment the counter when a new entry is added", function(done){
				table.addIndex({
					name: "tableSlug",
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
						return db.collection("random_table").findOne({
							"string": "Laborum non culpa.",
							"int": 27,
							"float": 6.2831853072
						});
					});
				}).then((m) => {
					assert.equal(m.tableSlug, 1, "auto increment index is set to 1");

					let model2 = new Random.Model({
						"string": "Fugiat laboris cillum quis pariatur.",
						"int": 42,
						"float": 2.7182818285
					});

					return model2.save();
				}).then((col) => {
					return connect.then((db) => {
						return db.collection("random_table").findOne({
							"string": "Fugiat laboris cillum quis pariatur.",
							"int": 42,
							"float": 2.7182818285
						});
					});
				}).then((m) => {
					assert.equal(m.tableSlug, 2, "auto increment index is set to 2");
					done();
				}).catch((err) => {
					done(err);
				});
			});
			it("should increment entry in the _counters collection", function(done){
				table.addIndex({
					name: "tableSlug",
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
						return db.collection("_counters").findOne({collection: "random_table"});
					});
				}).then((res) => {
					assert.equal(res.sequences.tableSlug, 1);

					let model2 = new Random.Model({
						"string": "Fugiat laboris cillum quis pariatur.",
						"int": 42,
						"float": 2.7182818285
					});

					return model2.save();
				}).then((col) => {
					return connect.then((db) => {
						return db.collection("_counters").findOne({collection: "random_table"});
					});
				}).then((res) => {
					assert.equal(res.sequences.tableSlug, 2);
					done();
				}).catch((err) => {
					done(err);
				});
			});
		});
	});

	describe("removeIndex()", function(){
		// Instance of ActiveSchema used for testing
		let table;

		beforeEach(function(done){
			utils.dropTestTable(function(reply){
				table = Random.Schema;
				table.createTable({
					tableSlug: "random_table",
					tableName: "Random Table"
				}).then(() => {
					return table.addIndex({
						name: "tableSlug",
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
				var promises = [db.dropCollection("_schema"), db.dropCollection("random_table")];
				return Promise.all(promises);
			}).then(() => {
				done();
			}).catch((err) => {
				done(err);
			});
		});

		it("should remove the column from the index list", function(done){
			table.removeIndex("tableSlug").then(() => {
				return connect.then((db) => {
					return db.collection("random_table").listIndexes().toArray();
				});
			}).then((res) => {
				var index = _.find(res, function(el){
					return el.name == "tableSlug";
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
						return db.collection("random_table").listIndexes().toArray();
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
				return col.insertOne({
					collectionName: "Random Table",
					collectionSlug: "random_table",
					fields: [
						{
							"name": "String",
							"slug": "string",
							"type": "string"
						},
						{
							"name": "Int",
							"slug": "int",
							"type": "int"
						},
						{
							"name": "float",
							"slug": "float",
							"type": "float"
						}
					]
				});
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
			table.read("random_table").then(() => {
				assert.equal(table.tableSlug, "random_table", "object slug is equal to 'random_table'");
				assert.deepEqual(table.definition, [
					{
						"name": "String",
						"slug": "string",
						"type": "string"
					},
					{
						"name": "Int",
						"slug": "int",
						"type": "int"
					},
					{
						"name": "float",
						"slug": "float",
						"type": "float"
					}
				], "object definition is as defined");
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
			table.define("Random Table", "random_table", [{
				"slug": "test_column",
				"name": "Test Column",
				"type": "string"
			}]).then(() => {
				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.deepEqual(data.fields, [{
					"slug": "test_column",
					"name": "Test Column",
					"type": "string"
				}], "database entry has correct definition");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should set the correct name and slug", function(done){
			let table = Random.Schema;
			table.define("Random Table", "random_table", [{
				"slug": "test_column",
				"name": "Test Column",
				"type": "string"
			}]).then(() => {
				assert.equal(table.tableName, "Random Table", "object name is set correctly");
				assert.equal(table.tableSlug, "random_table", "object slug is set correctly");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should set the correct definition", function(done){
			let table = Random.Schema;
			table.define("Random Table", "random_table", [{
				"slug": "test_column",
				"name": "Test Column",
				"type": "string"
			}]).then(() => {
				assert.deepEqual(table.definition, [{
					"slug": "test_column",
					"name": "Test Column",
					"type": "string"
				}], "object definition is set correctly");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("addColumn()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.collection("_schema").insertOne({
					collectionName: "Random Table",
					collectionSlug: "random_table",
					fields: [
						{
							"label": "string",
							"type": "string"
						}, {
							"label": "int",
							"type": "int"
						}, {
							"label": "float",
							"type": "float"
						}
					]
				});
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
			table.read("random_table").then(() => {
				assert.isDefined(table.tableName);
				assert.isDefined(table.definition);
				assert.lengthOf(table.definition, 3);

				return table.addColumn("test_column", "string");
			}).then(() => {
				assert.deepInclude(table.definition, {
					"name": "test_column",
					"slug": "test_column",
					"type": "string"
				}, "object definition include new column");

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.deepInclude(data.fields, {
					"name": "test_column",
					"slug": "test_column",
					"type": "string"
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
				return db.collection("_schema").insertOne({
					collectionName: "Random Table",
					collectionSlug: "random_table",
					fields: [
						{
							"name": "String",
							"slug": "string",
							"type": "string"
						},
						{
							"name": "Int",
							"slug": "int",
							"type": "int"
						},
						{
							"name": "float",
							"slug": "float",
							"type": "float"
						}
					]
				});
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

			table.read("random_table").then(() => {
				assert.isDefined(table.tableName);
				assert.isDefined(table.definition);
				assert.lengthOf(table.definition, 3);

				return table.removeColumn("float");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"name": "Float",
					"slug": "float",
					"type": "float"
				}, "removed field is not in object definition");

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.notDeepInclude(data.fields, {
					"name": "Float",
					"slug": "float",
					"type": "float"
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
				return db.collection("_schema").insertOne({
					collectionName: "Random Table",
					collectionSlug: "random_table",
					fields: [
						{
							"name": "String",
							"slug": "string",
							"type": "string"
						}, {
							"name": "Int",
							"slug": "int",
							"type": "int"
						}, {
							"name": "Float",
							"slug": "float",
							"type": "float"
						}
					]
				});
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

			table.read("random_table").then(() => {
				assert.isDefined(table.tableName);
				assert.isDefined(table.definition);
				assert.lengthOf(table.definition, 3);

				return table.renameColumn("int", "number");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"name": "Int",
					"slug": "int",
					"type": "int"
				}, "object definition does not include old label");
				assert.deepInclude(table.definition, {
					"name": "number",
					"slug": "number",
					"type": "int"
				}, "object definition includes new label");

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.notDeepInclude(data.fields, {
					"name": "Int",
					"slug": "int",
					"type": "int"
				}, "database entry does not include old label");
				assert.deepInclude(data.fields, {
					"name": "number",
					"slug": "number",
					"type": "int"
				}, "database entry includes new label");

				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("changeColumnType()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				return db.collection("_schema").insertOne({
					collectionName: "Random Table",
					collectionSlug: "random_table",
					fields: [
						{
							"name": "String",
							"slug": "string",
							"type": "string"
						}, {
							"name": "Int",
							"slug": "int",
							"type": "int"
						}, {
							"name": "Float",
							"slug": "float",
							"type": "float"
						}
					]
				});
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

			table.read("random_table").then(() => {
				assert.isDefined(table.tableName);
				assert.isDefined(table.definition);
				assert.lengthOf(table.definition, 3);

				return table.changeColumnType("float", "double");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"name": "Float",
					"slug": "float",
					"type": "float"
				}, "object definition does not include old type");
				assert.deepInclude(table.definition, {
					"name": "Float",
					"slug": "float",
					"type": "double"
				}, "object definition includes new type");

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.notDeepInclude(data.fields, {
					"name": "Float",
					"slug": "float",
					"type": "float"
				}, "database entry does not include old type");
				assert.deepInclude(data.fields, {
					"name": "Float",
					"slug": "float",
					"type": "double"
				}, "database entry includes new type");

				done();
			}).catch((err) => {
				done(err);
			});
		});
	});
});
// --------------------------------------------