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

	static async closeConnection(){
		await super.closeConnection();

		try{
			await connect.getConnection();
			await connect.end();
		}catch(err){
			if(err.message !== "Pool is closed."){
				console.error(err);
				process.exit(1);
			}
		}
	}

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
				try{
					const connect = await _ready;
					if(this._original){
						// Update entry
						// UPDATE table1 SET field1=new_value1 WHERE condition;
						const fields = [];
						const values = [];
						const q = [];
						const conditions = [];

						// await connect.execute(`UPDATE ${connect.escapeId(tableSlug, true)} SET ${fields.join(", ")} WHERE `);
					}else{
						// Insert new entry
						// INSERT INTO table1 (field1, field2) VALUES (value1, value2);
						const fields = [];
						const values = [];
						const q = [];

						_.each(this.data, (val, key) => {
							fields.push(connect.escapeId(key, true));
							values.push(val);
							q.push("?");
						});
						await connect.execute(`INSERT INTO ${connect.escapeId(tableSlug, true)} (${fields.join(", ")}) VALUES (${q.join(", ")})`, values);
					}

					this._original = _.cloneDeep(this.data);

					return this;
				}catch(err){
					return Promise.reject(err);
				}
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
		try{
			await connect.getConnection();
			await connect.end();
		}catch(err){
			if(err.message !== "Pool is closed."){
				console.error(err);
				process.exit(1);
			}
		}
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
		try{
			const connect = await this._ready;
			let condition = [];
			let q = [];

			_.each(query, (val, key) => {
				condition.push(`${connect.escapeId(key, true)}=?`);
				q.push(val);
			});

			const [result] = await connect.execute(`SELECT * FROM ${connect.escapeId(this.schema.tableSlug, true)} WHERE ${condition.join(" AND ")}`, q);

			const ret = new DynamicCollection(this.Model, ...result);
			ret.forEach((r) => {
				r._original = _.cloneDeep(r.data);
			});

			return ret;
		}catch(e){
			return Promise.reject(e);
		}
	}

	async all(): Promise<DynamicCollection>{
		try{
			const connect = await this._ready;

			const [result] = await connect.execute(`SELECT * FROM ${connect.escapeId(this.schema.tableSlug, true)}`);

			const ret = new DynamicCollection(this.Model, ...result);
			ret.forEach((r) => {
				r._original = _.cloneDeep(r.data);
			});

			return ret;
		}catch(e){
			return Promise.reject(e);
		}
	}

	async first(n:number=1): Promise<ModelBase|DynamicCollection>{
		try{
			const connect = await this._ready;
			const [result] = await connect.execute(`SELECT * FROM ${connect.escapeId(this.schema.tableSlug, true)} LIMIT ${n}`);

			if(n === 1){
				if(result.length > 0){
					return new this.Model(result[0], true);
				}else{
					return null;
				}
			}else{
				const ret = new DynamicCollection(this.Model, ...result);
				ret.forEach((r) => {
					r._original = _.cloneDeep(r.data);
				});

				return ret;
			}
		}catch(e){
			return Promise.reject(e);
		}
	}
}

module.exports = DynamicRecord;