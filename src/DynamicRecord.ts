import * as _ from "lodash";

export abstract class DynamicRecord {
	private _databaseConnection: any;
	private _ready: any;
	private _db: any;
	private _client: any;

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
	 * @param {string} options.tableSlug - The slug of the table. Must be lowercase only
	 * and not containing any whitespace
	 */
	constructor(options){}
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
	 * @param {object} data - Object containing data for this instance of
	 * DynamicRecord.Model
	 */
	constructor(data, _preserveOriginal){
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
	 * @return {Promise} Return promise of this DynamicRecord.Model instance
	 */
	abstract save(): Promise<Model>;

	/**
	 * Delete the entry this instance links to. Clear the data property
	 * of this instance as well.
	 *
	 * @method destroy
	 * @memberOf DynamicRecord.Model
	 * @instance
	 * @return {Promise} Return promise of this DynamicRecord.Model instance
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
	 */
	abstract validate(schema): boolean;
}