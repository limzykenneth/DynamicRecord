import * as _ from "lodash";
import * as Ajv from "ajv";
import * as countersSchema from "../schemas/_counters.schema.json";

let connect;

const ajv = new Ajv({
	loadSchema: loadSchema
});

ajv.addSchema(countersSchema, "countersSchema");

async function loadSchema(tableSlug){
	const {db} = await connect;
	const schema = await db.collection("_schema").findOne({"_$id": tableSlug});

	// Restore keys starting with "$" and delete ObjectID field
	const reg = /^_(\$.+?)$/;
	delete schema._id;
	_.each(schema, (el, key) => {
		if(reg.test(key)){
			schema[key.replace(reg, "$1")] = el;
			delete schema[key];
		}
	});

	// Resovle to the restored JSON schema
	return schema;
}

module.exports = function(connection){
	connect = connection;
	return ajv;
};