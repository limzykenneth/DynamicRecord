"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Schema {
    constructor() {
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
}
exports.default = Schema;
