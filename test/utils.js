require("dotenv").config();
const _ = require("lodash");

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
if(!regexResult.port){
	regexResult.port = "27017";
}
if(!regexResult.database){
	regexResult.database = process.env.database_name;
}
if(!regexResult.options){
	regexResult.options = "";
}

const url = `${regexResult.schema}://${regexResult.username}:${regexResult.password}@${regexResult.host}:${regexResult.port}/${regexResult.database}?${regexResult.options}`;

let utils = function(connect){
	this.databaseType = constants.databaseEnums[regexResult.schema];
	this.connect = connect;
};

utils.prototype.createTestTable = async function(){
	if(this.databaseType === constants.databaseEnums.mongodb){
		await initMongodb({
			url
		});
	}else if(this.databaseType === constants.databaseEnums.mongodb){
		await initMySQL({
			url
		});
	}
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

module.exports = {
	utils,
	url
};