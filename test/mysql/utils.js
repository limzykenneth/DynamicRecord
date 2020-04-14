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

module.exports = utils;