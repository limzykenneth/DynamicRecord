require("dotenv").config();
const initMongodb = require("../tools/init/mongodb.js");

const testSchema = Object.freeze(require("./random_table.schema.json"));

let utils = function(connect){
	this.connect = connect;
};

utils.prototype.createTestTable = function(){
	return initMongodb({
		username: process.env.database_username,
		password: process.env.database_password,
		serverPath: process.env.database_host,
		database: process.env.database_name
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

module.exports = utils;