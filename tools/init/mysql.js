const mysql = require("mysql2/promise");

module.exports = async function(response){
	const connection = await mysql.createConnection(response.url);

	await connection.execute("CREATE TABLE _schema ($id VARCHAR(32), jsonschema MEDIUMTEXT, INDEX ($id))");
	connection.destroy();
};