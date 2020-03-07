require("dotenv").config();
const _ = require("lodash");
const initMongodb = require("../tools/init/mongodb.js");

const testSchema = Object.freeze(require("./random_table.schema.json"));

const databaseURIRegex = /^(?<schema>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
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

let utils = function(connect){
	this.connect = connect;
};

utils.prototype.createTestTable = function(){
	return initMongodb({
		username: regexResult.username,
		password: regexResult.password,
		serverPath: `${regexResult.host}:${regexResult.port}`,
		database: regexResult.database
	});
};

utils.prototype.dropTestTable = function(){
	return this.connect.then((client) => {
		const db = client.db();
		return db.collection(testSchema.$id).drop().then(() => {
			return Promise.resolve(db);
		}).catch((err) => {
			if(err.message == "ns not found"){
				return Promise.resolve(db);
			}else{
				console.error(err);
			}
		});
	}).then((db) => {
		return db.collection("_counters").drop().then(() => {
			return Promise.resolve(db);
		}).catch((err) => {
			if(err.message == "ns not found"){
				return Promise.resolve(db);
			}else{
				console.error(err);
			}
		});
	}).then((db) => {
		return db.collection("_schema").drop().then(() => {
			return Promise.resolve(db);
		}).catch((err) => {
			if(err.message == "ns not found"){
				return Promise.resolve(db);
			}else{
				console.error(err);
			}
		});
	}).then((db) => {
		return db.collection("test_table").drop().catch((err) => {
			if(err.message == "ns not found"){
				return Promise.resolve(db);
			}else{
				console.error(err);
			}
		});
	});
};

utils.prototype.resetTestTables = function(){
	return this.dropTestTable().then(() => {
		return this.createTestTable();
	});
};

module.exports = {
	utils,
	url: `${regexResult.schema}://${regexResult.username}:${regexResult.password}@${regexResult.host}:${regexResult.port}/${regexResult.database}?${regexResult.options}`
};