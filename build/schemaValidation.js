var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const Ajv = require("ajv");
const _ = require("lodash");
const countersSchema = require("./schemas/_counters.schema.json");
let connect;
const ajv = new Ajv({
    loadSchema: loadSchema
});
ajv.addSchema(countersSchema, "countersSchema");
function loadSchema(tableSlug) {
    return __awaiter(this, void 0, void 0, function* () {
        const { db } = yield connect;
        const schema = yield db.collection("_schema").findOne({ "_$id": tableSlug });
        // Restore keys starting with "$" and delete ObjectID field
        const reg = /^_(\$.+?)$/;
        delete schema._id;
        _.each(schema, (el, key) => {
            if (reg.test(key)) {
                schema[key.replace(reg, "$1")] = el;
                delete schema[key];
            }
        });
        // Resovle to the restored JSON schema
        return schema;
    });
}
module.exports = function (connection) {
    connect = connection;
    return ajv;
};
