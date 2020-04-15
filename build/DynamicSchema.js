"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
/**
 * Create an new DynamicSchema instance
 *
 * @name DynamicSchema
 * @class
 */
class DynamicSchema {
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
    /**
     * Add a single column to the table's schema definition. If the column name
     * is already in use, this will return a rejected Promise.
     *
     * @method addColumn
     * @memberOf DynamicSchema
     * @instance
     * @param {string} name - The name of the column to add
     * @param {string} type - Type of the column to add
     * @param {string} [description] - Description of the column to add
     * @return {Promise} Return promise of DynamicSchema instance
     */
    addColumn(name, type, description = "") {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.definition[name]) {
                // Column name already exist
                return Promise.reject(new Error(`Column name "${name}" already exist`));
            }
            this.definition[name] = {
                description: description,
                type: type
            };
            try {
                yield this._writeSchema();
                return this;
            }
            catch (err) {
                delete this.definition[name];
                return Promise.reject(err);
            }
        });
    }
    /**
     * Add multiple columns to the table's schema definition. If any of the
     * given columns already exist, this will return a rejected Promise. None
     * of the changes will be made.
     *
     * @method addColumns
     * @memberOf DynamicSchema
     * @instance
     * @param {object} definitions - Object of objects containing new columns
     *                               definitions
     * @return {Promise} Return promise of DynamicSchema instance
     */
    addColumns(def) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldDefinition = _.cloneDeep(this.definition);
            const destinationKeys = _.keys(this.definition);
            const sourceKeys = _.keys(def);
            if (_.intersection(destinationKeys, sourceKeys).length > 0) {
                const names = _.intersection(destinationKeys, sourceKeys).join(", ");
                return Promise.reject(new Error(`Column names already exist: ${names}`));
            }
            this.definition = _.assign(this.definition, def);
            try {
                yield this._writeSchema();
                return this;
            }
            catch (err) {
                this.definition = _.cloneDeep(oldDefinition);
                return Promise.reject(err);
            }
        });
    }
    /**
     * Change the type of a single column in the table's schema definition.
     *
     * @method changeColumnType
     * @memberOf DynamicSchema
     * @instance
     * @param {string} name - The name of the column to change type
     * @param {string} newType - The new type of the target column
     * @return {Promise} Return promise of DynamicSchema instance
     */
    changeColumnType(name, newType) {
        return __awaiter(this, void 0, void 0, function* () {
            const oldType = this.definition[name].type;
            this.definition[name].type = newType;
            try {
                yield this._writeSchema();
                return this;
            }
            catch (err) {
                this.definition[name].type = oldType;
                return Promise.reject(err);
            }
        });
    }
    /**
     * Remove a single column from the table's schema definition.
     *
     * @method removeColumn
     * @memberOf DynamicSchema
     * @instance
     * @param {string} name - The name of the column to remove
     * @return {Promise} Return promise of DynamicSchema instance
     */
    removeColumn(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleted = _.cloneDeep(this.definition[name]);
            delete this.definition[name];
            try {
                yield this._writeSchema();
                return this;
            }
            catch (err) {
                this.definition[name] = deleted;
                return Promise.reject(err);
            }
        });
    }
}
exports.DynamicSchema = DynamicSchema;
