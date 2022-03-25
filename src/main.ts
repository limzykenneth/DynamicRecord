import {DynamicRecord} from "./DynamicRecord";

const databaseURIRegex = /^(?<schema>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
const regexResult = process.env.database_host.match(databaseURIRegex);

type DynamicRecordConstructor = {
	new(options: object): DynamicRecord;
};

let DR: DynamicRecordConstructor;

switch(regexResult.groups.schema){
	case "mongodb":
	case "mongodb+srv":
		DR = require("./mongodb/DynamicRecord.js");
		break;

	case "mysql":
		DR = require("./mysql/DynamicRecord.js");
		break;

	default:
		throw new Error("Environment not set up correctly");
}

export = DR;