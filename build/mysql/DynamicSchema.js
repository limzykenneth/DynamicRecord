"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const DynamicSchema_1 = require("../DynamicSchema");
let connect;
class DynamicSchema extends DynamicSchema_1.DynamicSchema {
    constructor() {
        super();
    }
    createTable(schemaInput) {
        return __awaiter(this, void 0, void 0, function* () {
            // Create the collection, ensuring that is doesn't already exist
            // in the database
            const [results] = yield connect.execute("SELECT table_name FROM INFORMATION_SCHEMA.TABLES WHERE table_name=?", [schemaInput.$id]);
            if (results.length === 0) {
                const schema = _.cloneDeep(schemaInput);
                const tableSlug = schema.$id;
                const tableName = schema.title || schema.$id;
                const columns = schema.properties;
                const required = _.cloneDeep(schema.required) || [];
                const description = schema.description || "";
                const columnQueries = [];
                const indexQueries = [];
                const uniqueQueries = [];
                _.each(columns, (column, name) => {
                    let q = "";
                    if (column.type === "string") {
                        q += `${name} LONGTEXT`;
                        setNotNullIncrement();
                        columnQueries.push(q);
                    }
                    else if (column.type === "integer") {
                        q += `${name} INT`;
                        setNotNullIncrement();
                        columnQueries.push(q);
                    }
                    else if (column.type === "number") {
                        q += `${name} DOUBLE`;
                        setNotNullIncrement();
                        columnQueries.push(q);
                    }
                    else if (column.type === "boolean") {
                        q += `${name} BOOLEAN`;
                        setNotNullIncrement();
                        columnQueries.push(q);
                    }
                    else {
                        // NOTE: If it's `null`, `object`, or `array`, we just store as string for now
                        q += `${name} LONGTEXT`;
                        setNotNullIncrement();
                        columnQueries.push(q);
                    }
                    if (column.isIndex || column.isUnique || column.isAutoIncrement) {
                        indexQueries.push(name);
                    }
                    if (column.isUnique) {
                        uniqueQueries.push(name);
                    }
                    function setNotNullIncrement() {
                        if (_.includes(schema.required, name)) {
                            q += " NOT NULL";
                            if (column.isAutoIncrement) {
                                q += " AUTO_INCREMENT";
                            }
                        }
                        else if (column.isAutoIncrement) {
                            q += " NOT NULL AUTO_INCREMENT";
                        }
                    }
                });
                let partialSql = `${columnQueries.join(", ")}`;
                if (indexQueries.length > 0) {
                    partialSql += `, INDEX (${indexQueries.join(", ")})`;
                }
                if (uniqueQueries.length > 0) {
                    partialSql += `, UNIQUE KEY (${uniqueQueries.join(", ")})`;
                }
                const sql = `CREATE TABLE ${connect.escapeId(tableSlug, true)} (${partialSql})`;
                try {
                    yield Promise.all([
                        connect.execute(sql),
                        connect.execute("INSERT INTO _schema ($id, jsonschema) VALUES (?, ?)", [tableSlug, JSON.stringify(schema)])
                    ]);
                    return this;
                }
                catch (e) {
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
                        if (err.errno === 1051) {
                            return Promise.reject(e);
                        }
                        else {
                            return Promise.reject(err);
                        }
                    });
                }
            }
            else {
                // Table with same name already exist
                return Promise.reject(new Error(`Table with slug ${schemaInput.$id} already exist.`));
            }
        });
    }
    dropTable() {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    renameTable(newSlug, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    addIndex(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    removeIndex(columnName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    read(tableSlug) {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    define(def) {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    renameColumn(name, newName) {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    // Utils --------------------------------------------------------
    _writeSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
}
function default_1(connection) {
    connect = connection;
    return DynamicSchema;
}
exports.default = default_1;
