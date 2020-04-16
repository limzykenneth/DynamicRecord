const _ = require("lodash");
const testSchema = Object.freeze(require("../random_table.schema.json"));

let utils = {};

utils.dropTestTable = function(connect){
	return connect.then((client) => {
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

utils.setupSuite = async function(connect){
	const client = await connect;
	const db = client.db();

	await db.createCollection(testSchema.$id);

	const col = await db.collection("_schema");
	const databaseInsert = _.cloneDeep(testSchema);
	databaseInsert._$id = databaseInsert.$id;
	databaseInsert._$schema = databaseInsert.$schema;
	delete databaseInsert.$id;
	delete databaseInsert.$schema;
	await col.insertOne(databaseInsert);
};

utils.cleanUpSuite = async function(connect){
	const client = await connect;
	await client.close();
};

module.exports = utils;