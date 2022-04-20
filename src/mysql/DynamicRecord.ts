import * as _ from "lodash";
import {Model as ModelBase, DynamicRecord as DRBase} from "../DynamicRecord";
import {DynamicCollection} from "./DynamicCollection";
import {QueryOptions} from "../interfaces/DynamicRecord";

export class DynamicRecord<DataObject extends object> extends DRBase<DataObject> {
	private _databaseConnection: any;
	private _ready: any;

	constructor(options){
		super(options);
		this._databaseConnection = options.connection.interface;
		const tableSlug = options.tableSlug;

		// const _ready = this._ready = connect.execute("");
		const Model = this.Model = class Model<DataObject extends object> extends ModelBase<DataObject> {
			constructor(data, _preserveOriginal){
				super(data, _preserveOriginal);
			}

			async save(): Promise<Model<DataObject>>{
				return this;
			}

			async destroy(): Promise<Model<DataObject>>{
				return this;
			}

			validate(schema): boolean{
				return true;
			}
		};
	}

	async closeConnection(): Promise<any>{
		return null;
	}

	async findBy(query: object): Promise< ModelBase<DataObject> >{
		return null;
	}

	async where(query: object, options?: QueryOptions): Promise<DynamicCollection> {
		return null;
	}

	async all(): Promise<DynamicCollection>{
		return null;
	}

	async first(options?: QueryOptions): Promise< ModelBase<DataObject>|DynamicCollection >{
		return null;
	}

	async last(options?: QueryOptions): Promise< ModelBase<DataObject>|DynamicCollection >{
		return null;
	}
}