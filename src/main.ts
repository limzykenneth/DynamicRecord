const databaseURIRegex = /^(?<schema>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
const regexResult = process.env.database_host.match(databaseURIRegex);

let DynamicRecord;

switch(regexResult.groups.schema){
	case "mongodb":
	case "mongodb+srv":
		DynamicRecord = require("./mongodb/DynamicRecord.js");
		break;

	case "mysql":
		DynamicRecord = require("./mysql/DynamicRecord.js");
		break;

	default:
		throw new Error("Environment not set up correctly");
}

module.exports = DynamicRecord;