// For setup and clean ups
require("dotenv").config();
const f = require("util").format;
const Promise = require("bluebird");
const _ = require("lodash");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const connect = MongoClient.connect(mongoURL);

// Test dependencies
const ActiveRecord = require("../index.js");
const ActiveCollection = require("../ActiveCollection");
const chai = require("chai");
const assert = chai.assert;

let Random;
// Clear table and insert dummy data
before(function(done){
	dropTestTable(function(reply){
		Random = new ActiveRecord("random_table");
		done();
	});
});

describe("Schema", function(){
	beforeEach(function(){

	});

	afterEach(function(){

	});

	// Tests
	describe("createTable()", function(){
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

		it("should create a new empty table or collection in the database and schema file", function(done){
			let table = new Random.Schema();
			table.createTable("random_table").then((col) => {
				connect.then((db) => {
					return db.listCollections().toArray();
				}).then((r) => {
					// List all collections and find the newly created collection
					let result = _.find(r, function(el){
						return el.name == "random_table";
					});
					assert.exists(result);

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
			let table = new Random.Schema();
			table.read("random_table").then(() => {
				assert.equal(table.tableSlug, "random_table");
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
				]);
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
			let table = new Random.Schema();
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
				}]);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should set the correct name and slug", function(done){
			let table = new Random.Schema();
			table.define("Random Table", "random_table", [{
				"slug": "test_column",
				"name": "Test Column",
				"type": "string"
			}]).then(() => {
				assert.equal(table.tableName, "Random Table");
				assert.equal(table.tableSlug, "random_table");
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should set the correct definition", function(done){
			let table = new Random.Schema();
			table.define("Random Table", "random_table", [{
				"slug": "test_column",
				"name": "Test Column",
				"type": "string"
			}]).then(() => {
				assert.deepEqual(table.definition, [{
					"slug": "test_column",
					"name": "Test Column",
					"type": "string"
				}]);
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
			let table = new Random.Schema();
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
				}, "definition include new column");

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
			let table = new Random.Schema();

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
				});

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.notDeepInclude(data.fields, {
					"name": "Float",
					"slug": "float",
					"type": "float"
				});
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
			let table = new Random.Schema();

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
				}, "definition not include old label");
				assert.deepInclude(table.definition, {
					"name": "number",
					"slug": "number",
					"type": "int"
				}, "definition include new label");

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.notDeepInclude(data.fields, {
					"name": "Int",
					"slug": "int",
					"type": "int"
				}, "schema file not include old label");
				assert.deepInclude(data.fields, {
					"name": "number",
					"slug": "number",
					"type": "int"
				}, "schema file include new label");

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
			let table = new Random.Schema();

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
				}, "definition not include old type");
				assert.deepInclude(table.definition, {
					"name": "Float",
					"slug": "float",
					"type": "double"
				}, "definition include new type");

				return connect.then((db) => {
					return db.collection("_schema").findOne({collectionSlug: "random_table"});
				});
			}).then((data) => {
				assert.notDeepInclude(data.fields, {
					"name": "Float",
					"slug": "float",
					"type": "float"
				}, "schema file not include old type");
				assert.deepInclude(data.fields, {
					"name": "Float",
					"slug": "float",
					"type": "double"
				}, "schema file include new type");

				done();
			}).catch((err) => {
				done(err);
			});
		});
	});
});

