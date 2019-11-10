require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;

const mongoURL = `mongodb://${process.env.database_username}:${process.env.database_password}@${process.env.database_host}/${process.env.database_name}`;
const client = new MongoClient(mongoURL, {
	poolSize: 10,
	useUnifiedTopology: true
});
const connection = client.connect();
module.exports = connection.then((client) => {
	const db = client.db();
	return Promise.resolve({db, client});
});