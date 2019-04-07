"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
let con;
// Let's get mongodb working first
/**
 * Create an new DynamicSchema instance
 *
 * @class
 */
class Schema {
    constructor() {
        this.tableName = null;
        this.tableSlug = null;
        this.definition = {};
    }
    /**
     * Create a new table with the given options
     *
     * @method createTable
     * @param {object} options
     * @param {string} options.tableSlug
     * @param {string} [options.tableName]
     * @param {Array} options.indexColumns
     * @return {Promise}
     */
    createTable(options) {
        const tableSlug = options.$id;
        const tableName = options.title;
        // const indexColumns = options.indexColumns; // Array
        const columns = options.properties;
        return con.then((db) => {
            const promises = [];
            // NOTE: Do we need to check for existence first?
            promises.push(db.createCollection(tableSlug).then((col) => {
                this.tableName = tableName;
                this.tableSlug = tableSlug;
                return Promise.resolve(db);
            }));
            promises.push(db.createCollection("_counters").then((col) => {
                return col.indexExists("_$id").then((result) => {
                    if (result === false) {
                        return col.createIndex("_$id", { unique: true }).then(() => {
                            return Promise.resolve();
                        });
                    }
                    else {
                        return Promise.resolve();
                    }
                }).then(() => {
                    return col.insertOne({
                        _$id: tableSlug,
                        sequences: {}
                    }).then(() => {
                        return Promise.resolve(db);
                    });
                });
            }));
            const databaseInsert = {
                _$schema: options.$schema,
                _$id: options.$id,
                title: options.title,
                description: options.description,
                type: options.type,
                properties: options.properties,
                required: options.required
            };
            promises.push(db.collection("_schema").insertOne(databaseInsert));
            this.definition = columns;
            promises.push(this._writeSchema());
            return Promise.all(promises);
        }).then(() => {
            // Handle index columns
            let promises = [];
            _.each(columns, (column, key) => {
                if (column.isIndex) {
                    promises.push(this.addIndex({
                        name: key,
                        unique: column.isUnique,
                        autoIncrement: column.isAutoIncrement
                    }));
                }
            });
            return Promise.all(promises);
        }).catch((err) => {
            this.tableName = null;
            this.tableSlug = null;
            throw err;
        });
    }
    /**
     * Add an index to the table's schema
     *
     * @method addIndex
     * @param {object} options
     * @param {string} options.name
     * @param {boolean} [options.autoInrement]
     * @param {boolean} [options.unique]
     * @return {Promise}
     */
    addIndex(options) {
        const columnName = options.name;
        const isAutoIncrement = options.autoIncrement;
        let unique = options.unique;
        if (isAutoIncrement && unique === false) {
            console.warn("Auto increment index must be unique, setting to unique.");
            unique = true;
        }
        if (typeof unique === "undefined") {
            unique = true;
        }
        return con.then((db) => {
            return db.collection(this.tableSlug).createIndex(columnName, { unique: unique, name: columnName });
        }).then(() => {
            if (isAutoIncrement) {
                return this._setCounter(this.tableSlug, columnName);
            }
            else {
                return Promise.resolve();
            }
        }).catch((err) => {
            throw err;
        });
    }
    renameIndex(columnName, newColumnName) {
        // Maybe drop index then recreate but do consider why you need to do this
    }
    /**
     * Remove an index to the table's schema
     *
     * @method removeIndex
     * @param {string} columnName - The name of the index to remove
     * @return {Promise}
     */
    removeIndex(columnName) {
        return con.then((db) => {
            return db.collection(this.tableSlug).dropIndex(columnName)
                .then(() => {
                return Promise.resolve(db);
            });
        }).then((db) => {
            if (columnName === "_uid") {
                return db.collection("_counters").findOneAndDelete({
                    _$id: this.tableSlug
                });
            }
            else {
                return Promise.resolve();
            }
        }).catch((err) => {
            throw err;
        });
    }
    /**
     * Read the schema configuration from the database
     *
     * @method read
     * @param {string} tableSlug
     * @return {Promise}
     */
    read(tableSlug) {
        return con.then((db) => {
            return db.collection("_schema").findOne({ _$id: tableSlug });
        }).then((data) => {
            if (data) {
                this.tableName = data.title;
                this.tableSlug = data._$id;
                this.definition = data.properties;
            }
            else {
                this.tableName = "";
                this.tableSlug = "";
                this.definition = {};
            }
            return Promise.resolve(this);
        }).catch((err) => {
            throw err;
        });
    }
    /**
     * Define the table's schema
     *
     * @method define
     * @param {string} tableSlug
     * @param {object[]} definition
     * @param {string} definition[].name
     * @param {string} definition[].slug
     * @param {string} definition[].type
     * @return {Promise}
     */
    define(tableSlug, def) {
        const oldTableSlug = this.tableSlug;
        const oldDef = this.definition;
        this.tableSlug = tableSlug;
        this.definition = def;
        // Create schema in RMDB, do nothing in NoSQL
        return con.then((db) => {
            return db.collection("_schema").findOneAndUpdate({
                _$id: tableSlug,
            }, {
                $set: {
                    properties: def
                }
            }, {
                upsert: true
            });
        }).catch((err) => {
            this.tableSlug = oldTableSlug;
            this.definition = oldDef;
            throw err;
        });
    }
    /**
     * Add a single column to the table's schema definition
     *
     * @method addColumn
     * @param {string} name - The name of the column to add
     * @param {string} type
     * @return {Promise}
     */
    addColumn(name, type, description = "") {
        if (!this.definition[name]) {
            this.definition[name] = {
                description: description,
                type: type
            };
        }
        else {
            // Column name already exist
            throw new Error("Column name already exist");
        }
        return this._writeSchema().catch((err) => {
            delete this.definition[name];
            throw err;
        });
    }
    /**
     * Add multiple columns to the table's schema definition
     *
     * @method addColumns
     * @param {object} definition
     * @return {Promise}
     */
    addColumns(def) {
        const oldDefinition = _.cloneDeep(this.definition);
        this.definition = _.assign(this.definition, def);
        return this._writeSchema().catch((err) => {
            this.definition = _.cloneDeep(oldDefinition);
            throw err;
        });
    }
    /**
     * Rename a single column in the table's schema definition
     *
     * @method renameColumn
     * @param {string} name - The name of the column to rename
     * @param {string} newName
     * @return {Promise}
     */
    renameColumn(name, newName) {
        this.definition[newName] = _.cloneDeep(this.definition[name]);
        delete this.definition[name];
        return this._writeSchema().catch((err) => {
            this.definition[name] = _.cloneDeep(this.definition[newName]);
            delete this.definition[newName];
            throw err;
        });
    }
    /**
     * Change the type of a single column in the table's schema definition
     *
     * @method changeColumnType
     * @param {string} name - The name of the column to change type
     * @param {string} newType
     * @return {Promise}
     */
    changeColumnType(name, newType) {
        const oldType = this.definition[name].type;
        this.definition[name].type = newType;
        return this._writeSchema().catch((err) => {
            this.definition[name].type = oldType;
            throw err;
        });
    }
    /**
     * Remove a single column from the table's schema definition
     *
     * @method removeColumn
     * @param {string} name - The name of the column to remove
     * @return {Promise}
     */
    removeColumn(name) {
        const deleted = _.cloneDeep(this.definition[name]);
        delete this.definition[name];
        return this._writeSchema().catch((err) => {
            this.definition[name] = deleted;
            throw err;
        });
    }
    // Utils --------------------------------------------------------
    /**
     * Update the new schema structure into the database
     *
     * @method _writeSchema
     * @private
     * @return {Promise}
     */
    _writeSchema() {
        return con.then((db) => {
            return db.collection("_schema").findOneAndUpdate({ _$id: this.tableSlug }, {
                $set: {
                    properties: this.definition
                }
            });
        });
    }
    /**
     * Set an autoincrementing field to the _counters table (MongoDB only)
     *
     * @method _setCounter
     * @private
     * @param {string} collection - The slug of the collection to set
     * @param {string} columnLabel - The slug of the column set as an autoincrementing index
     * @return {Promise}
     */
    _setCounter(collection, columnLabel) {
        return con.then((db) => {
            const sequenceKey = `sequences.${columnLabel}`;
            return db.collection("_counters").findOneAndUpdate({
                _$id: collection
            }, {
                $set: {
                    [sequenceKey]: 0
                }
            });
        });
    }
    /**
     * Increment an autoincrementing index (MongoDB only)
     *
     * @method _setCounter
     * @private
     * @param {string} collection - The slug of the collection to target
     * @param {string} columnLabel - The slug of the autoincrementing column
     * to increment
     * @return {Promise} - Promise of the next number in the sequence
     */
    _incrementCounter(collection, columnLabel) {
        return con.then((db) => {
            return db.collection("_counters").findOne({
                _$id: collection
            }).then((result) => {
                const newSequence = result.sequences[columnLabel] + 1;
                const sequenceKey = `sequences.${columnLabel}`;
                return db.collection("_counters").findOneAndUpdate({
                    _$id: collection
                }, {
                    $set: {
                        [sequenceKey]: newSequence
                    }
                }).then(() => {
                    return Promise.resolve(newSequence);
                });
            });
        });
    }
    _validate() {
        // Validate database schema with this.definition
        // Return boolean
    }
}
module.exports = function (connection) {
    con = connection;
    return Schema;
};
