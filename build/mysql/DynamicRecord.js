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
const DynamicRecord_1 = require("../DynamicRecord");
const DynamicCollection_1 = require("./DynamicCollection");
const connection_1 = require("./connection");
class DynamicRecord extends DynamicRecord_1.DynamicRecord {
    constructor(options) {
        super();
        this._databaseConnection = connection_1.default;
        const tableSlug = options.tableSlug;
        // const _ready = this._ready = connect.execute("");
        const Model = this.Model = class Model extends DynamicRecord_1.Model {
            constructor(data, _preserveOriginal) {
                super(data, _preserveOriginal);
            }
            save() {
                return __awaiter(this, void 0, void 0, function* () {
                    return this;
                });
            }
            destroy() {
                return __awaiter(this, void 0, void 0, function* () {
                    return this;
                });
            }
            validate(schema) {
                return true;
            }
        };
    }
    closeConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    findBy(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    where(query, orderBy) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    all() {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    first(n) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
}
// Static constructors for their own separate use
// static DynamicSchema = DynamicSchema(connect);
DynamicRecord.DynamicCollection = DynamicCollection_1.default;
module.exports = DynamicRecord;
