"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
let con;
{ }
// Let's get mongodb working first
/**
 * Create an new ActiveSchema instance
 *
 * @class
 */
class Schema {
    constructor() {
        this.tableName = null;
        this.tableSlug = null;
        this.definition = [];
    }
    /**
     * Create a new table with the given options
     *
     * @method createTable
     * @param {object} options
     * @param {string} options.tableSlug
     * @param {string} options.tableName
     * @param {Array} options.indexColumns
     * @return {Promise}
     */
    createTable(options) {
        let tableSlug = options.tableSlug;
        let tableName = options.tableName;
        let indexColumns = options.indexColumns; // Array
        if (!tableName) {
            tableName = tableSlug;
        }
        return con.then((db) => {
            let promises = [];
            promises.push(db.createCollection(tableSlug).then((col) => {
                this.tableName = tableName;
                this.tableSlug = tableSlug;
                return Promise.resolve(db);
            }));
            promises.push(db.createCollection("_counters").then((col) => {
                return col.indexExists("collection").then((result) => {
                    if (result === false) {
                        return col.createIndex("collection", { unique: true }).then(() => {
                            return Promise.resolve();
                        });
                    }
                    else {
                        return Promise.resolve();
                    }
                }).then(() => {
                    return col.insertOne({
                        collection: tableSlug,
                        sequences: {}
                    }).then(() => {
                        return Promise.resolve(db);
                    });
                });
            }));
            promises.push(db.collection("_schema").insertOne({
                collectionSlug: tableSlug,
                collectionName: tableName,
                fields: []
            }));
            return Promise.all(promises);
        }).then(() => {
            if (indexColumns) {
                if (Array.isArray(indexColumns)) {
                    let promises = [];
                    _.each(indexColumns, (el, i) => {
                        promises.push(this.addIndex({
                            name: el.name,
                            unique: el.unique,
                            autoIncrement: el.autoIncrement
                        }));
                    });
                    return Promise.all(promises);
                }
                else {
                    return this.addIndex({
                        name: indexColumns.name,
                        unique: indexColumns.unique,
                        autoIncrement: indexColumns.autoIncrement
                    });
                }
            }
            else {
                return Promise.resolve();
            }
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
        let columnName = options.name;
        let isAutoIncrement = options.autoIncrement;
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
                    collection: this.tableSlug
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
            return db.collection("_schema").findOne({ collectionSlug: tableSlug });
        }).then((data) => {
            this.tableName = data.collectionName;
            this.tableSlug = data.collectionSlug;
            this.definition = data.fields;
            return Promise.resolve();
        }).catch((err) => {
            throw err;
        });
    }
    /**
     * Define the table's schema
     *
     * @method define
     * @param {string} tableName
     * @param {string} tableSlug
     * @param {object[]} definition
     * @param {string} definition[].name
     * @param {string} definition[].slug
     * @param {string} definition[].type
     * @return {Promise}
     */
    define(tableName, tableSlug, def) {
        var oldTableName = this.tableName;
        var oldTableSlug = this.tableSlug;
        var oldDef = this.definition;
        this.tableName = tableName;
        this.tableSlug = tableSlug;
        this.definition = def;
        // Create schema in RMDB, do nothing in NoSQL
        return con.then((db) => {
            return db.collection("_schema").insertOne({
                collectionSlug: tableSlug,
                collectionName: tableName,
                fields: def
            });
        }).catch((err) => {
            this.tableName = oldTableName;
            this.tableSlug = oldTableSlug;
            this.definition = oldDef;
            throw err;
        });
    }
    /**
     * Add a single column to the table's schema definition
     *
     * @method addColumn
     * @param {string} slug - The slug of the column to add
     * @param {string} type
     * @return {Promise}
     */
    addColumn(slug, type) {
        this.definition.push({
            name: slug,
            slug: slug,
            type: type
        });
        return this._writeSchema().catch((err) => {
            this.definition.pop();
            throw err;
        });
    }
    /**
     * Add multiple columns to the table's schema definition
     *
     * @method addColumns
     * @param {object[]} definition
     * @param {string} definition[].name
     * @param {string} definition[].slug
     * @param {string} definition[].type
     * @return {Promise}
     */
    addColumns(def) {
        let oldDefinition = _.cloneDeep(this.definition);
        this.definition = this.definition.concat(def);
        return this._writeSchema().catch((err) => {
            this.definition = _.cloneDeep(oldDefinition);
            throw err;
        });
    }
    /**
     * Rename a single column in the table's schema definition
     *
     * @method renameColumn
     * @param {string} slug - The slug of the column to rename
     * @param {string} newSlug
     * @return {Promise}
     */
    renameColumn(slug, newSlug) {
        var index = _.findIndex(this.definition, (el) => {
            return el.slug == slug;
        });
        this.definition[index].name = newSlug;
        this.definition[index].slug = newSlug;
        return this._writeSchema().catch((err) => {
            this.definition[index].name = slug;
            this.definition[index].slug = slug;
            throw err;
        });
    }
    /**
     * Change the type of a single column in the table's schema definition
     *
     * @method changeColumnType
     * @param {string} slug - The slug of the column to change type
     * @param {string} newType
     * @return {Promise}
     */
    changeColumnType(slug, newType) {
        var index = _.findIndex(this.definition, (el) => {
            return el.slug == slug;
        });
        var oldType = this.definition[index].type;
        this.definition[index].type = newType;
        return this._writeSchema().catch((err) => {
            this.definition[index].type = oldType;
            throw err;
        });
    }
    /**
     * Remove a single column from the table's schema definition
     *
     * @method removeColumn
     * @param {string} slug - The slug of the column to remove
     * @return {Promise}
     */
    removeColumn(slug) {
        var index = _.findIndex(this.definition, (el) => {
            return el.label == slug;
        });
        var deleted = this.definition.splice(index, 1);
        return this._writeSchema().catch((err) => {
            this.definition.splice(index, 0, ...deleted);
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
            return db.collection("_schema").findOneAndUpdate({ collectionSlug: this.tableSlug }, {
                $set: {
                    fields: this.definition
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
            let sequenceKey = `sequences.${columnLabel}`;
            return db.collection("_counters").findOneAndUpdate({
                collection: collection
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
                collection: collection
            }).then((result) => {
                let newSequence = result.sequences[columnLabel] + 1;
                let sequenceKey = `sequences.${columnLabel}`;
                return db.collection("_counters").findOneAndUpdate({
                    collection: collection
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
