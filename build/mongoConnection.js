require("dotenv").config();
const f = require("util").format;
const MongoClient = require("mongodb").MongoClient;
const mongoURL = f("mongodb://%s:%s@%s/%s", process.env.mongo_user, process.env.mongo_pass, process.env.mongo_server, process.env.mongo_db_name);
const client = new MongoClient(mongoURL, {
    poolSize: 10,
    useUnifiedTopology: true
});
const connection = client.connect();
module.exports = connection.then((client) => {
    const db = client.db();
    return Promise.resolve({ db, client });
});
// module.exports = function(databaseAddress, databaseName, username, password){
// 	const mongoURL = f("mongodb://%s:%s@%s/%s", username, password, databaseAddress, databaseName);
// 	const connection = MongoClient.connect(mongoURL, {poolSize: 10});
// 	return connection;
// };
