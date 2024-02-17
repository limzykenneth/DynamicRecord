const MongoClient = require("mongodb").MongoClient;

module.exports = async function(url){
	const connect = MongoClient.connect(url);

	const client = await connect;
	const db = client.db();

	let col = await db.collection("_schema");
	await col.createIndex("_$id", {unique: true});

	col = await db.collection("_counters");
	await col.createIndex("_$id", {unique: true});

	await client.close();
};