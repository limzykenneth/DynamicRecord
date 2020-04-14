// const Collection = require("../DynamicCollection");
import DynamicCollection as Collection from "./DynamicCollection";

class MySQLCollection extends Collection{
	constructor(Model, ...data){
		super(Model, ...data);
	}

	// Not sure if this is necessary as we can just destructure array
	static fromArray(arr: Array<any>, Model): MySQLCollection{
		const result = arr.reduce((acc, el) => {
			acc.push(new Model(el));
			return acc;
		}, new MySQLCollection(Model));

		return result;
	}
}

module.exports = MySQLCollection;