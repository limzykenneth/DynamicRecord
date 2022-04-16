import * as _ from "lodash";
import {TableSchema, SchemaDefinitions, IndexOptions, DynamicSchema as Schema} from "../DynamicSchema";

let connect;

export class DynamicSchema extends Schema{
	constructor({connection}){
		super({connection});
	}

	async createTable(schemaInput:TableSchema): Promise<DynamicSchema>{
		// Create the collection, ensuring that is doesn't already exist
		// in the database
		const [results] = await connect.execute("SELECT table_name FROM INFORMATION_SCHEMA.TABLES WHERE table_name=?", [schemaInput.$id]);
		if(results.length === 0){
			const schema = _.cloneDeep(schemaInput);
			const tableSlug:string = schema.$id;
			const tableName:string = schema.title || schema.$id;
			const columns:SchemaDefinitions = schema.properties;
			const required = _.cloneDeep(schema.required) || [];
			const description = schema.description || "";

			const columnQueries = [];
			const indexQueries = [];
			const uniqueQueries = [];
			_.each(columns, (column, name) => {
				let q = "";
				if(column.type === "string"){
					q += `${name} LONGTEXT`;
					setNotNullIncrement();
					columnQueries.push(q);
				}else if(column.type === "integer"){
					q += `${name} INT`;
					setNotNullIncrement();
					columnQueries.push(q);
				}else if(column.type === "number"){
					q += `${name} DOUBLE`;
					setNotNullIncrement();
					columnQueries.push(q);
				}else if(column.type === "boolean"){
					q += `${name} BOOLEAN`;
					setNotNullIncrement();
					columnQueries.push(q);
				}else{
					// NOTE: If it's `null`, `object`, or `array`, we just store as string for now
					q += `${name} LONGTEXT`;
					setNotNullIncrement();
					columnQueries.push(q);
				}

				if(column.isIndex || column.isUnique || column.isAutoIncrement){
					indexQueries.push(name);
				}
				if(column.isUnique){
					uniqueQueries.push(name);
				}

				function setNotNullIncrement(){
					if(_.includes(schema.required, name)){
						q += " NOT NULL";

						if(column.isAutoIncrement){
							q += " AUTO_INCREMENT";
						}
					}else if(column.isAutoIncrement){
						q += " NOT NULL AUTO_INCREMENT";
					}
				}
			});
			let partialSql = `${columnQueries.join(", ")}`;
			if(indexQueries.length > 0){
				partialSql += `, INDEX (${indexQueries.join(", ")})`;
			}
			if(uniqueQueries.length > 0){
				partialSql += `, UNIQUE KEY (${uniqueQueries.join(", ")})`;
			}
			const sql = `CREATE TABLE ${connect.escapeId(tableSlug, true)} (${partialSql})`;

			try{
				await Promise.all([
					connect.execute(sql),
					connect.execute("INSERT INTO _schema ($id, jsonschema) VALUES (?, ?)", [tableSlug, JSON.stringify(schema)])
				]);
				return this;
			} catch(e) {
				// Query failed, reset object state
				this.tableName = null;
				this.tableSlug = null;
				this.required = [];
				this.description = "";
				this.jsonSchema = {};

				return Promise.all([
					connect.execute(`DROP TABLE ${connect.escapeId(tableSlug, true)}`),
					connect.execute("DELETE FROM _schema WHERE $id = ?", [tableSlug])
				]).then(() => {
					return Promise.reject(e);
				}).catch((err) => {
					if(err.errno === 1051){
						return Promise.reject(e);
					}else{
						return Promise.reject(err);
					}
				});
			}
		}else{
			// Table with same name already exist
			return Promise.reject(new Error(`Table with slug ${schemaInput.$id} already exist.`));
		}
	}

	async dropTable(): Promise<DynamicSchema>{
		return this;
	}

	async renameTable(newSlug:string, newName?:string): Promise<DynamicSchema>{
		return this;
	}

	async addIndex(options:IndexOptions): Promise<DynamicSchema>{
		return this;
	}

	async removeIndex(columnName:string): Promise<DynamicSchema>{
		return this;
	}

	async read(tableSlug:string): Promise<DynamicSchema>{
		return this;
	}

	async define(def:SchemaDefinitions): Promise<DynamicSchema>{
		return this;
	}

	async renameColumn(name:string, newName:string): Promise<DynamicSchema>{
		return this;
	}

	// Utils --------------------------------------------------------
	async _writeSchema(): Promise<DynamicSchema>{
		return this;
	}
}