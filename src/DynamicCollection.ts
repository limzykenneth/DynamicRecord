import * as Bluebird from "bluebird";
import {ModelConstructor} from "./DynamicRecord";

export abstract class DynamicCollection<DataObject extends object> extends Array{
	/**
	 * **(DEPRECATED - Use `createCollection()` instead)**
	 *
	 * Creates a new DynamicCollection instance.
	 *
	 * DynamicCollection is an extension of the native Array object thus
	 * implementing all of Array's methods and properties.
	 *
	 * @name DynamicCollection
	 * @constructor
	 * @extends Array
	 * @param {DynamicRecord.Model} Model	The Model constructor to use for
	 *                              this collection
	 */
	constructor(Model: ModelConstructor, ...data: DataObject[]){
		super();

		const models = [];
		data.forEach((d) => {
			this.push(new Model<DataObject>(d));
		});
	}

	/**
	 * Returns a native array of data objects
	 *
	 * @name data
	 * @memberOf DynamicCollection
	 * @type Array
	 */
	get data(): Array<DataObject>{
		const result: DataObject[] = [];
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
	 * @param {Array} array	Array to be converted into a DynamicCollection
	 * @return {DynamicCollection}
	 */
	// ABSTRACT STATIC METHOD
	static fromArray<DataObject extends object>(arr: Array<DataObject>, Model: ModelConstructor){}

	/**
	 * Save all the model instances in the DynamicCollection.
	 *
	 * Simply calls all the individual model's `save()` method.
	 *
	 * @method saveAll
	 * @memberOf DynamicCollection
	 * @instance
	 * @return {Promise} - Return promise of this DynamicCollection instance
	 */
	async saveAll(): Promise< DynamicCollection<DataObject> >{
		await Bluebird.each(this, (model) => {
			if(model.save){
				return model.save();
			}
		});
		return this;
	}

	/**
	 * Destroy all the model instances in the DynamicCollection.
	 *
	 * Simply calls all the individual model's `destroy()` method.
	 *
	 * @method dropAll
	 * @memberOf DynamicCollection
	 * @instance
	 * @return {Promise} - Return promise of this DynamicCollection instance
	 */
	async dropAll(): Promise< DynamicCollection<DataObject> >{
		const promises = [];
		this.forEach((model) => {
			if(model.destroy){
				promises.push(model.destroy());
			}
		});

		await Promise.all(promises);
		return this;
	}
}