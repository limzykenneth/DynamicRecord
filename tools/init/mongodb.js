const MongoClient = require("mongodb").MongoClient;

module.exports = function(response){
	const mongoURL = `mongodb://${response.username}:${response.password}@${response.serverPath}/${response.database}`;
	const connect = MongoClient.connect(mongoURL, {useUnifiedTopology: true});

	return connect.then((client) => {
		const db = client.db();
		return db.createCollection("_schema").then((col) => {
			return col.createIndex("_$id", {unique: true});
		}).then(() => {
			return db.createCollection("_counters");
		}).then((col) => {
			return col.createIndex("_$id", {unique: true});
		}).then(() => {
			return Promise.resolve(client);
		});
	}).then((client) => {
		return client.close();
	}).catch((err) => {
		return Promise.reject(err);
	});
};