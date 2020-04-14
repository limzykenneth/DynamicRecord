const testSchema = Object.freeze(require("../random_table.schema.json"));

let utils = {};

utils.dropTestTable = async function(connect){
	const connection = await connect;
	await connection.execute("DROP TABLE ?", [testSchema.$id]);
	await connection.execute("DROP TABLE _schema");
	await connection.execute("DROP TABLE test_table");
};

module.exports = utils;