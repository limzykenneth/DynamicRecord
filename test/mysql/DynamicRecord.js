// // For setup and clean ups
// require("dotenv").config();
// const Promise = require("bluebird");
// const _ = require("lodash");
// const mysql = require("mysql2/promise");
// const url = require("../utils.js").url;
// const connect = mysql.createConnection(url);

// // Test dependencies
// const DynamicRecord = require("../../build/main.js");
// const DynamicCollection = DynamicRecord.DynamicCollection;
// const utils = new (require("../utils.js").utils)(connect);
// const chai = require("chai");
// const assert = chai.assert;

// // Schema definition
// const testSchema = Object.freeze(require("../random_table.schema.json"));
// // Data to be inserted into database for testing
// // Each element in array correspond to an entry in database
// // Objects keys are just for reference, not meant to represent actual types
// const testData = Object.freeze([
// 	{
// 		"string": "Velit tempor.",
// 		"int": 42,
// 		"float": 3.1415926536,
// 		"testIndex": 0
// 	},
// 	{
// 		"string": "Fugiat laboris cillum quis pariatur.",
// 		"int": 42,
// 		"float": 2.7182818285,
// 		"testIndex": 1
// 	},
// 	{
// 		"string": "Reprehenderit sint.",
// 		"int": 10958,
// 		"float": 2.7182818285,
// 		"testIndex": 2
// 	}
// ]);

// let Random;

// // ------------------ Setups ------------------
// // Clear table and insert dummy data
// before(async function(){
// 	await utils.resetTestTables();
// 	const connection = await connect;
// 	await connection.execute(`CREATE TABLE ${testSchema.$id} (string LONGTEXT)`);
// });

// after(async function(){
// 	await utils.dropTestTable();
// 	const connection = await connect;
// 	await connection.destroy();
// });
// // --------------------------------------------

// // ----------------- Tests --------------------