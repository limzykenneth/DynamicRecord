const Ajv = require("ajv");
const _ = require("lodash");
const rootSchema = require("./json-schema-draft-07.schema.json");
let connect;
const ajv = new Ajv({
    loadSchema: loadSchema
});
ajv.addSchema(rootSchema, "rootSchema");
function loadSchema(tableSlug) {
    return connect.then((db) => {
        return db.collection("_schema").findOne({ "_$id": tableSlug });
    }).then((schema) => {
        const reg = /^_(\$.+?)$/;
        delete schema._id;
        _.each(schema, (el, key) => {
            if (reg.test(key)) {
                schema[key.replace(reg, "$1")] = el;
                delete schema[key];
            }
        });
        console.log(schema);
        return Promise.resolve(schema);
    });
}
module.exports = function (connection) {
    connect = connection;
    return ajv;
};