describe("ActiveRecord", function(){
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
		// Fill with dummy data
		connect.then((db) => {
			return db.collection("random_table").insertMany(testData);
		}).then((r) => {
			done();
		}).catch((err) => {
			done(err);
		});
	});

	// Tests
	describe("Constructor", function(){
		it("should retrieve the specified table or collection from the database");
	});

	describe("findBy()", function(){
		it("should retrieve an entry from the database matching the query", function(done){
			Random.findBy({"string": testData[0].string}).then((model) => {
				assert.equal(model.data.string, testData[0].string);
				assert.equal(model.data.int, testData[0].int);
				assert.equal(model.data.float, testData[0].float);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return a single object of type ActiveRecord.Model", function(done){
			Random.findBy({"string": testData[0].string}).then((model) => {
				assert.instanceOf(model, Random.Model);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return null if an entry is not found", function(done){
			Random.findBy({"string": "Not found"}).then((model) => {
				assert.isNull(model.data);
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("where()", function(){
		it("should retrieve all entries from the database matching the query", function(done){
			Random.where({"int": testData[0].int}).then((c) => {
				assert.deepInclude(c.data, testData[0]);
				assert.deepInclude(c.data, testData[1]);
				assert.notDeepInclude(c.data, testData[2]);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an array descendent of type ActiveCollection", function(done){
			Random.where({"float": testData[1].float}).then((c) => {
				assert.instanceOf(c, Array);
				assert.instanceOf(c, ActiveCollection);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an empty array descendent if query returns nothing", function(done){
			Random.where({"string": "Not exist"}).then((c) => {
				assert.instanceOf(c, Array);
				assert.instanceOf(c, ActiveCollection);
				assert.isEmpty(c);
				assert.isEmpty(c.data);
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("all()", function(){
		it("should retrieve all entries from the database", function(done){
			Random.all().then((c) => {
				assert.deepInclude(c.data, testData[0]);
				assert.deepInclude(c.data, testData[1]);
				assert.deepInclude(c.data, testData[2]);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an array descendent of type ActiveCollection", function(done){
			Random.all().then((c) => {
				assert.instanceOf(c, Array);
				assert.instanceOf(c, ActiveCollection);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return an empty array descendent if database is empty");
	});

	describe("first()", function(){
		it("should retrieve one latest entry from the database", function(done){
			Random.first().then((model) => {
				assert.deepEqual(model.data, testData[0]);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return a single object of type ActiveRecord.Model", function(done){
			Random.first().then((model) => {
				assert.instanceOf(model, Random.Model);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should return null if an entry is not found");
	});
});

describe("Model", function(){
	// Tests
	describe("Constructor", function(){
		it("should set the data object according to the object passed in", function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			});
			assert.exists(model.data);
			assert.deepEqual(model.data, {
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			});
		});
		it("should make a deep copy of the object if _preserveOriginal is truthy", function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			}, true);
			assert.exists(model.data);
			assert.exists(model._original);
			assert.deepEqual(model.data, model._original);
		});
		it("should have a null _original object if _preserveOriginal is falsy", function(){
			let model = new Random.Model({
				"string": "Laborum non culpa.",
				"int": 27,
				"float": 6.2831853072
			}, false);
			assert.notDeepEqual(model.data, model._original);
			assert.isNull(model._original);
		});
	});

	describe("save()", function(){
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
				return db.collection("random_table").insertMany(testData);
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
					return db.collection("random_table").findOne({
						"string": "Laborum non culpa.",
						"int": 27,
						"float": 6.2831853072
					});
				});
			}).then((m) => {
				assert.isNotNull(m);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should update the corresponding entry in the database if exist", function(done){
			let model;
			Random.findBy({"int": 10958}).then((m) => {
				model = m;
				assert.equal(model.data.int, 10958);
				model.data.string = "New string";
				return model.save();
			}).then((col) => {
				return connect.then((db) => {
					return db.collection("random_table").findOne({"int": 10958});
				});
			}).then((m) => {
				assert.deepEqual(m, model.data);
				done();
			}).catch((err) => {
				done(err);
			});
		});
		it("should update the deep copy of the data into _original", function(done){
			let model;
			Random.findBy({"int": 10958}).then((m) => {
				model = m;
				assert.equal(model.data.int, 10958);
				model.data.string = "New string";
				return model.save();
			}).then((col) => {
				assert.equal(model._original.string, "New string");
				done();
			}).catch((err) => {
				done(err);
			});
		});
	});

	describe("destroy()", function(){
		beforeEach(function(done){
			connect.then((db) => {
				db.collection("random_table").insertOne({
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
				db.collection("random_table").deleteOne({
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
					return db.collection("random_table").findOne({"string": "Delete me"});
				});
			}).then((model) => {
				assert.isNotNull(model);
				assert.equal(model.string, "Delete me");
				return testModel.destroy();
			}).then(() => {
				return connect.then((db) => {
					return db.collection("random_table").findOne({"string": "Delete me"});
				});
			}).then((model) => {
				assert.isNull(model);
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
				assert.isNull(model.data);
				assert.isNull(model._original);
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

describe("ActiveCollection", function(){
	let col;
	beforeEach(function(){
		col = new ActiveCollection();
	});
	afterEach(function(){
		col = null;
	});

	it("should be an instance of Array", function(){
		assert.instanceOf(col, Array);
	});
	it("should have the same methods as Array", function(){
		assert.isFunction(col.push);
		assert.isFunction(col.pop);
		assert.isFunction(col.slice);
		assert.isFunction(col.splice);
		assert.isFunction(col.map);
		assert.isFunction(col.reduce);
	});
	it("should have a property 'data' that returns a regular array of data", function(){
		assert.exists(col.data);
		assert.isArray(col.data);
		assert.notInstanceOf(col.data, ActiveCollection);
	});
	it("should update 'data' property whenever its data is updated", function(){
		col.push(new Random.Model({
			"string": "Magna dolor."
		}));

		assert.deepInclude(col.data, {
			"string": "Magna dolor."
		});
	});
});


// Close all database connections
after(function(done){
	dropTestTable(function(reply){
		Random.closeConnection();
		connect.then((db) => {
			db.close();
		});
		done();
	});
});

// Utils
function dropTestTable(cb){
	connect.then((db) => {
		db.collection("random_table").drop().then(cb).catch((err) => {
			if(err.message == "ns not found"){
				cb();
			}else{
				console.error(err);
			}
		});
	});
}

