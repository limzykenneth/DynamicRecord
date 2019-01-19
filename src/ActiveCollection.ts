import _ = require("lodash");

/**
 * ActiveCollection is an extension of the native Array object thus
 * implementing all of Array's methods and properties.
 *
 * @namespace ActiveCollection
 * @class
 * @extends Array
 *
 */
class ActiveCollection extends Array{
	/**
	 * Returns a native array of data objects
	 *
	 * @property {Array} data
	 */
	get data(){
		const result = [];
		_.each(this, (el, i) => {
			result.push(el.data);
		});
		return result;
	}
}

module.exports = ActiveCollection;