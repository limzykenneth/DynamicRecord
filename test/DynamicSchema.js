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
const DynamicSchema = DynamicRecord.DynamicSchema;
const utils = new (require("./utils.js"))(connect);
const chai = require("chai");
const assert = chai.assert;

// Schema definition
const testSchema = Object.freeze(require("./random_table.schema.json"));

let Random;

// ------------------ Setups ------------------
// Clear table and insert dummy data
before(function(done){
	utils.resetTestTables().then(() => {
		connect.then((db) => {
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
		return connect.then((db) => {
			return db.close();
		});
	});
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("Schema", function(){
	// Tests
	describe("createTable()", function(){
		beforeEach(function(){
			return utils.resetTestTables();
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should create an empty table or collection in the database", function(){
			const table = new DynamicSchema();
			return table.createTable(testSchema).then((col) => {
				return connect.then((db) => {
					return db.listCollections().toArray();
				});
			}).then((cols) => {
				// List all collections and find the newly created collection
				const result = _.find(cols, function(el){
					return el.name == testSchema.$id;
				});
				assert.exists(result, "collection exists in database");

				return connect;
			}).then((db) => {
				// Check for entry in schema
				return db.collection("_schema").findOne({_$id: testSchema.$id});
			}).then((col) => {
				assert.isNotNull(col);
			});
		});
		it("should create an empty table or collection with provided index", function(){
			const table = new DynamicSchema();
			return table.createTable(testSchema).then(() => {
				return connect;
			}).then((db) => {
				return db.collection(testSchema.$id).indexExists("int");
			}).then((res) => {
				assert.isTrue(res);
			});
		});
		it("should populate the relevant sequences in _counters collection", function(){
			const table = new DynamicSchema();
			return table.createTable(testSchema).then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_counters").findOne({_$id: testSchema.$id});
			}).then((res) => {
				assert.hasAnyKeys(res.sequences, ["int"], "has auto increment field `int`");
				assert.equal(res.sequences.int, 0, "auto incrementing field is initialized to be 0");
			});
		});
		it("should populate its properties according to schema provided", function(){
			const table = new DynamicSchema();
			return table.createTable(testSchema).then(() => {
				assert.equal(table.tableSlug, testSchema.$id, "tableSlug is the same as $id");
				assert.equal(table.tableName, testSchema.title, "tableName is the same as title");
				assert.deepEqual(table.required, testSchema.required, "required is the same as required");
				assert.deepEqual(table.definition, testSchema.properties, "definition is the same as properties");
			});
		});
	});

	describe("dropTable()", function(){
		let table;

		beforeEach(function(){
			return utils.resetTestTables().then(() => {
				table = new DynamicSchema();
				return table.createTable(testSchema);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should remove the table's entry in the _schema table", function(){
			return connect.then((db) => {
				return table.dropTable().then(() => {
					return db.collection("_schema").findOne({"_$id": testSchema.$id});
				}).then((schema) => {
					assert.isNull(schema, "Entry under _schema table is deleted.");
				});
			});
		});
		it("should drop the table itself", function(){
			return connect.then((db) => {
				return table.dropTable().then(() => {
					return db.listCollections({name: testSchema.$id}).toArray();
				}).then((items) => {
					assert.isEmpty(items, "Table is dropped from the database");
				});
			});
		});
		it("should remove the table's entry in the _counters table", function(){
			return connect.then((db) => {
				return table.dropTable().then(() => {
					return db.collection("_counters").findOne({"_$id": testSchema.$id});
				}).then((schema) => {
					assert.isNull(schema, "Entry under _counters table is deleted.");
				});
			});
		});
		it("should remove existing data from the instance", function(){
			return table.dropTable().then(() => {
				assert.isNull(table.tableName, "Table name is set to null");
				assert.isNull(table.tableSlug, "Table slug is set to null");
				assert.isEmpty(table.definition, "Table definition is emptied");
			});
		});
	});

	describe("renameTable()", function(){
		// Instance of DynamicSchema used for testing
		let table;

		beforeEach(function(){
			return utils.resetTestTables().then(() => {
				table = new DynamicSchema();
				return table.createTable(testSchema);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should rename the table in database and object instance", function(){
			return connect.then((db) => {
				return table.renameTable("test_table", "Test Table").then(() => {
					return db.listCollections({name: testSchema.$id}).toArray();
				}).then((col) => {
					assert.isEmpty(col, "collection under original name no longer exist");
					return db.listCollections({name: "test_table"}).toArray();
				}).then((col) => {
					assert.isNotEmpty(col, "collection under new name exist");
					assert.lengthOf(col, 1, "only has one collection with name test_table");
					assert.equal(table.tableSlug, "test_table", "slug is updated in object");
					assert.equal(table.tableName, "Test Table", "name is updated in object");
				});
			});
		});
		it("should default new name to new slug", function(){
			return connect.then((db) => {
				return table.renameTable("test_table").then(() => {
					return db.listCollections({name: testSchema.$id}).toArray();
				}).then((col) => {
					assert.isEmpty(col, "collection under original name no longer exist");
					return db.listCollections({name: "test_table"}).toArray();
				}).then((col) => {
					assert.isNotEmpty(col, "collection under new name exist");
					assert.lengthOf(col, 1, "only has one collection with name test_table");
					assert.equal(table.tableSlug, "test_table", "slug is updated in object");
					assert.equal(table.tableName, "test_table", "name is defaulted to slug in object");
					return db.collection("_schema").findOne({"_$id": "test_table"});
				}).then((entry) => {
					assert.equal(entry.title, "test_table", "name is defaulted to slug in schema entry");
				});
			});
		});
		it("should rename the entry in _schema table", function(){
			return connect.then((db) => {
				return table.renameTable("test_table").then(() => {
					return db.collection("_schema").findOne({"_$id": "test_table"});
				}).then((entry) => {
					assert.isNotNull(entry, "entry with new name exist");
					assert.equal(entry.title, "test_table", "name is defaulted to slug in schema entry");
					assert.equal(entry._$id, "test_table", "slug is updated in schema entry");
					return db.collection("_schema").findOne({"_$id": testSchema.$id});
				}).then((entry) => {
					assert.isNull(entry, "entry with old name doesn't exist");
				});
			});
		});
		it("should rename the entry in _counters table", function(){
			return connect.then((db) => {
				return table.renameTable("test_table").then(() => {
					return db.collection("_counters").findOne({"_$id": "test_table"});
				}).then((entry) => {
					assert.isNotNull(entry, "entry with new name exist");
					assert.equal(entry._$id, "test_table", "slug is updated in schema entry");
					return db.collection("_counters").findOne({"_$id": testSchema.$id});
				}).then((entry) => {
					assert.isNull(entry, "entry with old name doesn't exist");
				});
			});
		});
	});

	describe("addIndex()", function(){
		// Instance of DynamicSchema used for testing
		let table;

		beforeEach(function(){
			return utils.resetTestTables().then((reply) => {
				table = new DynamicSchema();
				return table.createTable(testSchema);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should create a new index", function(){
			return table.addIndex({
				name: "testIndex"
			}, true).then(() => {
				return connect;
			}).then((db) => {
				return db.collection(testSchema.$id).indexExists("testIndex");
			}).then((res) => {
				assert.isTrue(res, "index exists in database");
			});
		});
		it("should make the index unique by default", function(){
			return table.addIndex({
				name: "testIndex"
			}).then(() => {
				return connect;
			}).then((db) => {
				return db.collection(testSchema.$id).listIndexes().toArray();
			}).then((res) => {
				const index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isTrue(index.unique, "index is marked as unique");
			});
		});
		it("should not make the index unique if passed false to unique", function(){
			return table.addIndex({
				name: "testIndex",
				unique: false
			}).then(() => {
				return connect;
			}).then((db) => {
				return db.collection(testSchema.$id).listIndexes().toArray();
			}).then((res) => {
				const index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isNotOk(index.unique, "index is not marked as unique");
			});
		});

		describe("auto increment", function(){
			it("should create an entry in _counters collection if set as auto increment", function(){
				return table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					return connect;
				}).then((db) => {
					return db.collection("_counters").findOne({_$id: testSchema.$id});
				}).then((res) => {
					assert.isNotNull(res, "entry not found in _counters collection");
					assert.isDefined(res.sequences, "entry not defined correctly");
					assert.strictEqual(res.sequences.testIndex, 0, "entry not initialized correctly");
				});
			});
			it("should make the index unique if set as auto increment", function(){
				return table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					return connect;
				}).then((db) => {
					return db.collection(testSchema.$id).listIndexes().toArray();
				}).then((res) => {
					const index = _.find(res, function(el){
						return el.name == "testIndex";
					});
					assert.isTrue(index.unique, "index is marked as unique");
				});
			});
			// Following potentially tested in DynamicRecordModel.js
			it("should increment the counter when a new entry is added", function(){
				return table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					const model = new Random.Model({
						"string": "Laborum non culpa.",
						"int": 27,
						"float": 6.2831853072
					});

					return model.save();
				}).then((col) => {
					return connect;
				}).then((db) => {
					return db.collection(testSchema.$id).findOne({
						"string": "Laborum non culpa."
					});
				}).then((m) => {
					assert.equal(m.testIndex, 1, "auto increment index is set to 1");

					const model2 = new Random.Model({
						"string": "Fugiat laboris cillum quis pariatur.",
						"int": 42,
						"float": 2.7182818285
					});

					return model2.save();
				}).then((col) => {
					return connect;
				}).then((db) => {
					return db.collection(testSchema.$id).findOne({
						"string": "Fugiat laboris cillum quis pariatur."
					});
				}).then((m) => {
					assert.equal(m.testIndex, 2, "auto increment index is set to 2");
				});
			});
			it("should increment entry in the _counters collection", function(){
				return table.addIndex({
					name: "testIndex",
					autoIncrement: true
				}).then(() => {
					const model = new Random.Model({
						"string": "Laborum non culpa.",
						"int": 27,
						"float": 6.2831853072
					});

					return model.save();
				}).then((col) => {
					return connect;
				}).then((db) => {
					return db.collection("_counters").findOne({_$id: testSchema.$id});
				}).then((res) => {
					assert.equal(res.sequences.testIndex, 1);

					const model2 = new Random.Model({
						"string": "Fugiat laboris cillum quis pariatur.",
						"int": 42,
						"float": 2.7182818285
					});

					return model2.save();
				}).then((col) => {
					return connect;
				}).then((db) => {
					return db.collection("_counters").findOne({_$id: testSchema.$id});
				}).then((res) => {
					assert.equal(res.sequences.testIndex, 2);
				});
			});
		});
	});

	describe("removeIndex()", function(){
		// Instance of DynamicSchema used for testing
		let table;

		beforeEach(function(){
			return utils.resetTestTables().then((reply) => {
				table = new DynamicSchema();
				return table.createTable(testSchema);
			}).then(() => {
				return table.addIndex({
					name: "testIndex",
				});
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should remove the column from the index list", function(){
			return table.removeIndex("testIndex").then(() => {
				return connect;
			}).then((db) => {
				return db.collection(testSchema.$id).listIndexes().toArray();
			}).then((res) => {
				const index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isUndefined(index, "index does not exist in database");
			});
		});

		describe("auto increment", function(){
			beforeEach(function(){
				return table.addIndex({
					name: "autoIncrement",
					autoIncrement: true
				});
			});

			it("should remove relevant entry from _counters collection", function(){
				return table.removeIndex("autoIncrement").then(() => {
					return connect;
				}).then((db) => {
					return db.collection("_counters").findOne({"_$id": table.tableSlug});
				}).then((m) => {
					assert.doesNotHaveAnyKeys(m.sequences, ["autoIncrement"], "index does not exist in _counters table");
				});
			});
		});
	});

	describe("read()", function(){
		beforeEach(function(){
			return utils.resetTestTables().then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should read the schema entry from the database correctly", function(){
			const table = new DynamicSchema();
			return table.read(testSchema.$id).then(() => {
				assert.equal(table.tableSlug, testSchema.$id, "object slug is equal to testSchema.$id");
				assert.deepEqual(table.definition, testSchema.properties, "object definition is as defined");
				assert.deepEqual(table.required, testSchema.required, "required properties is as defined");
			});
		});
	});

	describe("define()", function(){
		beforeEach(function(){
			return utils.resetTestTables();
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should write the schema definition to the database", function(){
			const table = new DynamicSchema();
			const emptyTestSchema = _.cloneDeep(testSchema);
			emptyTestSchema.properties = {};

			return table.createTable(emptyTestSchema).then(() => {
				return table.define(testSchema.properties);
			}).then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_schema").findOne({_$id: testSchema.$id});
			}).then((data) => {
				assert.deepEqual(data.properties, testSchema.properties, "database entry has correct definition");
			});
		});
		it("should set the correct definition", function(){
			const table = new DynamicSchema();
			return table.define(testSchema.properties).then(() => {
				assert.deepEqual(table.definition, testSchema.properties, "object definition is set correctly");
			});
		});
	});

	describe("addColumn()", function(){
		beforeEach(function(){
			return utils.resetTestTables().then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should add a column entry to the definition and database", function(){
			const table = new DynamicSchema();
			return table.read(testSchema.$id).then(() => {
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

				return connect;
			}).then((db) => {
				return db.collection("_schema").findOne({_$id: testSchema.$id});
			}).then((data) => {
				assert.deepInclude(data.properties, {
					"test_column": {
						"description": "test description",
						"type": "string"
					}
				}, "database entry include new column");
			});
		});
		it("should return a rejected promise if the column already exist", function(done){
			const table = new DynamicSchema();
			table.read(testSchema.$id).then(() => {
				return table.addColumn("string", "string", "Should already exist");
			}).then(() => {
				done(new Error("Promise is not rejected upon encountering duplicated column name"));
			}).catch((err) => {
				if(err.message === "Column name \"string\" already exist"){
					done();
				}else{
					done(err);
				}
			});
		});
	});

	describe("addColumns()", function(){
		beforeEach(function(){
			return utils.resetTestTables().then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should add multiple columns to the definition and database", function(){
			const table = new DynamicSchema();
			return table.read(testSchema.$id).then(() => {
				return table.addColumns({
					"test_column_1": {
						description: "Test Column 1",
						type: "string"
					},
					"test_column_2": {
						description: "Test Column 2",
						type: "number"
					}
				});
			}).then(() => connect).then((db) => {
				return db.collection("_schema").findOne({"_$id": table.tableSlug});
			}).then((data) => {
				assert.deepInclude(data.properties, {
					"test_column_1": {
						description: "Test Column 1",
						type: "string"
					},
					"test_column_2": {
						description: "Test Column 2",
						type: "number"
					}
				}, "database entry include new columns");
			});
		});
		it("should return a rejected promise if any columns already exist", function(done){
			const table = new DynamicSchema();
			table.read(testSchema.$id).then(() => {
				return table.addColumns({
					"string": {
						description: "Test Column 1",
						type: "string"
					},
					"test_column_2": {
						description: "Test Column 2",
						type: "number"
					}
				});
			}).then(() => {
				done(new Error("Promise is not rejected upon encountering duplicated column name"));
			}).catch((err) => {
				if(err.message === "Column names already exist: string"){
					done();
				}else{
					done(err);
				}
			});
		});
	});

	describe("removeColumn()", function(){
		beforeEach(function(){
			return utils.resetTestTables().then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_schema");
			}).then((col) => {
				const databaseInsert = _.cloneDeep(testSchema);
				databaseInsert._$id = databaseInsert.$id;
				databaseInsert._$schema = databaseInsert.$schema;
				delete databaseInsert.$id;
				delete databaseInsert.$schema;
				return col.insertOne(databaseInsert);
			});
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should remove a specified column entry from the definition", function(){
			const table = new DynamicSchema();

			return table.read(testSchema.$id).then(() => {
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

				return connect;
			}).then((db) => {
				return db.collection("_schema").findOne({_$id: testSchema.$id});
			}).then((data) => {
				assert.notDeepInclude(data.properties, {
					"float": {
						"description": "Column of type 'Number'",
						"type": "number"
					}
				}, "removed field is not in database entry");
			});
		});
	});

	describe("renameColumn()", function(){
		beforeEach(function(){
			return utils.resetTestTables();
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should rename a specified column entry in the definition", function(){
			const table = new DynamicSchema();

			return table.createTable(testSchema).then(() => {
				assert.isDefined(table.tableSlug);
				assert.isDefined(table.definition);

				return table.renameColumn("int", "number");
			}).then(() => {
				assert.notDeepInclude(table.definition, {
					"int": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": true,
						"isUnique": true,
						"isAutoIncrement": true
					}
				}, "object definition does not include old label");
				assert.deepInclude(table.definition, {
					"number": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": true,
						"isUnique": true,
						"isAutoIncrement": true
					}
				}, "object definition includes new label");

				return connect;
			}).then((db) => {
				return db.collection("_schema").findOne({_$id: testSchema.$id});
			}).then((data) => {
				assert.notDeepInclude(data.properties, {
					"int": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": true,
						"isUnique": true,
						"isAutoIncrement": true
					}
				}, "database entry does not include old label");
				assert.deepInclude(data.properties, {
					"number": {
						"description": "Column of type 'integer'",
						"type": "integer",
						"isIndex": true,
						"isUnique": true,
						"isAutoIncrement": true
					}
				}, "database entry includes new label");
			});
		});

		it("should rename the _counters entry if it is an auto incrementing index", function(){
			const table = new DynamicSchema();

			return table.createTable(testSchema).then(() => {
				assert.isDefined(table.tableSlug);
				assert.isDefined(table.definition);
				return table.renameColumn("int", "number");
			}).then(() => {
				return connect;
			}).then((db) => {
				return db.collection("_counters").findOne({"_$id": table.tableSlug});
			}).then((entry) => {
				assert.hasAnyKeys(entry.sequences, "number", "sequences has key 'number'");
				assert.doesNotHaveAnyKeys(entry.sequences, "int", "sequences doesn't have key 'int'");
			});
		});
	});

	describe("changeColumnType()", function(){
		beforeEach(function(){
			return utils.resetTestTables();
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should change the specified column type in the definition", function(){
			const table = new DynamicSchema();

			return table.createTable(testSchema).then(() => {
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

				return connect;
			}).then((db) => {
				return db.collection("_schema").findOne({_$id: testSchema.$id});
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
			});
		});
	});
});
// --------------------------------------------