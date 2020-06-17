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
const DynamicRecord_1 = require("../DynamicRecord");
const DynamicCollection_1 = require("./DynamicCollection");
const DynamicSchema_1 = require("./DynamicSchema");
const connection_1 = require("./connection");
const schemaValidator = new (require("./schemaValidation.js"))(connection_1.default);
class DynamicRecord extends DynamicRecord_1.DynamicRecord {
    constructor(options) {
        super();
        this._databaseConnection = connection_1.default;
        const _schema = this.schema = new (DynamicSchema_1.default(this._databaseConnection))();
        const tableSlug = options.tableSlug;
        let _db;
        let _client;
        // Initialize database connection and populate schema instance
        const _ready = this._ready = connection_1.default.then((opts) => {
            const db = _db = this._db = opts.db;
            _client = this._client = opts.client;
            // Collection must already exist in database
            return this.schema.read(tableSlug).then((schema) => {
                if (schema.tableSlug === "")
                    return Promise.reject(`Table with name ${tableSlug} does not exist`);
                const col = db.collection(tableSlug);
                if (col) {
                    return Promise.resolve(col);
                }
                else {
                    return Promise.reject(`Table with name ${tableSlug} does not exist`);
                }
            });
        });
        const Model = this.Model = class Model extends DynamicRecord_1.Model {
            constructor(data, _preserveOriginal) {
                super(data, _preserveOriginal);
            }
            save() {
                return __awaiter(this, void 0, void 0, function* () {
                    const col = yield _ready;
                    if (this._original) {
                        delete this.data._id;
                        yield validateData(this.data);
                        yield col.updateOne(this._original, { $set: this.data }, { upsert: true });
                        this._original = _.cloneDeep(this.data);
                        return this;
                    }
                    else {
                        // Check if collection contains index that needs auto incrementing
                        return _db.collection("_counters").findOne({ _$id: tableSlug }).then((res) => __awaiter(this, void 0, void 0, function* () {
                            const promises = [];
                            if (res !== null) {
                                // Auto incrementing index exist
                                _.each(res.sequences, (el, columnLabel) => {
                                    promises.push(_schema._incrementCounter(tableSlug, columnLabel).then((newSequence) => {
                                        this.data[columnLabel] = newSequence;
                                        return Promise.resolve(newSequence);
                                    }));
                                });
                                yield Promise.all(promises);
                            }
                            yield validateData(this.data);
                            // Save data into the database
                            yield col.insertOne(this.data);
                            this._original = _.cloneDeep(this.data);
                            return this;
                        })).catch((err) => __awaiter(this, void 0, void 0, function* () {
                            // Reverse database actions
                            try {
                                yield Promise.all([
                                    // 1. Decrement autoincrement counter
                                    _db.collection("_counters").findOne({ _$id: tableSlug }).then((res) => {
                                        const promises = [];
                                        _.each(res.sequences, (el, columnLabel) => {
                                            promises.push(_schema._decrementCounter(tableSlug, columnLabel));
                                        });
                                        return Promise.all(promises);
                                    })
                                ]);
                                return Promise.reject(err);
                            }
                            catch (e) {
                                return Promise.reject(e);
                            }
                        }));
                    }
                    function validateData(data) {
                        return __awaiter(this, void 0, void 0, function* () {
                            const validate = yield schemaValidator.compileAsync({ $ref: _schema.tableSlug });
                            if (validate(data)) {
                                return Promise.resolve();
                            }
                            else {
                                return Promise.reject(new Error(validate.errors));
                            }
                        });
                    }
                });
            }
            destroy() {
                return __awaiter(this, void 0, void 0, function* () {
                    const col = yield _ready;
                    if (this._original) {
                        yield col.deleteOne(this._original);
                        this._original = null;
                        this.data = null;
                        return this;
                    }
                    else {
                        throw new Error("Model not saved in database yet.");
                    }
                });
            }
            validate(schema) {
                let result = false;
                _.each(this.data, (el, key) => {
                    const field = _.find(schema, (column) => {
                        return column.label == key;
                    });
                    if (field.type == "string") {
                        result = _.isString(el);
                    }
                    else if (field.type == "int") {
                        result = Number.isInteger(el);
                    }
                });
                return result;
            }
        };
    }
    closeConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            // Should only ever be called to terminate the node process
            try {
                yield this._ready;
                this._client.close();
            }
            catch (e) {
                // BY ANY MEANS NECESSARY
                this._client.close();
            }
        });
    }
    findBy(query) {
        return __awaiter(this, void 0, void 0, function* () {
            // CONSIDER: Possibly implement our own unique id system
            const col = yield this._ready;
            const model = yield col.findOne(query);
            if (model !== null) {
                // Delete mongodb added "_id" field
                delete model._id;
                return new this.Model(model, true);
            }
            else {
                return null;
            }
        });
    }
    where(query, orderBy) {
        return __awaiter(this, void 0, void 0, function* () {
            const col = yield this._ready;
            let models = yield col.find(query).toArray();
            if (orderBy) {
                models = _.sortBy(models, orderBy);
            }
            // Delete mongodb added "_id" field
            models.forEach((el) => {
                delete el._id;
            });
            const results = new DynamicCollection_1.default(this.Model, ...models);
            results.forEach((result) => {
                result._original = _.cloneDeep(result.data);
            });
            return results;
        });
    }
    all() {
        return __awaiter(this, void 0, void 0, function* () {
            const col = yield this._ready;
            let models = yield col.find().toArray();
            // Delete mongodb added "_id" field
            models.forEach((el) => {
                delete el._id;
            });
            const results = new DynamicCollection_1.default(this.Model, ...models);
            results.forEach((result) => {
                result._original = _.cloneDeep(result.data);
            });
            return results;
        });
    }
    first(n) {
        return __awaiter(this, void 0, void 0, function* () {
            const col = yield this._ready;
            if (typeof n === "undefined") {
                const model = yield col.findOne();
                if (model !== null) {
                    // Delete mongodb added "_id" field
                    delete model._id;
                    return new this.Model(model, true);
                }
                else {
                    return null;
                }
            }
            else {
                const models = yield col.find({}).limit(n).toArray();
                // Delete mongodb added "_id" field
                models.forEach((el) => {
                    delete el._id;
                });
                return new DynamicCollection_1.default(this.Model, ...models);
            }
        });
    }
}
// Static constructors for their own separate use
DynamicRecord.DynamicSchema = DynamicSchema_1.default(connection_1.default);
DynamicRecord.DynamicCollection = DynamicCollection_1.default;
module.exports = DynamicRecord;
