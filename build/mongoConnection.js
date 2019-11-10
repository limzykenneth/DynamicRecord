require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const mongoURL = `mongodb://${process.env.mongo_user}:${process.env.mongo_pass}@${process.env.mongo_server}/${process.env.mongo_db_name}`;
const client = new MongoClient(mongoURL, {
    poolSize: 10,
    useUnifiedTopology: true
});
const connection = client.connect();
module.exports = connection.then((client) => {
    const db = client.db();
    return Promise.resolve({ db, client });
});
