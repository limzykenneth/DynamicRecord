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
	createCollection,
	DynamicCollection
} = require("../../build/main.js");

// Database specific dependencies
const MongoClient = require("mongodb").MongoClient;
const connect = MongoClient.connect(url, {
	useUnifiedTopology: true,
	useNewUrlParser: true
});

// Setup helpers
const utils = new utility.utils(connect);

// Schema definition
const testSchema = Object.freeze(require("../random_table.schema.json"));
const testData = utility.testData;

let Random, connection;

// ------------------ Setups ------------------
// Clear table and insert dummy data
before(async function(){
	await utils.resetTestTables();
	await utils.setupSuite();

	connection = await createConnection(process.env.database_host);

	Random = createInstance(connection, testSchema.$id);
});

// Close all database connections
after(async function(){
	await connection.interface.client.close();
	await utils.dropTestTable();
	await utils.cleanUpSuite();
});
// --------------------------------------------

// ----------------- Tests --------------------
describe("DynamicCollection", function(){
	let col;
	beforeEach(function(){
		col = createCollection(connection);
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

	describe("saveAll()", function(){
		let col;

		beforeEach(function(){
			const data = _.cloneDeep(testData);
			col = createCollection(connection, Random.Model, ...data);
		});

		afterEach(function(){
			return utils.resetTestTables();
		});

		it("should call save function of all the models in the collection", async function(){
			await col.saveAll();

			const client = await connect;
			const db = client.db();
			const res = await db.collection(testSchema.$id).find().toArray();
			res.forEach((el) => {
				delete el._id;
			});

			_.each(col.data, (el) => {
				assert.deepInclude(res, el);
			});
		});

		describe("autoIncrement", function(){
			beforeEach(async function(){
				const client = await connect;
				const db = client.db();
				await db.collection("_counters").insertOne({
					"_$id": testSchema.$id,
					sequences: {
						wholeNumber: 0
					}
				});
			});

			afterEach(async function(){
				const client = await connect;
				const db = client.db();
				await db.collection("_counters").deleteOne({"_$id": testSchema.$id});
			});

			it("should set the autoincrementing index correctly", async function(){
				col.forEach((model) => {
					delete model.data.wholeNumber;
				});

				await col.saveAll();

				const client = await connect;
				const db = client.db();
				const res = await db.collection(testSchema.$id).find().toArray();

				for(let i=0; i<res.length; i++){
					assert.equal(res[i].wholeNumber, i+1, `database entry has auto increment value ${i+1}`);
				}
				for(let i=0; i<col.length; i++){
					assert.equal(col[i].data.wholeNumber, i+1, `collection entry has auto increment value ${i+1}`);
				}
			});
		});
	});

	describe("dropAll()", function(){
		let col;

		beforeEach(function(){
			const data = _.cloneDeep(testData);
			col = createCollection(connection, Random.Model, ...data);
		});

		afterEach(function(){
			return utils.resetTestTables();
		});

		it("should call destroy function of all the models in the collection", async function(){
			await col.saveAll();
			await col.dropAll();

			const client = await connect;
			const db = client.db();
			const res = await db.collection(testSchema.$id).find().toArray();

			assert.lengthOf(res, 0, "collection doesn't exist in database");
			_.each(col.data, (el) => {
				assert.isNull(el, "models in collection are emptied out");
			});
		});
	});
});
// --------------------------------------------