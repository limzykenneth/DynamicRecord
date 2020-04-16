import * as _ from "lodash";
import * as mysql from "mysql2/promise";

const constants = require("../../tools/_constants");

const databaseURIRegex = constants.databaseRegex;
const regexResult = _.clone(process.env.database_host.match(databaseURIRegex).groups);
if(!regexResult.username){
	regexResult.username = process.env.database_username;
}
if(!regexResult.password){
	regexResult.password = process.env.database_password;
}
if(!regexResult.port){
	regexResult.port = "3306";
}
if(!regexResult.database){
	regexResult.database = process.env.database_name;
}
if(!regexResult.options){
	regexResult.options = "";
}

const url = `${regexResult.schema}://${regexResult.username}:${regexResult.password}@${regexResult.host}:${regexResult.port}/${regexResult.database}?${regexResult.options}`;
const connection = mysql.createPool(url);
export default connection;