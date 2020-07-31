// You can either provide database information
// Or it can be set in evironment variables with .env or in command line
// Or it will be asked for as input

const inquirer = require("inquirer");
const _ = require("lodash");

const importMongodb = require("./import/mongodb.js");
const constants = require("./_constants.js");

function cli(program){
	const response = {};
	const questions = [];

	program.command("import")
		.option("-s, --server <server address>", "URL that points to where the database server is (example: mongodb://localhost:27017)")
		.option("-u, --username <username>", "Username of the database server's user, user must have read write access to the database it will be accessing")
		.option("-p, --password <password>", "Password of the database server's user")
		.option("-d, --database <database name>", "Name of the database to use")
		.option("-i, --input <file>", "Input file containing exported data")
		.option("--preview", "Dry run tasks without writing anything to file or database", false)
		.action(async function(cmd){
			if(typeof cmd.server !== "undefined"){
				response.server = cmd.server;
			}else if(process.env.database_host){
				response.server = process.env.database_host;
			}else{
				questions.push({
					type: "input",
					name: "server",
					message: "Server address",
					validate: function(value){
						return value.trim().length > 0 ? true : "Server address cannot be blank";
					}
				});
			}

			if(typeof cmd.username !== "undefined"){
				response.username = cmd.username;
			}else if(process.env.database_username){
				response.username = process.env.database_username;
			}else{
				questions.push({
					type: "input",
					name: "username",
					message: "Username",
					default: ""
				});
			}

			if(typeof cmd.password !== "undefined"){
				response.password = cmd.password;
			}else if(process.env.database_password){
				response.password = process.env.database_password;
			}else{
				questions.push({
					type: "password",
					name: "password",
					message: "Password",
					default: ""
				});
			}

			if(typeof cmd.database !== "undefined"){
				response.database = cmd.database;
			}else if(process.env.database_name){
				response.database = process.env.database_name;
			}else{
				questions.push({
					type: "input",
					name: "database",
					message: "Database",
					default: ""
				});
			}

			if(typeof cmd.input !== "undefined"){
				response.input = cmd.input;
			}else{
				questions.push({
					type: "input",
					name: "input",
					message: "Input path",
					validate: function(value){
						return value.trim().length > 0 ? true : "Input path cannot be blank";
					}
				});
			}

			// Use Inquirer to ask for missing info
			let answer = await inquirer.prompt(questions);
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
				response.url = `${schema}://${username}:${password}@${host}${port}/${database}?${regexResult.groups.options || ""}`;
				response.databaseType = constants.databaseEnums[regexResult.groups.schema];
			}else{
				throw new Error(`Invalid database server URL: ${schema}://${username}:${password}@${host}${port}/${database}?${regexResult.groups.options || ""}`);
			}

			try{
				await imp(response.url, response.input, cmd.preview);
			}catch(err){
				console.error(err);
			}
		});
}

async function imp(url, input, isPreview=false){
	const {schema, database} = url.match(constants.databaseRegex).groups;
	const databaseType = constants.databaseEnums[schema];

	// Import the database
	if(!isPreview && databaseType === constants.databaseEnums.mongodb){
		importMongodb(url, input);
	}
}

module.exports = {
	cli,
	import: imp
};