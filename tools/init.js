const fs = require("fs").promises;
const inquirer = require("inquirer");
const _ = require("lodash");

const constants = require("./_constants.js");
const initMongodb = require("./init/mongodb.js");
const initMySQL = require("./init/mysql.js");

function cli(program){
	const response = {};
	const questions = [];

	program.command("init")
		.option("-s, --server <server address>", "URL that points to where the database server is (example: mongodb://localhost:27017)")
		.option("-u, --username <username>", "Username of the database server's user, user must have read write access to the database it will be accessing")
		.option("-p, --password <password>", "Password of the database server's user")
		.option("-d, --database <database name>", "Name of the database to use")
		.option("--preview", "Dry run tasks without writing anything to file or database", false)
		.action(async function(cmd){
			if(typeof cmd.server === "undefined"){
				questions.push({
					type: "input",
					name: "server",
					message: "Server address",
					validate: function(value){
						return value.trim().length > 0 ? true : "Server address cannot be blank";
					},
					filter: function(value){
						return value.trim();
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
						return value.trim().length > 0 ? true : "Username cannot be blank";
					},
					filter: function(value){
						return value.trim();
					},
					when: function(hash){
						return _.isEmpty(constants.databaseRegex.exec(hash.server).groups.username);
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
					default: "",
					when: function(hash){
						return _.isEmpty(constants.databaseRegex.exec(hash.server).groups.password);
					}
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
						return value.trim().length > 0 ? true : "Database name cannot be blank";
					},
					filter: function(value){
						return value.trim();
					},
					when: function(hash){
						return _.isEmpty(constants.databaseRegex.exec(hash.server).groups.database);
					}
				});
			}else{
				response.database = cmd.database;
			}

			// Use Inquirer to ask for missing info
			const answer = await inquirer.prompt(questions);

			// Copy answers from inquirer into response object
			_.assign(response, answer);

			try{
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
					response.url = `${schema}://${username}:${password}@${host}${port}/${database}?${regexResult.groups.options || ""}`;
				}else{
					throw new Error(`Invalid database server URL: ${schema}://${username}:${password}@${host}${port}/${database}?${regexResult.groups.options || ""}`);
				}

				await init(response.url, cmd.preview);
			}catch(err){
				console.error(err);
			}
		});
}

async function init(url, isPreview=false, quiet=false){
	const {schema, database} = url.match(constants.databaseRegex).groups;
	const databaseType = constants.databaseEnums[schema];

	// Initialize database
	if(databaseType === constants.databaseEnums.mongodb){
		if(!isPreview){
			return initMongodb(url).then(() => {
				if(!quiet) console.log(`Initialized mongodb database ${database}`);
				return Promise.resolve();
			});
		}
	}else if(databaseType === constants.databaseEnums.mysql){
		if(!isPreview){
			return initMySQL(url).then(() => {
				if(!quiet) console.log(`Initialized mysql database ${database}`);
				return Promise.resolve();
			});
		}
	}else{
		throw new Error("Unsupported database type");
	}
}

module.exports = {
	cli,
	init
};