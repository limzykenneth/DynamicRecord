import _ = require("lodash");
import Promise = require("bluebird");

class DynamicCollection extends Array{
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
	constructor(Model, ...data){
		super();

		const models = [];
		_.each(data, (d) => {
			this.push(new Model(d));
		});
	}

	/**
	 * Returns a native array of data objects
	 *
	 * @type Array
	 */
	get data(){
		const result = [];
		_.each(this, (el, i) => {
			result.push(el.data);
		});
		return result;
	}

	/**
	 * Save all the model instances in the DynamicCollection.
	 *
	 * Simply calls all the individual model's `save()` method.
	 *
	 * @method saveAll
	 * @memberOf DynamicCollection
	 * @instance
	 * @return {Promise}
	 */
	saveAll(){
		const promises = [];
		_.each(this, (model) => {
			if(model.save){
				promises.push(model.save());
			}
		});

		return Promise.all(promises);
	}
}

module.exports = DynamicCollection;