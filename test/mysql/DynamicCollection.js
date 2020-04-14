// For setup and clean ups
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const mysql = require("mysql2");
const url = require("../utils.js").url;
const connect = mysql.createConnection(url);

// Test dependencies
const DynamicRecord = require("../../build/main.js");
const DynamicCollection = DynamicRecord.DynamicCollection;
const utils = new (require("../utils.js").utils)(connect);
const chai = require("chai");
const assert = chai.assert;

// Schema definition
const testSchema = Object.freeze(require("../random_table.schema.json"));

let Random;

// ------------------ Setups ------------------
// Clear table and insert dummy data
before(function(done){
	utils.resetTestTables().then(() => {
		connect.then((connection) => {
			return connection.execute("CREATE TABLE ?", [testSchema.$id]);
		}).then(() => {
			done();
		});
	});
});