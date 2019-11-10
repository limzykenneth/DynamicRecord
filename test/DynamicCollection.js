// For setup and clean ups
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const MongoClient = require("mongodb").MongoClient;
const mongoURL = `mongodb://${process.env.database_username}:${process.env.database_password}@${process.env.database_host}/${process.env.database_name}`;
const connect = MongoClient.connect(mongoURL, {useUnifiedTopology: true});

// Test dependencies
const DynamicRecord = require("../build/main.js");
const DynamicCollection = DynamicRecord.DynamicCollection;
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

	describe("saveAll()", function(){
		let col;
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
		beforeEach(function(){
			col = new DynamicCollection(Random.Model, ...testData);
		});

		afterEach(function(){
			return utils.resetTestTables();
		});

		it("should call save function of all the models in the collection", function(){
			return col.saveAll().then((res) => {
				return connect.then((client) => {
					const db = client.db();
					return db.collection(testSchema.$id).find().toArray();
				});
			}).then((res) => {
				_.each(col.data, (el) => {
					assert.deepInclude(res, el);
				});
			});
		});

		describe("autoIncrement", function(){
			beforeEach(function(){
				return connect.then((client) => {
					const db = client.db();
					return db.collection("_counters").insertOne({
						"_$id": testSchema.$id,
						sequences: {
							int: 0
						}
					});
				});
			});

			afterEach(function(){
				return connect.then((client) => {
					const db = client.db();
					return db.collection("_counters").deleteOne({"_$id": testSchema.$id});
				});
			});

			it("should set the autoincrementing index correctly", function(){
				col.forEach((model) => {
					delete model.data.int;
				});
				return col.saveAll().then((res) => {
					return connect.then((client) => {
						const db = client.db();
						return db.collection(testSchema.$id).find().toArray();
					});
				}).then((res) => {
					for(let i=0; i<res.length; i++){
						assert.equal(res[i].int, i+1, `database entry has auto increment value ${i+1}`);
					}
					for(let i=0; i<col.length; i++){
						assert.equal(col[i].data.int, i+1, `collection entry has auto increment value ${i+1}`);
					}
				});
			});
		});
	});

	describe("dropAll()", function(){
		let col;
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
		beforeEach(function(){
			col = new DynamicCollection(Random.Model, ...testData);
		});

		afterEach(function(){
			return utils.resetTestTables();
		});

		it("should call save function of all the models in the collection", function(){
			return col.saveAll().then((res) => {
				return col.dropAll();
			}).then(() => {
				return connect.then((client) => {
					const db = client.db();
					return db.collection(testSchema.$id).find().toArray();
				});
			}).then((res) => {
				assert.lengthOf(res, 0, "collection doesn't exist in database");
				_.each(col.data, (el) => {
					assert.isNull(el, "models in collection are emptied out");
				});
			});
		});
	});
});
// --------------------------------------------