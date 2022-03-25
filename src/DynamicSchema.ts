import * as _ from "lodash";

export interface Definition{
	description:string;
	type:string;
	isIndex?:boolean;
	isAutoIncrement?:boolean;
	isUnique?:boolean;
}

export interface SchemaDefinitions{
	[key:string]:Definition
}

export interface IndexOptions{
	name:string;
	autoIncrement?:boolean;
	unique?:boolean;
}

export interface TableSchema{
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

export type DynamicSchemaConstructor = {
	new(): DynamicSchema;
}

export abstract class DynamicSchema{
	tableName:string;
	tableSlug:string;
	definition:SchemaDefinitions;
	required:Array<string>;
	description:string;

	jsonSchema:TableSchema;

	/**
	 * Create an new DynamicSchema instance
	 *
	 * @name DynamicSchema
	 * @class
	 */
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
	 * @param {string} schema.$id	ID of the table, must be unique
	 * @param {string} [schema.title]	Defaults to `schema.$id`
	 * @param {object} schema.properties	The column definitions of the table
	 * @return {Promise} - Return promise of the instance containing the new table
	 */
	abstract createTable(schemaInput:TableSchema): Promise<DynamicSchema>;

	/**
	 * Drop the table from the database.
	 *
	 * @method dropTable
	 * @memberOf DynamicSchema
	 * @instance
	 * @return {Promise} - Return promise of empty DynamicSchema instance
	 */
	abstract dropTable(): Promise<DynamicSchema>;

	/**
	 * Rename the table.
	 *
	 * @method renameTable
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} newSlug
	 * @param {string} [newName] Defaults to newSlug
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract renameTable(newSlug:string, newName?:string): Promise<DynamicSchema>;

	/**
	 * Add an index to the table's schema.
	 *
	 * @method addIndex
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} options
	 * @param {string} options.name	The name of the column to be used as index
	 * @param {boolean} [options.unique]	Whether the index is unique or not
	 * @param {boolean} [options.autoInrement]	Whether it is an
	 *                  auto-incrementing index or not. If true, `options.unique`
	 *                  is automatically set to true
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract addIndex(options:IndexOptions): Promise<DynamicSchema>;

	// 	Maybe drop index then recreate but do consider why you need to do this
	// abstract renameIndex(columnName:string, newColumnName:string): Promise<DynamicSchema>;

	/**
	 * Remove an index to the table's schema
	 *
	 * @method removeIndex
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} columnName	The name of the index to remove
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract removeIndex(columnName:string): Promise<DynamicSchema>;

	/**
	 * Read the schema definition from the database.
	 *
	 * @method read
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} tableSlug	The name of the table schema to retrieve
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract read(tableSlug:string): Promise<DynamicSchema>;

	/**
	 * Define the table's columns. Passed object must adhere to `properties`
	 * attribute of [JSON Schema](https://json-schema.org/)'s definition.
	 *
	 * Optional `required` parameters define any of the columns as a required
	 * field.
	 *
	 * Note that this function replaces any existing definition on the table.
	 * If you want to edit individual columns, you should use other functions
	 * instead.
	 *
	 * @method define
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} definition	Definition of the table columns
	 * @param {Array} [required]	Array of column names that are required
	 * fields
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract define(def:SchemaDefinitions, required?:Array<string>): Promise<DynamicSchema>;

	/**
	 * Add a single column to the table's schema definition. If the column name
	 * is already in use, this will return a rejected Promise.
	 *
	 * @method addColumn
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name	The name of the column to add
	 * @param {string} type	Type of the column to add
	 * @param {string} [description]	Description of the column to add
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	async addColumn(name:string, type:string, description:string = ""): Promise<DynamicSchema>{
		if(this.definition[name]){
			// Column name already exist
			return Promise.reject(new Error(`Column name "${name}" already exist`));
		}

		this.definition[name] = {
			description: description,
			type: type
		};

		try{
			await this._writeSchema();
			return this;
		} catch(err) {
			delete this.definition[name];
			return Promise.reject(err);
		}
	}

	/**
	 * Add multiple columns to the table's schema definition. If any of the
	 * given columns already exist, this will return a rejected Promise. None
	 * of the changes will be made.
	 *
	 * @method addColumns
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {object} definitions	Object of objects containing new columns
	 *                               definitions
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	async addColumns(def:SchemaDefinitions): Promise<DynamicSchema>{
		const oldDefinition:SchemaDefinitions = _.cloneDeep(this.definition);
		const destinationKeys = _.keys(this.definition);
		const sourceKeys = _.keys(def);
		if(_.intersection(destinationKeys, sourceKeys).length > 0){
			const names = _.intersection(destinationKeys, sourceKeys).join(", ");
			return Promise.reject(new Error(`Column names already exist: ${names}`));
		}
		this.definition = _.assign(this.definition, def);

		try{
			await this._writeSchema();
			return this;
		} catch(err) {
			this.definition = _.cloneDeep(oldDefinition);
			return Promise.reject(err);
		}
	}

	/**
	 * Rename a single column in the table's schema definition.
	 *
	 * @method renameColumn
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name	The name of the column to rename
	 * @param {string} newName	The new name of the target column
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract renameColumn(name:string, newName:string): Promise<DynamicSchema>;

	/**
	 * Change the type of a single column in the table's schema definition.
	 *
	 * @method changeColumnType
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name	The name of the column to change type
	 * @param {string} newType	The new type of the target column
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	async changeColumnType(name:string, newType:string): Promise<DynamicSchema>{
		const oldType:string = this.definition[name].type;
		this.definition[name].type = newType;

		try{
			await this._writeSchema();
			return this;
		} catch(err) {
			this.definition[name].type = oldType;
			return Promise.reject(err);
		}
	}

	/**
	 * Remove a single column from the table's schema definition.
	 *
	 * @method removeColumn
	 * @memberOf DynamicSchema
	 * @instance
	 * @param {string} name	The name of the column to remove
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	async removeColumn(name:string): Promise<DynamicSchema>{
		const deleted:Definition = _.cloneDeep(this.definition[name]);
		delete this.definition[name];

		try{
			await this._writeSchema();
			return this;
		} catch(err) {
			this.definition[name] = deleted;
			return Promise.reject(err);
		}
	}

	// Utils --------------------------------------------------------
	/**
	 * Update the new schema structure into the database
	 *
	 * @method _writeSchema
	 * @memberOf DynamicSchema
	 * @instance
	 * @private
	 * @return {Promise} - Return promise of DynamicSchema instance
	 */
	abstract _writeSchema(): Promise<DynamicSchema>;
}