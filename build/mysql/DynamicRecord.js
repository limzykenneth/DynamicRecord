const DynamicCollection = require("./DynamicCollection.js");
class DynamicRecord {
}
// Static constructors for their own separate use
DynamicRecord.DynamicCollection = DynamicCollection;
module.exports = DynamicRecord;
