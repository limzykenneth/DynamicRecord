import * as _ from "lodash";
import DynamicCollection from "./DynamicCollection";

class DynamicRecord {
	// Static constructors for their own separate use
	static DynamicCollection = DynamicCollection;
}

module.exports = DynamicRecord;