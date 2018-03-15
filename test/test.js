// For setup and clean ups
require("dotenv").config();
const f = require("util").format;
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const connect = MongoClient.connect(mongoURL);

// Test dependencies
const ActiveRecord = require("../index.js");
const assert = require("chai").assert;

let Random;
// Clear table and insert dummy data
before(function(done){
	dropTestTable(function(reply){
		Random = new ActiveRecord("random_table");
		done();
	});
});

describe("Schema", function(){
	before(function(){

	});

	afterEach(function(){
		// Clear table
	});

	describe("createTable()", function(){
		it("should create a new empty table or collection in the database and schema file");
	});

	describe("read()", function(){
		it("should read the schema entry from the schema file");
		it("should have the correct name");
		it("should have the correct definition");
	});

	describe("define()", function(){
		it("should write the schema definition to the schema file");
		it("should set the correct name");
		it("should set the correct definition");
	});

	describe("addColumn()", function(){
		it("should add a column entry to the definition");
		it("should update the schema definition in the schema file");
	});

	describe("removeColumn()", function(){
		it("should remove a specified column entry from the definition");
		it("should update the schema definition in the schema file");
	});

	describe("renameColumn()", function(){
		it("should rename a specified column entry in the definition");
		it("should update the schema definition in the schema file");
	});

	describe("changeColumnType()", function(){
		it("should change the specified column type in the definition");
		it("should update the schema definition in the schema file");
	});
});

describe("ActiveRecord", function(){
	describe("Constructor", function(){
		it("should retrieve the specified table or collection from the database");
	});

	describe("findBy()", function(){
		it("should retrieve an entry from the database matching the query");
		it("should return a single object of type ActiveRecord.Model");
		it("should return null if an entry is not found");
	});

	describe("where()", function(){
		it("should retrieve all entries from the database matching the query");
		it("should return an array descendent of type ActiveCollection");
		it("should return an empty array descendent if query returns nothing");
	});

	describe("all()", function(){
		it("should retrieve all entries from the database");
		it("should return an array descendent of type ActiveCollection");
		it("should return an empty array descendent if database is empty");
	});

	describe("first()", function(){
		it("should retrieve one latest entry from the database");
		it("should return a single object of type ActiveRecord.Model");
		it("should return null if an entry is not found");
	});
});

describe("Model", function(){
	describe("Constructor", function(){
		it("should set the data object according to the object passed in");
		it("should make a deep copy of the object if _preserveOriginal is truthy");
		it("should have a null _original object if _preserveOriginal is falsy");
	});

	describe("save()", function(){
		it("should insert the corresponding entry in the database if not exist");
		it("should update the corresponding entry in the database if exist");
		it("should update the deep copy of the data into _original");
	});

	describe("destroy()", function(){
		it("should delete the corresponding entry in the database");
		it("should clear remaining data in data and _original object");
		it("should throw an error if an entry is not found in the database");
	});
});

describe("ActiveCollection", function(){
	it("should be an instance of Array");
	it("should have the same methods as Array");
	it("should have a property 'data' that returns a regular array of data");
	it("should update 'data' property whenever its data is updated");
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
			console.log(err);
		});
	});
}

