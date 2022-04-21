import {DynamicCollection as Collection} from "../DynamicCollection";
import {ModelConstructor} from "../DynamicRecord";

export class DynamicCollection<DataObject extends object> extends Collection<DataObject> {
	constructor(Model: ModelConstructor, ...data: DataObject[]){
		super(Model, ...data);
	}

	static fromArray<DataObject extends object>(arr: Array<DataObject>, Model: ModelConstructor): DynamicCollection<DataObject> {
		const result = arr.reduce((acc, el) => {
			acc.push(new Model<DataObject>(el));
			return acc;
		}, new DynamicCollection<DataObject>(Model));

		return result;
	}
}