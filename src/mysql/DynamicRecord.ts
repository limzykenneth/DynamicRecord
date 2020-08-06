import * as _ from "lodash";
import {Model as ModelBase, DynamicRecord as DRBase} from "../DynamicRecord";
import DynamicCollection from "./DynamicCollection";
import DynamicSchema from "./DynamicSchema";
import connect from "./connection";

class DynamicRecord extends DRBase{
	// Static constructors for their own separate use
	static DynamicSchema = DynamicSchema(connect);
	static DynamicCollection = DynamicCollection;

	private _databaseConnection: any;
	private _ready: any;

	constructor(options){
		super(options);
		this._databaseConnection = connect;
		const _schema = this.schema = new (DynamicSchema(this._databaseConnection))();
		const tableSlug = options.tableSlug;

		const _ready = this._ready = (async () => {
			const schema = await this.schema.read(tableSlug);
			if(schema.tableSlug === "") return Promise.reject(`Table with name ${tableSlug} does not exist`);
			return connect;
		})();

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
		try{
			const connect = await this._ready;
			let condition = [];
			let q = [];

			_.each(query, (val, key) => {
				condition.push(`${connect.escapeId(key, true)}=?`);
				q.push(val);
			});

			const [result] = await connect.execute(`SELECT * FROM ${connect.escapeId(this.schema.tableSlug, true)} WHERE ${condition.join(" AND ")} LIMIT 1`, q);
			if(result.length > 0){
				return new this.Model(result[0], true);
			}else{
				return null;
			}
		}catch(e){
			return Promise.reject(e);
		}
	}

	async where(query: object, orderBy: string | Function): Promise<DynamicCollection>{
		return null;
	}

	async all(): Promise<DynamicCollection>{
		return null;
	}

	async first(n?:number): Promise<ModelBase|DynamicCollection>{
		return null;
	}
}

module.exports = DynamicRecord;