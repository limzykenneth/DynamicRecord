"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
let con;
{ }
// Let's get mongodb working first
class Schema {
    constructor() {
        this.tableName = null;
        this.tableSlug = null;
        this.definition = [];
    }
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
    removeIndex(columnName) {
        return con.then((db) => {
            return db.collection(this.tableSlug).dropIndex(columnName);
        }).catch((err) => {
            throw err;
        });
    }
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
    addColumns(def) {
        let oldDefinition = _.cloneDeep(this.definition);
        this.definition = this.definition.concat(def);
        return this._writeSchema().catch((err) => {
            this.definition = _.cloneDeep(oldDefinition);
            throw err;
        });
    }
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
    _writeSchema() {
        return con.then((db) => {
            return db.collection("_schema").findOneAndUpdate({ collectionSlug: this.tableSlug }, {
                $set: {
                    fields: this.definition
                }
            });
        });
    }
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
