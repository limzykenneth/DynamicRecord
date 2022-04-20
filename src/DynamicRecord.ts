import * as _ from "lodash";
import {DynamicCollection} from "./DynamicCollection";
import {QueryOptions} from "./interfaces/DynamicRecord";
import {DRConnection} from "./interfaces/connection";

export abstract class DynamicRecord<DataObject extends object> {
	// Instance specific constructors
	Model: any;
	// Instance specific Schema object
	schema: any;

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
	abstract findBy(query: object): Promise< Model<DataObject> >;

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
	abstract where(query: object, options?: QueryOptions): Promise< DynamicCollection<DataObject> >;

	/**
	 * Return all entries from the table.
	 *
	 * @method all
	 * @memberOf DynamicRecord
	 * @instance
	 * @return {Promise} - Return promise of DynamicCollection instance
	 */
	abstract all(): Promise< DynamicCollection<DataObject> >;

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
	abstract first(options?: QueryOptions): Promise< Model<DataObject>|DynamicCollection<DataObject> >;

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
	abstract last(options?: QueryOptions): Promise< Model<DataObject>|DynamicCollection<DataObject> >;
}

export type ModelConstructor
	= new<DataObject extends object>(data: DataObject, _preserveOriginal?: boolean) => Model<DataObject>;

export abstract class Model<DataObject extends object> {
	data: DataObject;
	_original: DataObject;

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
	constructor(data: DataObject, _preserveOriginal?: boolean){
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
		this.data = data || Object.create(null);

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
	abstract save(): Promise< Model<DataObject> >;

	/**
	 * Delete the entry this instance links to. Clear the data property
	 * of this instance as well.
	 *
	 * @method destroy
	 * @memberOf DynamicRecord.Model
	 * @instance
	 * @return {Promise} - Return promise of this DynamicRecord.Model instance
	 */
	abstract destroy(): Promise< Model<DataObject> >;

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