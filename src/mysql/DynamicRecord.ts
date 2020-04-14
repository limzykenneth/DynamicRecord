import * as _ from "lodash";
const DynamicCollection = require("./DynamicCollection.js");

class DynamicRecord {
	// Static constructors for their own separate use
	static DynamicCollection = DynamicCollection;
}

module.exports = DynamicRecord;