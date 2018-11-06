const f = require("util").format;
const MongoClient = require("mongodb").MongoClient;

module.exports = function(databaseAddress, databaseName, username, password){
	const mongoURL = f("mongodb://%s:%s@%s/%s", username, password, databaseAddress, databaseName);
	const connection = MongoClient.connect(mongoURL, {poolSize: 10});
	return connection;
};