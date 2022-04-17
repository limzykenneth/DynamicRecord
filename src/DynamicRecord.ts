import * as _ from "lodash";
import {MongoClient} from "mongodb";
import * as mysql from "mysql2/promise";
import {DynamicCollection} from "./DynamicCollection";
import {QueryOptions} from "./interfaces/DynamicRecord";

interface DRConnection {
	type: string
	interface: any
}

export async function createConnection(url: string): Promise<DRConnection> {
	const databaseURIRegex = /^(?<protocol>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
	const regexResult = url.match(databaseURIRegex);

	switch(regexResult.groups.protocol){
		case "mongodb":
		case "mongodb+srv": {
			const client = new MongoClient(url, {
				maxPoolSize: 10
			});
			const connection = client.connect();

			return connection.then((client) => {
				const db = client.db();
				return {
					type: "mongodb",
					interface: {db, client}
				};
			});
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
				interface: connection
			};
		}

		default:
			throw new Error("URL protocol provided is not supported");
	}
}

export abstract class DynamicRecord {
	// Instance specific constructors
	Model: any;
	// Instance specific Schema object
	schema: any;

	/**
	 * Close the connection to the database server. Only used to terminate
	 * the running node instance.
	 *
	 * @method closeConnection
	 * @memberOf DynamicRecord
	 * @static
	 */
	static closeConnection(){}

	/**
	 * Creates a new DynamicRecord instance.
	 *
	 * @name DynamicRecord
	 * @class
	 * @param {object} options
	 * @param {string} options.tableSlug	The slug of the table. Must be lowercase only
	 * and not containing any whitespace
	 */
	constructor(options: {tableSlug: string, connection: DRConnection}){}

	/**
	 * Close the connection to the database server. Only used to terminate
	 * the running node instance.
	 *
	 * @method closeConnection
	 * @memberOf DynamicRecord
	 * @instance
	 */
	// Should only ever be called to terminate the node process
	abstract closeConnection(): Promise<any>;

	/**
	 * Find the latest entry in the table that match the query.
	 *
	 * @method findBy
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {object} query	A key value pair that will be used to match for entry
	 * in the database
	 * @return {Promise} - Return promise of DynamicRecord.Model instance or null
	 */
	abstract findBy(query: object): Promise<Model>;

	/**
	 * Find all the entries in the table that match the query.
	 *
	 * You can sort the returned data by providing a string key to sort the
	 * data by or a sorting function to manually sort the data. By default
	 * they are sorted in the order they are in in the database.
	 *
	 * @method where
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {object} query	A key value pair that will be used to match for entries
	 * @param {object} [options]	Query options object
	 * @param {number} [options.limit]	Limit the number of maximum returned entries
	 * @param {number} [options.offset]	Number of entries to offset by before starting query
	 * @param {object} [options.sort]	Sorting order of returned entries. Defined by
	 * providing the column to sort by as key and "ASC" "DESC" as value for ascending
	 * and descending respectively.
	 * @return {Promise} - Return promise of DynamicCollection instance
	 */
	abstract where(query: object, options?: QueryOptions): Promise<DynamicCollection>;

	/**
	 * Return all entries from the table.
	 *
	 * @method all
	 * @memberOf DynamicRecord
	 * @instance
	 * @return {Promise} - Return promise of DynamicCollection instance
	 */
	abstract all(): Promise<DynamicCollection>;

	/**
	 * Return the first entry in the table. If provided query option
	 * 'limit', it will return the first nth entry in the database wrapped
	 * in a Promise of DynamicCollection from first inserted forward.
	 *
	 * @method first
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {object} [options]	Query options object
	 * @param {number} [options.limit]	Specify the number of entries to return. If not
	 * defined, defaults to 1.
	 * @param {number} [options.offset]	Number of entries to offset by before starting query
	 * @param {object} [options.sort]	Sorting order of returned entries. Defined by
	 * providing the column to sort by as key and "ASC" "DESC" as value for ascending
	 * and descending respectively.
	 * @return {Promise} - Return promise of DynamicRecord.Model instance,
	 * DynamicCollection instance, or null
	 */
	abstract first(options?: QueryOptions): Promise<Model|DynamicCollection>;

	/**
	 * Return the last entry in the table. If provided query option
	 * 'limit', it will return the last nth entry in the database wrapped
	 * in a Promise of DynamicCollection from last inserted backward.
	 *
	 * @method last
	 * @memberOf DynamicRecord
	 * @instance
	 * @param {object} [options]	Query options object
	 * @param {number} [options.limit]	Specify the number of entries to return. If not
	 * defined, defaults to 1.
	 * @param {number} [options.offset]	Number of entries to offset by before starting query
	 * @param {object} [options.sort]	Sorting order of returned entries. Defined by
	 * providing the column to sort by as key and "ASC" "DESC" as value for ascending
	 * and descending respectively.
	 * @return {Promise} - Return promise of DynamicRecord.Model instance,
	 * DynamicCollection instance, or null
	 */
	abstract last(options?: QueryOptions): Promise<Model|DynamicCollection>;
}

export type ModelConstructor = {
	new(data: object, _preserveOriginal?: boolean): Model
}

export abstract class Model {
	data: any;
	_original: any;

	/**
	 * Create a new DynamicRecord.Model instance.
	 *
	 * @name DynamicRecord.Model
	 * @memberOf DynamicRecord
	 * @instance
	 * @constructor
	 * @param {object} data	Object containing data for this instance of
	 * DynamicRecord.Model
	 */
	constructor(data: any, _preserveOriginal: boolean){
		/**
		 * The data contained in this instance. It is not kept in sync with
		 * the database automatically.
		 *
		 * You should be directly modifying this object. When done and you
		 * wish to save the data to the database, call `save()` on the
		 * parent object instance.
		 *
		 * @name data
		 * @type object
		 * @memberOf DynamicRecord.Model
		 * @instance
		 */
		this.data = data || {};

		if(_preserveOriginal){
			this._original = _.cloneDeep(data);
		}else{
			this._original = null;
		}
	}

	/**
	 * Save the data in this instance to the database.
	 *
	 * If you have a series of models of the same schema, it is recommended
	 * to put them in a DynamicCollection and calling `saveAll()` on it
	 * instead of attempting to save them all in parallel. This applies to
	 * schemas with auto incrementing counters.
	 *
	 * @method save
	 * @memberOf DynamicRecord.Model
	 * @instance
	 * @return {Promise} - Return promise of this DynamicRecord.Model instance
	 */
	abstract save(): Promise<Model>;

	/**
	 * Delete the entry this instance links to. Clear the data property
	 * of this instance as well.
	 *
	 * @method destroy
	 * @memberOf DynamicRecord.Model
	 * @instance
	 * @return {Promise} - Return promise of this DynamicRecord.Model instance
	 */
	abstract destroy(): Promise<Model>;

	/**
	 * Validate the data in this instance conform to its schema.
	 *
	 * **Implementation not settled**
	 *
	 * @method validate
	 * @memberOf DynamicRecord.Model
	 * @instance
	 * @return {boolean}
	 * @hidden
	 */
	abstract validate(schema): boolean;
}