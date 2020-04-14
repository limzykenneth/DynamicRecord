require("dotenv").config();
const _ = require("lodash");
const constants = require("./tools/_constants.js");

const databaseURIRegex = constants.databaseRegex;
const regexResult = _.clone(process.env.database_host.match(databaseURIRegex).groups);
const databaseType = constants.databaseEnums[regexResult.schema];

let spec = null;

if(databaseType === constants.databaseEnums.mongodb){
	spec = "test/mongodb"
}else if(databaseType === constants.databaseEnums.mysql){
	spec = "test/mysql"
}

module.exports = {
	spec
}