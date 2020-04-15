import * as _ from "lodash";

export default abstract class DynamicRecord {
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