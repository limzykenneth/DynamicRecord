import {DynamicCollection as Collection} from "../DynamicCollection";

export class DynamicCollection extends Collection{
	constructor(Model, ...data){
		super(Model, ...data);
	}

	static fromArray(arr: Array<any>, Model): DynamicCollection{
		const result = arr.reduce((acc, el) => {
			acc.push(new Model(el));
			return acc;
		}, new DynamicCollection(Model));

		return result;
	}
}