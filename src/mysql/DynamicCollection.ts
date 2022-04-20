import {DynamicCollection as Collection} from "../DynamicCollection";
import {ModelConstructor} from "../DynamicRecord";

export class DynamicCollection<DataObject extends object> extends Collection<DataObject> {
	constructor(Model: ModelConstructor, ...data: DataObject[]){
		super(Model, ...data);
	}

	static fromArray(arr: Array<any>, Model): DynamicCollection<object> {
		const result = arr.reduce((acc, el) => {
			acc.push(new Model(el));
			return acc;
		}, new DynamicCollection(Model));

		return result;
	}
}