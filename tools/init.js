const fs = require("fs").promises;
const inquirer = require("inquirer");
const _ = require("lodash");

const constants = require("./_constants.js");
const initMongodb = require("./init/mongodb.js");
const initMySQL = require("./init/mysql.js");

function init(program){
	const response = {};
	const questions = [];

	program.command("init")
		.option("-s, --server <server address>", "URL that points to where the database server is (example: mongodb://localhost:27017)")
		.option("-u, --username <username>", "Username of the database server's user, user must have read write access to the database it will be accessing")
		.option("-p, --password <password>", "Password of the database server's user")
		.option("-d, --database <database name>", "Name of the database to use")
		.option("-e, --env", "Create .env file", false)
		.option("--preview", "Dry run tasks without writing anything to file or database", false)
		.action(function(cmd){
			if(typeof cmd.server === "undefined"){
				questions.push({
					type: "input",
					name: "server",
					message: "Server address",
					validate: function(value){
						return value.length > 0 ? true : "Server address cannot be blank";
					}
				});
			}else{
				response.server = cmd.server;
			}

			if(typeof cmd.username === "undefined"){
				questions.push({
					type: "input",
					name: "username",
					message: "Username",
					default: ""
				});
			}else{
				response.username = cmd.username;
			}

			if(typeof cmd.password === "undefined"){
				questions.push({
					type: "password",
					name: "password",
					message: "Password",
					default: ""
				});
			}else{
				response.password = cmd.password;
			}

			if(typeof cmd.database === "undefined"){
				questions.push({
					type: "input",
					name: "database",
					message: "Database",
					default: ""
				});
			}else{
				response.database = cmd.database;
			}

			if(cmd.env === false){
				response.env = false;
			}else{
				response.env = true;
			}

			// Use Inquirer to ask for missing info
			inquirer.prompt(questions).then((answer) => {
				// Copy answers from inquirer into response object
				_.assign(response, answer);

				// Identify the database type
				const regexResult = response.server.match(constants.databaseRegex);
				const schema = regexResult.groups.schema;
				const username = regexResult.groups.username || response.username;
				const password = regexResult.groups.password || response.password;
				const host = regexResult.groups.host;
				const port = regexResult.groups.port ? `:${regexResult.groups.port}` : "";
				const database = regexResult.groups.database || response.database;

				if(regexResult === null){
					throw new Error(`Invalid database server URL: ${response.server}`);
				}else if(username.length > 0 && password.length > 0 && database.length > 0){
					response.url = `${schema}://${username}:${password}@${host}${port}/${database}`;
					response.databaseType = constants.databaseEnums[regexResult.groups.schema];
				}else{
					throw new Error(`Invalid database server URL: ${schema}://${username}:${password}@${host}${port}/${database}`);
				}

				// Create .env file if needed
				if(response.env){
					const data = `database_host=${response.url}`;
					console.log("Writing to .env ... ");

					if(!cmd.preview){
						fs.appendFile("./.env", `\n${data}`).then(() => {
							console.log("Written .env file");
						});
					}
				}else{
					const data = `database_host=${response.url}`;
					console.log("Please set the following in your environment vairables:");
					console.log(data);
				}

				// Initialize database
				if(response.databaseType === constants.databaseEnums.mongodb){
					if(!cmd.preview){
						return initMongodb(response).then(() => {
							console.log(`Initialized mongodb database ${response.database}`);
							return Promise.resolve();
						});
					}
				}else if(response.databaseType === constants.databaseEnums.mysql){
					if(!cmd.preview){
						return initMySQL(response).then(() => {
							console.log(`Initialized mysql database ${response.database}`);
							return Promise.resolve();
						});
					}
				}

			}).catch((err) => {
				console.error(err);
			});
		});
}

module.exports = init;