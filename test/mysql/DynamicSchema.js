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
describe("Schema", function(){
	describe("createTable()", function(){
		beforeEach(function(){
			return utils.resetTestTables();
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should create an empty table or collection in the database", async function(){
			const table = new DynamicSchema();
			await table.createTable(testSchema);

			const connection = await connect;
			const [result] = await connection.execute("SELECT table_name FROM INFORMATION_SCHEMA.TABLES WHERE table_name=?", [testSchema.$id]);
			const t = _.find(result, (entry) => {
				return entry.TABLE_NAME === testSchema.$id;
			});

			assert.exists(t);
		});
		it("should create an empty table or collection with provided index", async function(){
			const table = new DynamicSchema();
			await table.createTable(testSchema);

			const connection = await connect;
			const [result] = await connection.execute(`SHOW INDEXES FROM ${testSchema.$id}`);
			assert.equal(result.length, 1, "only one index created");
			assert.equal(result[0].Key_name, "wholeNumber", "index name is correct");
			assert.equal(result[0].Non_unique, 0, "index is unique");

		});
		it("should populate its properties according to schema provided", async function(){
			const table = new DynamicSchema();
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
			table = new DynamicSchema();
			await table.createTable(testSchema);
		});

		after(function(){
			return utils.dropTestTable();
		});

		it("should remove the table's entry in the _schema table");
		it("should drop the table itself");
		it("should remove the table's entry in the _counters table");
	// 	it("should remove existing data from the instance", async function(){
	// 		await table.dropTable();
	// 		assert.isNull(table.tableName, "Table name is set to null");
	// 		assert.isNull(table.tableSlug, "Table slug is set to null");
	// 		assert.isEmpty(table.definition, "Table definition is emptied");
	// 	});
	});

	// describe("renameTable()", function(){
	// 	let table;

	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		table = new DynamicSchema();
	// 		await table.createTable(testSchema);
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should rename the table in database and object instance");
	// 	it("should default new name to new slug");
	// 	it("should rename the entry in _schema table");
	// 	it("should rename the entry in _counters table");
	// });

	// describe("addIndex()", function(){
	// 	let table;

	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		table = new DynamicSchema();
	// 		await table.createTable(testSchema);
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should create a new index");
	// 	it("should make the index unique by default");
	// 	it("should not make the index unique if passed false to unique");
	// });

	// describe("removeIndex()", function(){
	// 	let table;

	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		table = new DynamicSchema();
	// 		await table.createTable(testSchema);
	// 		await table.addIndex({
	// 			name: "testIndex",
	// 		});
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should remove the column from the index list");
	// });

	// describe("read()", function(){
	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		await utils.setupSuite();
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should read the schema entry from the database correctly", async function(){
	// 		const table = new DynamicSchema();
	// 		await table.read(testSchema.$id);
	// 		assert.equal(table.tableSlug, testSchema.$id, "object slug is equal to testSchema.$id");
	// 		assert.deepEqual(table.definition, testSchema.properties, "object definition is as defined");
	// 		assert.deepEqual(table.required, testSchema.required, "required properties is as defined");
	// 	});
	// });

	// describe("define()", function(){
	// 	beforeEach(function(){
	// 		return utils.resetTestTables();
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should write the schema definition to the database");
	// 	it("should set the correct definition", async function(){
	// 		const table = new DynamicSchema();
	// 		await table.define(testSchema.properties);
	// 		assert.deepEqual(table.definition, testSchema.properties, "object definition is set correctly");
	// 	});
	// });

	// describe("addColumn()", function(){
	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		await utils.setupSuite();
	// 	});


	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should add a column entry to the definition and database");
	// 	it("should return a rejected promise if the column already exist", function(done){
	// 		const table = new DynamicSchema();
	// 		table.read(testSchema.$id).then(() => {
	// 			return table.addColumn("string", "string", "Should already exist");
	// 		}).then(() => {
	// 			done(new Error("Promise is not rejected upon encountering duplicated column name"));
	// 		}).catch((err) => {
	// 			if(err.message === "Column name \"string\" already exist"){
	// 				done();
	// 			}else{
	// 				done(err);
	// 			}
	// 		});
	// 	});
	// });

	// describe("addColumns()", function(){
	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		await utils.setupSuite();
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should add multiple columns to the definition and database");
	// 	it("should return a rejected promise if any columns already exist");
	// });

	// describe("removeColumn()", function(){
	// 	beforeEach(async function(){
	// 		await utils.resetTestTables();
	// 		await utils.setupSuite();
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should remove a specified column entry from the definition");
	// });

	// describe("renameColumn()", function(){
	// 	beforeEach(function(){
	// 		return utils.resetTestTables();
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should rename a specified column entry in the definition");
	// });

	// describe("changeColumnType()", function(){
	// 	beforeEach(function(){
	// 		return utils.resetTestTables();
	// 	});

	// 	after(function(){
	// 		return utils.dropTestTable();
	// 	});

	// 	it("should change the specified column type in the definition");
	// });
});