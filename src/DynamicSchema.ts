import * as _ from "lodash";

interface Definition{
	description:string;
	type:string;
	isIndex?:boolean;
	isAutoIncrement?:boolean;
	isUnique?:boolean;
}

interface SchemaDefinitions{
	[key:string]:Definition
}

interface IndexOptions{
	name:string;
	autoIncrement?:boolean;
	unique?:boolean;
}

interface TableSchema{
	$schema?:string;
	_$schema?:string;
	$id?:string;
	_$id?:string;
	title?:string;
	description?:string
	type?:string;
	properties?:SchemaDefinitions
	required?:Array<string>
}

export default abstract class Schema{
	tableName:string;
	tableSlug:string;
	definition:SchemaDefinitions;
	required:Array<string>;
	description:string;

	jsonSchema:TableSchema;

	constructor(){
		/**
		 * The name of the table.
		 *
		 * @name tableName
		 * @type string
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.tableName = null;

		/**
		 * The slug of the table.
		 *
		 * @name tableSlug
		 * @type string
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.tableSlug = null;

		/**
		 * The table's column definitions.
		 *
		 * @name definition
		 * @type object
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.definition = {};

		/**
		 * Label of required fields of this schema. Array of strings.
		 *
		 * @name required
		 * @type array
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.required = [];

		/**
		 * Description of the schema. Not used for anything internally.
		 *
		 * @name description
		 * @type string
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.description = "";

		/**
		 * The underlying JSON Schema definition of the schema
		 *
		 * @name jsonSchema
		 * @type object
		 * @memberOf DynamicSchema
		 * @instance
		 */
		this.jsonSchema = {};
	}

	/**
	 * Create a new table with the given schema. Schema must adhere to the
	 * JSON Schema definition set out in
	 * [https://json-schema.org/](https://json-schema.org/)
	 *
	 * Each property corresponds to each column in the database. A few
	 * custom attributes to each property can be included for use by
	 * DynamicSchema to generate columns for special behaviour.
	 *
	 * These properties are:
	 * - `isIndex`: Whether the column is an index field
	 * - `isUnique`: Whether the column is an unique field
	 * - `isAutoIncrement`: Whether the column is an auto-incrementing integer
	 *
	 * @method createTable
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} schema
	 * @param {string} schema.$id - ID of the table, must be unique
	 * @param {string} [schema.title] - Defaults to `schema.$id`
	 * @param {object} schema.properties - The column definitions of the table
	 * @return {Promise} Return promise of the instance containing the new table
	 */
}