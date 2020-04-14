"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DynamicCollection_1 = require("../DynamicCollection");
class DynamicCollection extends DynamicCollection_1.default {
    constructor(Model, ...data) {
        super(Model, ...data);
    }
    // Not sure if this is necessary as we can just destructure array
    static fromArray(arr, Model) {
        const result = arr.reduce((acc, el) => {
            acc.push(new Model(el));
            return acc;
        }, new DynamicCollection(Model));
        return result;
    }
}
module.exports = DynamicCollection;
