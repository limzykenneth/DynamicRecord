require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool(process.env.database_host);
pool.execute(`CREATE TABLE random_table ($id VARCHAR(32), num INT, INDEX ($id), UNIQUE KEY (num))`).then(([results]) => {
	console.log(results);
	pool.end();
}).catch((err) => {
	console.log("Error");
	console.log(err);
	pool.end();
});