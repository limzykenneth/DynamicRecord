const _ = require("lodash");
const testSchema = Object.freeze(require("../random_table.schema.json"));

let utils = {};

utils.dropTestTable = async function(connect){
	const connection = await connect;

	return Promise.all([
		connection.execute(`DROP TABLE ${testSchema.$id}`),
		connection.execute("DROP TABLE _schema"),
		connection.execute("DROP TABLE test_table")
	]).catch((err) => {
		// Error 1051 "Unknown table error", ignore it
		// Everything else, quits with error code 1
		if(err.errno !== 1051){
			console.error(err);
			process.exit(1);
		}
	});
};

utils.setupSuite = async function(connect){
	const connection = await connect;

	const fields = [];
	const indexes = [];
	_.each(testSchema.properties, (property, key) => {
		switch(property.type){
			case "string":
				fields.push(`${key} LONGTEXT`);
				break;

			case "integer":
				fields.push(`${key} INT`);
				break;

			case "number":
				fields.push(`${key} DOUBLE`);
				break;

			case "boolean":
				fields.push(`${key} BOOLEAN`);
				break;

			// NOTE: If it's `null`, `object`, or `array`, we just store as string for now
			default:
				fields.push(`${key} LONGTEXT`);
		}
	});

	const tableQuery = `CREATE TABLE ${testSchema.$id} (${fields.join(", ")})`;

	await connection.execute(tableQuery);
	await connection.execute("INSERT INTO _schema ($id, jsonschema) VALUES (?, ?)", [testSchema.$id, JSON.stringify(testSchema)]);
};

utils.cleanUpSuite = async function(connect){
	const connection = await connect;
	await connection.destroy();
};

module.exports = utils;