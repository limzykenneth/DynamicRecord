const Ajv = require("ajv");
const rootSchema = require("./json-schema-draft-07.schema.json");
let connect;
ajv = new Ajv({
    loadSchema: loadSchema
});
ajv.addSchema(rootSchema, "rootSchema");
function loadSchema(tableSlug) {
    return connect.then((db) => {
        return db.collection("_schema").findOne({ "_$id": tableSlug });
    }).then((schema) => {
        console.log(schema);
        return Promise.resolve(schema);
    });
}
module.exports = function (connection) {
    connect = connection;
    return ajv;
};
