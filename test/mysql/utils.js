const testSchema = Object.freeze(require("../random_table.schema.json"));

let utils = {};

utils.dropTestTable = async function(connect){
	await connect.execute("DROP TABLE ?", [testSchema.$id]);
	await connect.execute("DROP TABLE _schema");
	await connect.execute("DROP TABLE test_table");
};

module.exports = utils;