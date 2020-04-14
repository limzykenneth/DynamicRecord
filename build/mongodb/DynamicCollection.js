const Collection = require("../DynamicCollection");
class MongoDBCollection extends Collection {
    constructor(Model, ...data) {
        super(Model, ...data);
    }
    // Not sure if this is necessary as we can just destructure array
    static fromArray(arr, Model) {
        const result = arr.reduce((acc, el) => {
            acc.push(new Model(el));
            return acc;
        }, new MongoDBCollection(Model));
        return result;
    }
}
module.exports = MongoDBCollection;
