// Test dependencies
const Promise = require("bluebird");
const _ = require("lodash");
const utility = require("../utils.js");
const url = utility.url;
const chai = require("chai");
const assert = chai.assert;
const {
	createConnection,
	createInstance,
	createSchemaInstance,
	createCollection
} = require("../../build/main.js");

// Database specific dependencies
const MongoClient = require("mongodb").MongoClient;
const connect = MongoClient.connect(url);

// Setup helpers
const utils = new utility.utils(connect);

// Schema definition
const testSchema = Object.freeze(require("../random_table.schema.json"));
const testData = utility.testData;

let Random, connection;

// ----------------- Tests --------------------
describe("Schema", function(){
	// ------------------ Setups ------------------
	// Clear table and insert dummy data
	before(async function(){
		await utils.resetTestTables();
		await utils.setupSuite();

		connection = createConnection(process.env.database_host);

		Random = createInstance(connection, testSchema.$id);
	});

	// Close all database connections
	after(async function(){
		(await connection.interface).client.close();
		await utils.dropTestTable();
		await utils.cleanUpSuite();
	});
	// --------------------------------------------

	describe("createTable()", function(){
		beforeEach(async function(){
			await utils.resetTestTables();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should create an empty table or collection in the database", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);
			await table.createTable(testSchema);

			// List all collections and find the newly created collection
			const cols = await db.listCollections().toArray();
			const result = _.find(cols, function(el){
				return el.name == testSchema.$id;
			});
			assert.exists(result, "collection exists in database");

			// Check for entry in schema
			const col = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.isNotNull(col);
		});
		it("should create an empty table or collection with provided index", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);
			await table.createTable(testSchema);

			const res = await db.collection(testSchema.$id).indexExists("wholeNumber");
			assert.isTrue(res);
		});
		it("should populate the relevant sequences in _counters collection", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);
			await table.createTable(testSchema);

			const res = await db.collection("_counters").findOne({_$id: testSchema.$id});
			assert.hasAnyKeys(res.sequences, ["wholeNumber"], "has auto increment field `wholeNumber`");
			assert.equal(res.sequences.wholeNumber, 0, "auto incrementing field is initialized to be 0");
		});
		it("should populate its properties according to schema provided", async function(){
			const table = createSchemaInstance(connection);
			await table.createTable(testSchema);
			assert.equal(table.tableSlug, testSchema.$id, "tableSlug is the same as $id");
			assert.equal(table.tableName, testSchema.title, "tableName is the same as title");
			assert.deepEqual(table.required, testSchema.required, "required is the same as required");
			assert.deepEqual(table.definition, testSchema.properties, "definition is the same as properties");
		});
	});

	describe("dropTable()", function(){
		let table;

		beforeEach(async function(){
			await utils.resetTestTables();
			table = createSchemaInstance(connection);
			await table.createTable(testSchema);
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should remove the table's entry in the _schema table", async function(){
			const client = await connect;
			const db = client.db();

			await table.dropTable();

			const schema = await db.collection("_schema").findOne({"_$id": testSchema.$id});
			assert.isNull(schema, "Entry under _schema table is deleted.");
		});
		it("should drop the table itself", async function(){
			const client = await connect;
			const db = client.db();

			await table.dropTable();

			const items = await db.listCollections({name: testSchema.$id}).toArray();
			assert.isEmpty(items, "Table is dropped from the database");
		});
		it("should remove the table's entry in the _counters table", async function(){
			const client = await connect;
			const db = client.db();

			await table.dropTable();

			const schema = await db.collection("_counters").findOne({"_$id": testSchema.$id});
			assert.isNull(schema, "Entry under _counters table is deleted.");
		});
		it("should remove existing data from the instance", async function(){
			await table.dropTable();

			assert.isNull(table.tableName, "Table name is set to null");
			assert.isNull(table.tableSlug, "Table slug is set to null");
			assert.isEmpty(table.definition, "Table definition is emptied");
		});
	});

	describe("renameTable()", function(){
		let table;

		beforeEach(async function(){
			await utils.resetTestTables();
			table = createSchemaInstance(connection);
			await table.createTable(testSchema);
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should rename the table in database and object instance", async function(){
			const client = await connect;
			const db = client.db();

			await table.renameTable("test_table", "Test Table");

			let col = await db.listCollections({name: testSchema.$id}).toArray();
			assert.isEmpty(col, "collection under original name no longer exist");

			col = await db.listCollections({name: "test_table"}).toArray();
			assert.isNotEmpty(col, "collection under new name exist");
			assert.lengthOf(col, 1, "only has one collection with name test_table");
			assert.equal(table.tableSlug, "test_table", "slug is updated in object");
			assert.equal(table.tableName, "Test Table", "name is updated in object");
		});
		it("should default new name to new slug", async function(){
			const client = await connect;
			const db = client.db();

			await table.renameTable("test_table");

			let col = await db.listCollections({name: testSchema.$id}).toArray();
			assert.isEmpty(col, "collection under original name no longer exist");

			col = await db.listCollections({name: "test_table"}).toArray();
			assert.isNotEmpty(col, "collection under new name exist");
			assert.lengthOf(col, 1, "only has one collection with name test_table");
			assert.equal(table.tableSlug, "test_table", "slug is updated in object");
			assert.equal(table.tableName, "test_table", "name is defaulted to slug in object");

			const entry = await db.collection("_schema").findOne({"_$id": "test_table"});
			assert.equal(entry.title, "test_table", "name is defaulted to slug in schema entry");
		});
		it("should rename the entry in _schema table", async function(){
			const client = await connect;
			const db = client.db();

			await table.renameTable("test_table");

			let entry = await db.collection("_schema").findOne({"_$id": "test_table"});
			assert.isNotNull(entry, "entry with new name exist");
			assert.equal(entry.title, "test_table", "name is defaulted to slug in schema entry");
			assert.equal(entry._$id, "test_table", "slug is updated in schema entry");

			entry = await db.collection("_schema").findOne({"_$id": testSchema.$id});
			assert.isNull(entry, "entry with old name doesn't exist");
		});
		it("should rename the entry in _counters table", async function(){
			const client = await connect;
			const db = client.db();

			await table.renameTable("test_table");

			let entry = await db.collection("_counters").findOne({"_$id": "test_table"});
			assert.isNotNull(entry, "entry with new name exist");
			assert.equal(entry._$id, "test_table", "slug is updated in schema entry");

			entry = await db.collection("_counters").findOne({"_$id": testSchema.$id});
			assert.isNull(entry, "entry with old name doesn't exist");
		});
	});

	describe("addIndex()", function(){
		let table;

		beforeEach(async function(){
			await utils.resetTestTables();
			table = createSchemaInstance(connection);
			await table.createTable(testSchema);
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should create a new index", async function(){
			const client = await connect;
			const db = client.db();

			await table.addIndex({
				name: "testIndex"
			}, true);

			const res = await db.collection(testSchema.$id).indexExists("testIndex");
			assert.isTrue(res, "index exists in database");
		});
		it("should make the index unique by default", async function(){
			const client = await connect;
			const db = client.db();

			await table.addIndex({
				name: "testIndex"
			});

			const res = await db.collection(testSchema.$id).listIndexes().toArray();
			const index = _.find(res, function(el){
				return el.name == "testIndex";
			});
			assert.isTrue(index.unique, "index is marked as unique");
		});
		it("should not make the index unique if passed false to unique", async function(){
			const client = await connect;
			const db = client.db();

			await table.addIndex({
				name: "testIndex",
				unique: false
			});

			const res = await db.collection(testSchema.$id).listIndexes().toArray();
			const index = _.find(res, function(el){
				return el.name == "testIndex";
			});
			assert.isNotOk(index.unique, "index is not marked as unique");
		});
		it("should update the schema entry in database", async function(){
			const client = await connect;
			const db = client.db();

			await table.addIndex({
				name: "testIndex"
			});

			const data = await db.collection("_schema").findOne({"_$id": testSchema.$id});
			assert.isTrue(data.properties.testIndex.isIndex, "isIndex is set to true in schema entry");
			assert.isTrue(data.properties.testIndex.isUnique, "isUnique is set to true in schema entry");
		});

		describe("auto increment", function(){
			before(async function(){
				await utils.resetTestTables();
				await utils.setupSuite();
				Random = createInstance(connection, testSchema.$id);
			});

			it("should create an entry in _counters collection if set as auto increment", async function(){
				const client = await connect;
				const db = client.db();

				await table.addIndex({
					name: "testIndex",
					autoIncrement: true
				});

				const res = await db.collection("_counters").findOne({_$id: testSchema.$id});
				assert.isNotNull(res, "entry not found in _counters collection");
				assert.isDefined(res.sequences, "entry not defined correctly");
				assert.strictEqual(res.sequences.testIndex, 0, "entry not initialized correctly");
			});
			it("should make the index unique if set as auto increment", async function(){
				const client = await connect;
				const db = client.db();

				await table.addIndex({
					name: "testIndex",
					autoIncrement: true
				});

				const res = await db.collection(testSchema.$id).listIndexes().toArray();
				const index = _.find(res, function(el){
					return el.name == "testIndex";
				});
				assert.isTrue(index.unique, "index is marked as unique");
			});
			// Following potentially tested in DynamicRecordModel.js
			it("should increment the counter when a new entry is added", async function(){
				const client = await connect;
				const db = client.db();

				await table.addIndex({
					name: "testIndex",
					autoIncrement: true
				});

				const model = new Random.Model({
					"string": "Laborum non culpa.",
					"wholeNumber": 27,
					"floatingPoint": 6.2831853072
				});
				await model.save();

				let m = await db.collection(testSchema.$id).findOne({
					"string": "Laborum non culpa."
				});
				assert.equal(m.testIndex, 1, "auto increment index is set to 1");

				const model2 = new Random.Model({
					"string": "Fugiat laboris cillum quis pariatur.",
					"wholeNumber": 42,
					"floatingPoint": 2.7182818285
				});
				await model2.save();

				m = await db.collection(testSchema.$id).findOne({
					"string": "Fugiat laboris cillum quis pariatur."
				});
				assert.equal(m.testIndex, 2, "auto increment index is set to 2");
			});
			it("should update an entry with auto inrementing counter without changing its value", async function(){
				const client = await connect;
				const db = client.db();

				await table.addIndex({
					name: "testIndex",
					autoIncrement: true
				});

				const model = new Random.Model({
					"string": "Laborum non culpa.",
					"wholeNumber": 27,
					"floatingPoint": 6.2831853072
				});

				await model.save();
				model.data.wholeNumber = 100;

				await model.save();
				assert.equal(model.data.testIndex, 1, "auto incrementing index is set to 1");
				assert.equal(model._original.testIndex, 1, "auto incrementing index is set to 1");

				const m = await db.collection(testSchema.$id).findOne({wholeNumber: 100});
				assert.equal(m.testIndex, 1, "auto incrementing index is set to 1");
			});
			it("should increment entry in the _counters collection", async function(){
				const client = await connect;
				const db = client.db();

				await table.addIndex({
					name: "testIndex",
					autoIncrement: true
				});

				const model = new Random.Model({
					"string": "Laborum non culpa.",
					"wholeNumber": 27,
					"floatingPoint": 6.2831853072
				});
				await model.save();

				let res = await db.collection("_counters").findOne({_$id: testSchema.$id});
				assert.equal(res.sequences.testIndex, 1);

				const model2 = new Random.Model({
					"string": "Fugiat laboris cillum quis pariatur.",
					"wholeNumber": 42,
					"floatingPoint": 2.7182818285
				});
				await model2.save();

				res = await db.collection("_counters").findOne({_$id: testSchema.$id});
				assert.equal(res.sequences.testIndex, 2);
			});
			it("should update the schema entry in database", async function(){
				const client = await connect;
				const db = client.db();

				await table.addIndex({
					name: "testIndex",
					autoIncrement: true
				});

				const data = await db.collection("_schema").findOne({"_$id": testSchema.$id});
				assert.isTrue(data.properties.testIndex.isIndex, "isIndex is set to true in schema entry");
				assert.isTrue(data.properties.testIndex.isUnique, "isUnique is set to true in schema entry");
				assert.isTrue(data.properties.testIndex.isAutoIncrement, "isAutoIncrement is set to true in schema entry");
			});
		});
	});

	describe("removeIndex()", function(){
		let table;

		beforeEach(async function(){
			await utils.resetTestTables();
			table = createSchemaInstance(connection);
			await table.createTable(testSchema);
			await table.addIndex({
				name: "testIndex",
			});
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should remove the column from the index list", async function(){
			const client = await connect;
			const db = client.db();

			await table.removeIndex("testIndex");

			const res = await db.collection(testSchema.$id).listIndexes().toArray();
			const index = _.find(res, function(el){
				return el.name == "testIndex";
			});
			assert.isUndefined(index, "index does not exist in database");
		});
		it("should update the schema entry in database", async function(){
			const client = await connect;
			const db = client.db();

			await table.removeIndex("testIndex");

			const data = await db.collection("_schema").findOne({"_$id": testSchema.$id});
			assert.isNotOk(data.properties.testIndex.isIndex, "isIndex is falsy in schema entry");
			assert.isNotOk(data.properties.testIndex.isUnique, "isUnique is falsy in schema entry");
		});

		describe("auto increment", function(){
			beforeEach(function(){
				return table.addIndex({
					name: "autoIncrement",
					autoIncrement: true
				});
			});

			it("should remove relevant entry from _counters collection", async function(){
				const client = await connect;
				const db = client.db();

				await table.removeIndex("autoIncrement");

				const m = await db.collection("_counters").findOne({"_$id": table.tableSlug});
				assert.doesNotHaveAnyKeys(m.sequences, ["autoIncrement"], "index does not exist in _counters table");
			});
			it("should update the schema entry in database", async function(){
				const client = await connect;
				const db = client.db();

				await table.removeIndex("testIndex");

				const data = await db.collection("_schema").findOne({"_$id": testSchema.$id});
				assert.isNotOk(data.properties.testIndex.isIndex, "isIndex is falsy in schema entry");
				assert.isNotOk(data.properties.testIndex.isUnique, "isUnique is falsy in schema entry");
				assert.isNotOk(data.properties.testIndex.isAutoIncrement, "isAutoIncrement is falsy in schema entry");
			});
		});
	});

	describe("read()", function(){
		beforeEach(async function(){
			await utils.resetTestTables();
			await utils.setupSuite();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should read the schema entry from the database correctly", async function(){
			const table = createSchemaInstance(connection);
			await table.read(testSchema.$id);
			assert.equal(table.tableSlug, testSchema.$id, "object slug is equal to testSchema.$id");
			assert.deepEqual(table.definition, testSchema.properties, "object definition is as defined");
			assert.deepEqual(table.required, testSchema.required, "required properties is as defined");
		});
	});

	describe("define()", function(){
		beforeEach(async function(){
			await utils.resetTestTables();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should write the schema definition to the database", async function(){
			const client = await connect;
			const db = client.db();

			const emptyTestSchema = _.cloneDeep(testSchema);
			emptyTestSchema.properties = {};

			const table = createSchemaInstance(connection);
			await table.createTable(emptyTestSchema);
			await table.define(testSchema.properties);

			const data = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.deepEqual(data.properties, testSchema.properties, "database entry has correct definition");
		});
		it("should set the correct definition", async function(){
			const table = createSchemaInstance(connection);
			await table.define(testSchema.properties);
			assert.deepEqual(table.definition, testSchema.properties, "object definition is set correctly");
		});
		it("should update the required field with provided values", async function(){
			const client = await connect;
			const db = client.db();

			const emptyTestSchema = _.cloneDeep(testSchema);
			emptyTestSchema.properties = {};
			emptyTestSchema.required = [];

			const table = createSchemaInstance(connection);
			await table.createTable(emptyTestSchema);
			await table.define(testSchema.properties, testSchema.required);

			const data = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.deepEqual(data.required, testSchema.required, "required field is updated");
		});
	});

	describe("addColumn()", function(){
		beforeEach(async function(){
			await utils.resetTestTables();
			await utils.setupSuite();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should add a column entry to the definition and database", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);
			await table.read(testSchema.$id);
			assert.isDefined(table.tableSlug);
			assert.isDefined(table.definition);

			await table.addColumn("test_column", "string", "test description");
			assert.deepInclude(table.definition, {
				"test_column": {
					"description": "test description",
					"type": "string"
				}
			}, "object definition include new column");

			const data = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.deepInclude(data.properties, {
				"test_column": {
					"description": "test description",
					"type": "string"
				}
			}, "database entry include new column");
		});
		it("should return a rejected promise if the column already exist", function(done){
			const table = createSchemaInstance(connection);
			table.read(testSchema.$id).then(() => {
				return table.addColumn("string", "string", "Should already exist");
			}).then(() => {
				done("Promise is not rejected upon encountering duplicated column name");
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
		beforeEach(async function(){
			await utils.resetTestTables();
			await utils.setupSuite();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should add multiple columns to the definition and database", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);
			await table.read(testSchema.$id);
			await table.addColumns({
				"test_column_1": {
					description: "Test Column 1",
					type: "string"
				},
				"test_column_2": {
					description: "Test Column 2",
					type: "number"
				}
			});

			const data = await db.collection("_schema").findOne({"_$id": table.tableSlug});
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
		it("should return a rejected promise if any columns already exist", function(done){
			const table = createSchemaInstance(connection);
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
				done("Promise is not rejected upon encountering duplicated column name");
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
		beforeEach(async function(){
			await utils.resetTestTables();
			await utils.setupSuite();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should remove a specified column entry from the definition", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);

			await table.read(testSchema.$id);
			assert.isDefined(table.tableSlug);
			assert.isDefined(table.definition);

			await table.removeColumn("floatingPoint");
			assert.notDeepInclude(table.definition, {
				"floatingPoint": {
					"description": "Column of type 'Number'",
					"type": "number"
				}
			}, "removed field is not in object definition");

			const data = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.notDeepInclude(data.properties, {
				"floatingPoint": {
					"description": "Column of type 'Number'",
					"type": "number"
				}
			}, "removed field is not in database entry");
		});
	});

	describe("renameColumn()", function(){
		beforeEach(async function(){
			await utils.resetTestTables();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should rename a specified column entry in the definition", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);

			await table.createTable(testSchema);
			assert.isDefined(table.tableSlug);
			assert.isDefined(table.definition);

			await table.renameColumn("wholeNumber", "number");
			assert.notDeepInclude(table.definition, {
				"wholeNumber": {
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

			const data = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.notDeepInclude(data.properties, {
				"wholeNumber": {
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

		it("should rename the _counters entry if it is an auto incrementing index", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);

			await table.createTable(testSchema);
			assert.isDefined(table.tableSlug);
			assert.isDefined(table.definition);

			await table.renameColumn("wholeNumber", "number");
			const entry = await db.collection("_counters").findOne({"_$id": table.tableSlug});
			assert.hasAnyKeys(entry.sequences, "number", "sequences has key 'number'");
			assert.doesNotHaveAnyKeys(entry.sequences, "wholeNumber", "sequences doesn't have key 'wholeNumber'");
		});
	});

	describe("changeColumnType()", function(){
		beforeEach(async function(){
			await utils.resetTestTables();
		});

		after(async function(){
			await utils.dropTestTable();
		});

		it("should change the specified column type in the definition", async function(){
			const client = await connect;
			const db = client.db();

			const table = createSchemaInstance(connection);

			await table.createTable(testSchema);
			assert.isDefined(table.tableSlug);
			assert.isDefined(table.definition);

			await table.changeColumnType("floatingPoint", "integer");
			assert.notDeepInclude(table.definition, {
				"floatingPoint": {
					"description": "Column of type 'Number'",
					"type": "number"
				}
			}, "object definition does not include old type");
			assert.deepInclude(table.definition, {
				"floatingPoint": {
					"description": "Column of type 'Number'",
					"type": "integer"
				}
			}, "object definition includes new type");

			const data = await db.collection("_schema").findOne({_$id: testSchema.$id});
			assert.notDeepInclude(data.properties, {
				"floatingPoint": {
					"description": "Column of type 'Number'",
					"type": "number"
				}
			}, "database entry does not include old type");
			assert.deepInclude(data.properties, {
				"floatingPoint": {
					"description": "Column of type 'Number'",
					"type": "integer"
				}
			}, "database entry includes new type");
		});
	});
});
// --------------------------------------------