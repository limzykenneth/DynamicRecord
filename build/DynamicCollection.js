"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Promise = require("bluebird");
/**
 * DynamicCollection is an extension of the native Array object thus
 * implementing all of Array's methods and properties.
 *
 * @namespace DynamicCollection
 * @class
 * @extends Array
 *
 */
class DynamicCollection extends Array {
    constructor(Model, ...data) {
        super();
        const models = [];
        _.each(data, (d) => {
            this.push(new Model(d));
        });
    }
    /**
     * Returns a native array of data objects
     *
     * @property {Array} data
     */
    get data() {
        const result = [];
        _.each(this, (el, i) => {
            result.push(el.data);
        });
        return result;
    }
    saveAll() {
        const promises = [];
        _.each(this, (model) => {
            if (model.save) {
                promises.push(model.save());
            }
        });
        return Promise.all(promises);
    }
}
module.exports = DynamicCollection;
