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
	const connection = await connect;

	const fields = [];
	const indexes = [];
	_.each(testSchema.properties, (property, key) => {
		switch(property.type){
			case "string":
				fields.push(`${key} LONGTEXT`);
				break;

			case "integer":
				fields.push(`${key} INT`);
				break;

			case "number":
				fields.push(`${key} DOUBLE`);
				break;

			case "boolean":
				fields.push(`${key} BOOLEAN`);
				break;

			// NOTE: If it's `null`, `object`, or `array`, we just store as string for now
			default:
				fields.push(`${key} LONGTEXT`);
		}

	});

	let tableQuery = `CREATE TABLE ${testSchema.$id} (${fields.join(", ")})`;

	await connection.execute(tableQuery);
	await connection.execute("INSERT INTO _schema ($id, jsonschema) VALUES (?, ?)", [testSchema.$id, JSON.stringify(testSchema)]);
});

after(async function(){
	await Random.closeConnection();
	await utils.dropTestTable();
	await utils.cleanUpSuite();
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("DynamicCollection", function(){
	let col;
	beforeEach(function(){
		col = new DynamicCollection();
	});
	afterEach(function(){
		col = null;
	});

	it("should be an instance of Array", function(){
		assert.instanceOf(col, Array, "collection is an instance of Array");
	});
	it("should have the same methods as Array", function(){
		assert.isFunction(col.push, "collection has function push");
		assert.isFunction(col.pop, "collection has function pop");
		assert.isFunction(col.slice, "collection has function slice");
		assert.isFunction(col.splice, "collection has function splice");
		assert.isFunction(col.map, "collection has function map");
		assert.isFunction(col.reduce, "collection has function reduce");
	});
	it("should have a property 'data' that returns a regular array of data", function(){
		assert.exists(col.data, "collection data exist");
		assert.isArray(col.data, "collection data is an array");
		assert.notInstanceOf(col.data, DynamicCollection, "collection data is not an instance of DynamicCollection");
	});
	it("should update 'data' property whenever its data is updated", function(){
		col.push(new Random.Model({
			"string": "Magna dolor."
		}));

		assert.deepInclude(col.data, {
			"string": "Magna dolor."
		}, "collection data include pushed entry");
	});
});