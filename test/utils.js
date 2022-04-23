require("dotenv").config();
const _ = require("lodash");

const initDB =  require("../tools/init.js").init;
const initMongodb = require("../tools/init/mongodb.js");
const mongodbUtils = require("./mongodb/utils");

const initMySQL = require("../tools/init/mysql.js");
const mysqlUtils = require("./mysql/utils");

const constants = require("../tools/_constants.js");

const databaseURIRegex = constants.databaseRegex;
const regexResult = _.clone(process.env.database_host.match(databaseURIRegex).groups);
if(!regexResult.username){
	regexResult.username = process.env.database_username;
}
if(!regexResult.password){
	regexResult.password = process.env.database_password;
}
if(regexResult.port){
	regexResult.port = `:${regexResult.port}`;
}
if(!regexResult.database){
	regexResult.database = process.env.database_name;
}
if(!regexResult.options){
	regexResult.options = "";
}

const url = `${regexResult.schema}://${regexResult.username}:${regexResult.password}@${regexResult.host}${regexResult.port || ""}/${regexResult.database}?${regexResult.options}`;
console.log("url", url);
let utils = function(connect){
	this.databaseType = constants.databaseEnums[regexResult.schema];
	this.connect = connect;
};

utils.prototype.createTestTable = async function(){
	await initDB(url, false, true);
};

utils.prototype.dropTestTable = async function(){
	if(this.databaseType === constants.databaseEnums.mongodb){
		await mongodbUtils.dropTestTable(this.connect);
	}else if(this.databaseType === constants.databaseEnums.mysql){
		await mysqlUtils.dropTestTable(this.connect);
	}
};

utils.prototype.resetTestTables = async function(){
	await this.dropTestTable();
	await this.createTestTable();
};

utils.prototype.setupSuite = async function(){
	if(this.databaseType === constants.databaseEnums.mongodb){
		await mongodbUtils.setupSuite(this.connect);
	}else if(this.databaseType === constants.databaseEnums.mysql){
		await mysqlUtils.setupSuite(this.connect);
	}
};

utils.prototype.cleanUpSuite = async function(){
	if(this.databaseType === constants.databaseEnums.mongodb){
		await mongodbUtils.cleanUpSuite(this.connect);
	}else if(this.databaseType === constants.databaseEnums.mysql){
		await mysqlUtils.cleanUpSuite(this.connect);
	}
};

// Data to be inserted into database for testing
// Each element in array correspond to an entry in database
// Objects keys are just for reference, not meant to represent actual types
const testData = Object.freeze([
	{
		"string": "Velit tempor.",
		"wholeNumber": 42,
		"floatingPoint": 3.1415926536,
		"testIndex": 0
	},
	{
		"string": "Fugiat laboris cillum quis pariatur.",
		"wholeNumber": 42,
		"floatingPoint": 2.7182818285,
		"testIndex": 1
	},
	{
		"string": "Reprehenderit sint.",
		"wholeNumber": 10958,
		"floatingPoint": 2.7182818285,
		"testIndex": 2
	}
]);

module.exports = {
	utils,
	url,
	testData
};