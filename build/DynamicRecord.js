"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
class DynamicRecord {
    /**
     * Creates a new DynamicRecord instance.
     *
     * @name DynamicRecord
     * @class
     * @param {object} options
     * @param {string} options.tableSlug - The slug of the table. Must be lowercase only
     * and not containing any whitespace
     */
    constructor() { }
}
exports.DynamicRecord = DynamicRecord;
class Model {
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
    constructor(data, _preserveOriginal) {
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
        if (_preserveOriginal) {
            this._original = _.cloneDeep(data);
        }
        else {
            this._original = null;
        }
    }
}
exports.Model = Model;
