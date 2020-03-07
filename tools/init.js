const fs = require("fs").promises;
const inquirer = require("inquirer");
const _ = require("lodash");

const constants = require("./_constants.js");
const initMongodb = require("./init/mongodb.js");

function init(program){
	const response = {};
	const questions = [];

	program.command("init")
		.option("-s, --server <server address>", "URL that points to where the database server is (example: mongodb://localhost:27017)")
		.option("-u, --username <username>", "Username of the database server's user, user must have read write access to the database it will be accessing")
		.option("-p, --password <password>", "Password of the database server's user")
		.option("-d, --database <database name>", "Name of the database to use")
		.option("--preview", "Dry run tasks without writing anything to file or database")
		.option("-e, --env", "Create .env file", false)
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
					validate: function(value){
						return value.length > 0 ? true : "Username cannot be blank";
					}
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
					validate: function(value){
						return value.length > 0 ? true : "Database name cannot be blank";
					}
				});
			}else{
				response.database = cmd.database;
			}

			if(typeof cmd.env === "undefined"){
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
				if(regexResult === null){
					throw new Error(`Invalid database server URL: ${response.server}`);
				}else{
					response.url = `${regexResult.groups.schema}://${regexResult.groups.username || response.username}:${regexResult.groups.password || response.password}@${regexResult.groups.host}:${regexResult.groups.port || "27017"}/${regexResult.groups.database || response.database}`;
					response.databaseType = constants.databaseEnums[regexResult.groups.schema];
				}

				// Create .env file if needed
				if(response.env){
					if(response.databaseType === constants.databaseEnums.mongodb){
						const data = `database_host=${response.url}`;
						console.log("Writing to .env:\n" + data);
						if(!cmd.preview){
							fs.writeFile("./.env", data).then(() => {
								console.log("Written .env file");
							});
						}
					}
				}

				// Initialize database
				if(response.databaseType === constants.databaseEnums.mongodb){
					if(!cmd.preview){
						return initMongodb(response).then(() => {
							console.log(`Initialized mongodb database ${response.database}`);
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