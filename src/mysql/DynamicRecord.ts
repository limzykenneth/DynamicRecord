import * as _ from "lodash";
import {Model as ModelBase, DynamicRecord as DRBase} from "../DynamicRecord";
import DynamicCollection from "./DynamicCollection";
import connect from "./connection";
import {QueryOptions} from "../interfaces/DynamicRecord";

class DynamicRecord extends DRBase{
	// Static constructors for their own separate use
	// static DynamicSchema = DynamicSchema(connect);
	static DynamicCollection = DynamicCollection;

	private _databaseConnection: any;
	private _ready: any;

	constructor(options){
		super(options);
		this._databaseConnection = connect;
		const tableSlug = options.tableSlug;

		// const _ready = this._ready = connect.execute("");
		const Model = this.Model = class Model extends ModelBase{
			constructor(data, _preserveOriginal){
				super(data, _preserveOriginal);
			}

			async save(): Promise<Model>{
				return this;
			}

			async destroy(): Promise<Model>{
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

	async findBy(query: object): Promise<ModelBase>{
		return null;
	}

	async where(query: object, options?: QueryOptions): Promise<DynamicCollection>{
		return null;
	}

	async all(): Promise<DynamicCollection>{
		return null;
	}

	async first(options?: QueryOptions): Promise<ModelBase|DynamicCollection>{
		return null;
	}

	async last(options?: QueryOptions): Promise<ModelBase|DynamicCollection>{
		return null;
	}
}

module.exports = DynamicRecord;