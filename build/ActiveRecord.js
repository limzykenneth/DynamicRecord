"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const Promise = require("bluebird");
const _ = require("lodash");
const ActiveCollection = require("./ActiveCollection.js");
const ActiveSchema = require("./ActiveSchema.js");
// Let's get mongodb working first
const connect = require("./mongoConnection.js")(process.env.mongo_server, process.env.mongo_db_name, process.env.mongo_user, process.env.mongo_pass);
/** @namespace ActiveRecord */
/**
 * Creates a new ActiveRecord instance.
 *
 * @class
 * @param {object} options
 * @param {string} options.tableSlug - The slug of the table. Must be lowercase only
 * and not containing any whitespace
 * @param {string} [options.tableName] - The name of the table. Default to `options.tableSlug`
 * if not provided
 */
class ActiveRecord {
    constructor(options) {
        const tableSlug = options.tableSlug;
        const tableName = options.tableName || options.tableSlug;
        let _db;
        this._databaseConnection = connect;
        let _schema;
        _schema = this.Schema = new (ActiveSchema(this._databaseConnection))();
        const _ready = this._ready = connect.then((db) => {
            _db = this._db = db;
            return db.createCollection(tableSlug).then((col) => {
                this._tableName = tableName;
                return Promise.resolve(col);
            });
        });
        /**
         * Create a new ActiveRecord.Model instance
         *
         * @name ActiveRecord.Model
         * @constructor
         * @param {object} data - Object containing data for this instance of ActiveRecord.Model
         */
        const Model = this.Model = function (data, _preserveOriginal) {
            /**
             * The data contained in this instance. It is not kept in sync with the database
             * automatically.
             *
             * @property {object} data
             */
            this.data = data;
            if (_preserveOriginal) {
                this._original = _.cloneDeep(data);
            }
            else {
                this._original = null;
            }
        };
        /**
         * Save the data in this instance to the database
         *
         * @method save
         * @return {Promise}
         */
        Model.prototype.save = function () {
            return _ready.then((col) => {
                if (this._original) {
                    return col.updateOne(this._original, this.data, { upsert: true }).then((result) => {
                        this._original = _.cloneDeep(this.data);
                        return Promise.resolve(col);
                    });
                }
                else {
                    // Check if collection contains index that needs auto incrementing
                    return _db.collection("_counters").findOne({ collection: tableSlug }).then((res) => {
                        const promises = [];
                        if (res !== null) {
                            // Auto incrementing index exist
                            _.each(res.sequences, (el, columnLabel) => {
                                promises.push(_schema._incrementCounter(tableSlug, columnLabel).then((newSequence) => {
                                    this.data[columnLabel] = newSequence;
                                    return Promise.resolve(newSequence);
                                }));
                            });
                            return Promise.all(promises);
                        }
                        else {
                            // No auto incrementing index
                            return Promise.resolve();
                        }
                    }).then(() => {
                        // Save data into the database
                        return col.insertOne(this.data).then((result) => {
                            this._original = _.cloneDeep(this.data);
                            return Promise.resolve(col);
                        });
                    });
                }
            });
        };
        /**
         * Delete the entry this instance links to
         *
         * @method destroy
         * @return {Promise}
         */
        Model.prototype.destroy = function () {
            return _ready.then((col) => {
                if (this._original) {
                    return col.deleteOne(this._original).then((result) => {
                        this._original = null;
                        this.data = null;
                        return Promise.resolve(col);
                    });
                }
                else {
                    throw new Error("Model not saved in database yet.");
                }
            });
        };
        /**
         * Validate the data in this instance conform to its schema
         *
         * @method validate
         * @return {Promise}
         */
        Model.prototype.validate = function (schema) {
            let result = false;
            _.each(this.data, (el, key) => {
                const field = _.find(schema, (column) => {
                    return column.label == key;
                });
                if (field.type == "string") {
                    result = _.isString(el);
                }
                else if (field.type == "int") {
                    result = Number.isInteger(el);
                }
            });
            return result;
        };
    }
    /**
     * Close the connection to the database server.
     *
     * @method closeConnection
     */
    closeConnection() {
        // Should only ever be called to terminate the node process
        this._ready.then((col) => {
            this._db.close();
        }).catch((err) => {
            // BY ANY MEANS NECESSARY
            this._db.close();
        });
    }
    /**
     * Find the latest entry in the table that match the query.
     *
     * @method findBy
     * @param {object} query - A key value pair that will be used to match for entry
     * in the database
     * @return {ActiveRecord.Model} An instance of ActiveRecord.Model created from the
     * retrieved data
     */
    findBy(query) {
        return this._ready.then((col) => {
            return col.findOne(query).then((model) => {
                return Promise.resolve(new this.Model(model, true));
            });
        });
    }
    /**
     * Find all the entries in the table that match the query.
     *
     * @method where
     * @param {object} query - A key value pair that will be used to match for entries
     * @param {string|function} orderBy - The key to sort by or a sorting function
     * @return {ActiveCollection} An instance of ActiveCollection containing a list of
     * ActiveRecord.Model objects created from the retrieved data
     */
    where(query, orderBy) {
        return this._ready.then((col) => {
            return col.find(query).toArray().then((models) => {
                if (orderBy) {
                    models = _.sortBy(models, orderBy);
                }
                const results = new ActiveCollection(this.Model, ...models);
                return Promise.resolve(results);
            });
        });
    }
    /**
     * Return all entries from the table
     *
     * @method all
     * @return {ActiveCollection} An instance of ActiveCollection containing a list of
     * ActiveRecord.Model objects created from all entries in the table
     */
    all() {
        return this._ready.then((col) => {
            return col.find().toArray().then((models) => {
                const results = new ActiveCollection(this.Model, ...models);
                return Promise.resolve(results);
            });
        });
    }
    /**
     * Return the first entry in the table
     *
     * @method first
     * @return {ActiveRecord.Model} An instance of ActiveRecord.Model created from the
     * first entry in the table
     */
    first() {
        return this._ready.then((col) => {
            return col.findOne().then((model) => {
                return Promise.resolve(new this.Model(model, true));
            });
        });
    }
}
ActiveRecord.ActiveSchema = new (ActiveSchema(connect))();
ActiveRecord.ActiveCollection = ActiveCollection;
module.exports = ActiveRecord;
