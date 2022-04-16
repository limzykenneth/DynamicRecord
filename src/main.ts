// import {DynamicRecordConstructor} from "./DynamicRecord";
// import DynamicCollection from "./DynamicCollection";
// import {DynamicSchema} from "./DynamicSchema";

// const databaseURIRegex = /^(?<schema>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
// const regexResult = process.env.database_host.match(databaseURIRegex);

// let DR: DynamicRecordConstructor;

// switch(regexResult.groups.schema){
// 	case "mongodb":
// 	case "mongodb+srv":
// 		DR = require("./mongodb/DynamicRecord.js");
// 		break;

// 	case "mysql":
// 		DR = require("./mysql/DynamicRecord.js");
// 		break;

// 	default:
// 		throw new Error("Environment not set up correctly");
// }

// export = DR;

export {createConnection} from "./DynamicRecord";
import {DynamicRecord} from "./DynamicRecord";
export {DynamicRecord} from "./DynamicRecord";
import {DynamicRecord as DRMongoDB} from "./mongodb/DynamicRecord";
import {DynamicRecord as DRMySQL} from "./mysql/DynamicRecord";

export function createInstance(connection, tableSlug): DynamicRecord {
	if(connection.type === "mongodb"){
		return new DRMongoDB({tableSlug, connection});
	}else if(connection.type === "mysql"){
		return new DRMySQL({tableSlug, connection});
	}else{
		throw new Error("Connection object provided is not valid");
	}
}

export {DynamicSchema} from "./DynamicSchema";
import {DynamicSchema} from "./DynamicSchema";
import {DynamicSchema as DRSMongoDB} from "./mongodb/DynamicSchema";
import {DynamicSchema as DRSMySQL} from "./mysql/DynamicSchema";

export function createSchemaInstance(connection): DynamicSchema {
	if(connection.type === "mongodb"){
		return new DRSMongoDB({connection});
	}else if(connection.type === "mysql"){
		return new DRSMySQL({connection});
	}else{
		throw new Error("Connection object provided is not valid");
	}
}

export {DynamicCollection} from "./DynamicCollection";
import {DynamicCollection} from "./DynamicCollection";
import {DynamicCollection as DRCMongoDB} from "./mongodb/DynamicCollection";
import {DynamicCollection as DRCMySQL} from "./mysql/DynamicCollection";

export function createCollection(connection, Model, ...data): DynamicCollection{
	if(connection.type === "mongodb"){
		return new DRCMongoDB(Model, ...data);
	}else if(connection.type === "mysql"){
		return new DRCMySQL(Model, ...data);
	}else{
		throw new Error("Connection object provided is not valid");
	}
}