const Ajv = require("ajv");
const rootSchema = require("./json-schema-draft-07.schema.json");
const ajv = new Ajv();
ajv.addSchema(rootSchema, "rootSchema");
module.exports = ajv;
