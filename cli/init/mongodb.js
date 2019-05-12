const MongoClient = require("mongodb").MongoClient;

module.exports = function(response){
	const mongoURL = `mongodb://${response.username}:${response.password}@${response.serverPath}/${response.database}`;
	const connect = MongoClient.connect(mongoURL);

	return connect.then((db) => {
		return db.createCollection("_schema").then((col) => {
			return col.createIndex("_$id", {unique: true});
		}).then(() => {
			return db.createCollection("_counters");
		}).then((col) => {
			return col.createIndex("_$id", {unique: true});
		}).then(() => {
			return Promise.resolve(db);
		});
	}).then((db) => {
		console.log(`Initialized mongodb database ${response.database}`);
		return db.close();
	}).catch((err) => {
		return Promise.reject(err);
	});
};