"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
class DynamicCollection extends Array {
    /**
     * Creates a new DynamicCollection instance.
     *
     * DynamicCollection is an extension of the native Array object thus
     * implementing all of Array's methods and properties.
     *
     * @name DynamicCollection
     * @constructor
     * @extends Array
     * @param {DynamicRecord.Model} Model - The Model constructor to use for
     *                              this collection
     */
    constructor(Model, ...data) {
        super();
        const models = [];
        data.forEach((d) => {
            this.push(new Model(d));
        });
    }
    /**
     * Returns a native array of data objects
     *
     * @type Array
     */
    get data() {
        const result = [];
        this.forEach((el, i) => {
            result.push(el.data);
        });
        return result;
    }
    /**
     * Converts an array of objects into a DynamicCollection. If an element in
     * the array is not an object, it will be skipped.
     *
     * @method fromArray
     * @memberOf DynamicCollection
     * @static
     * @return DynamicCollection
     * @hidden
     */
    // ABSTRACT STATIC METHOD
    static fromArray(arr, Model) { }
    /**
     * Save all the model instances in the DynamicCollection.
     *
     * Simply calls all the individual model's `save()` method.
     *
     * @method saveAll
     * @memberOf DynamicCollection
     * @instance
     * @return {Promise} Return promise of this DynamicCollection instance
     */
    // CONSIDER: Saving in series thus slow. Can consider assigning a block of counters at once
    saveAll() {
        return Promise.each(this, (model) => {
            if (model.save) {
                return model.save();
            }
        });
    }
    /**
     * Destroy all the model instances in the DynamicCollection.
     *
     * Simply calls all the individual model's `destroy()` method.
     *
     * @method dropAll
     * @memberOf DynamicCollection
     * @instance
     * @return {Promise} Return promise of this DynamicCollection instance
     */
    dropAll() {
        const promises = [];
        this.forEach((model) => {
            if (model.destroy) {
                promises.push(model.destroy());
            }
        });
        return Promise.all(promises).then(() => {
            return Promise.resolve(this);
        });
    }
}
exports.default = DynamicCollection;
