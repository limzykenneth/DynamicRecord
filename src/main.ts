import {MongoClient} from "mongodb";
import * as mysql from "mysql2/promise";
import {DRConnection} from "./interfaces/connection";

/**
 * Create a connection object that can be used by DynamicRecord instances.
 *
 * @method createConnection
 * @param {string} url	Full connection URL for the database in question
 * @return {object} - Return the created connection object
 */
export function createConnection(url: string): DRConnection {
	const databaseURIRegex = /^(?<protocol>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
	const regexResult = url.match(databaseURIRegex);

	switch(regexResult.groups.protocol){
		case "mongodb":
		case "mongodb+srv": {
			const client = new MongoClient(url, {
				maxPoolSize: 10
			});
			const connection = client.connect();

			return {
				type: "mongodb",
				interface: connection.then((client) => {
					const db = client.db();

					return {
						db,
						client
					};
				})
			};
		}

		case "mysql": {
			const connection = mysql.createPool({
				host: regexResult.groups.host,
				port: parseInt(regexResult.groups.port),
				user: regexResult.groups.username,
				password: regexResult.groups.password,
				database: regexResult.groups.database
			});

			return {
				type: "mysql",
				interface: Promise.resolve(connection)
			};
		}

		default:
			throw new Error("URL protocol provided is not supported");
	}
}

import {DynamicRecord} from "./DynamicRecord";
export {DynamicRecord} from "./DynamicRecord";
export {Model as DynamicModel} from "./DynamicRecord";
import {DynamicRecord as DRMongoDB} from "./mongodb/DynamicRecord";
import {DynamicRecord as DRMySQL} from "./mysql/DynamicRecord";
import {DataObject} from "./interfaces/DynamicRecord";

/**
 * Create an instance of DynamicRecord that uses established connection.
 *
 * @method createInstance
 * @param {object} connection	Connection object created with `createConnection()`
 * @param {string} tableSlug	Identifier for the table to use with this instance
 * @return {DynamicRecord} - Return the created DynamicRecord instance
 */
export function createInstance<DataObject extends object>(connection: DRConnection, tableSlug): DynamicRecord<DataObject> {
	if(connection.type === "mongodb"){
		return new DRMongoDB<DataObject>({tableSlug, connection});
	}else if(connection.type === "mysql"){
		return new DRMySQL<DataObject>({tableSlug, connection});
	}else{
		throw new Error("Connection object provided is not valid");
	}
}

export {DynamicSchema} from "./DynamicSchema";
import {DynamicSchema} from "./DynamicSchema";
import {DynamicSchema as DRSMongoDB} from "./mongodb/DynamicSchema";
import {DynamicSchema as DRSMySQL} from "./mysql/DynamicSchema";

/**
 * Create an instance of DynamicSchema that uses established connection.
 *
 * @method createSchemaInstance
 * @param {object} connection	Connection object created with `createConnection()`
 * @return {DynamicSchema} - Return the created DynamicSchema instance
 */
export function createSchemaInstance(connection: DRConnection): DynamicSchema {
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

/**
 * Create an instance of DynamicCollection that uses established connection.
 *
 * @method createCollection
 * @param {object} connection	Connection object created with `createConnection()`
 * @param {object} Model	The Model constructor to use for this collection
 * @return {DynamicCollection} - Return the created DynamicCollection instance
 */
export function createCollection<DataObject extends object>(connection: DRConnection, Model, ...data): DynamicCollection<DataObject> {
	if(connection.type === "mongodb"){
		return new DRCMongoDB<DataObject>(Model, ...data);
	}else if(connection.type === "mysql"){
		return new DRCMySQL<DataObject>(Model, ...data);
	}else{
		throw new Error("Connection object provided is not valid");
	}
}