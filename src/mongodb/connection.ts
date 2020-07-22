import * as _ from "lodash";
import {MongoClient} from "mongodb";
const constants = require("../../tools/_constants");

const databaseURIRegex = constants.databaseRegex;
const regexResult = _.clone(process.env.database_host.match(databaseURIRegex).groups);
if(!regexResult.username){
	regexResult.username = process.env.database_username;
}
if(!regexResult.password){
	regexResult.password = process.env.database_password;
}
if(regexResult.port){
	regexResult.port = `:${regexResult.port}`;
}
if(!regexResult.database){
	regexResult.database = process.env.database_name;
}
if(!regexResult.options){
	regexResult.options = "";
}

const url = `${regexResult.schema}://${regexResult.username}:${regexResult.password}@${regexResult.host}${regexResult.port || ""}/${regexResult.database}?${regexResult.options}`;
const client = new MongoClient(url, {
	poolSize: 10,
	useNewUrlParser: true,
	useUnifiedTopology: true
});
const connection = client.connect();

export default connection.then((client) => {
	const db = client.db();
	return Promise.resolve({db, client});
});