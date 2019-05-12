#!/usr/bin/env node

const fs = require("fs").promises;
const program = require("commander");
const inquirer = require("inquirer");
const _ = require("lodash");

const pjson = require("../package.json");
const initMongodb = require("./init/mongodb.js");

// An enums of all supported database type
const databaseEnums = Object.freeze({
	mongodb: Symbol("mongodb")
});

// Regex used to detect database type
// const databaseRegex = /^(.+?):\/\/(.+?)(?::(\d+?)?)?$/i;
const databaseRegex = /^(.+?):\/\/(.+?)$/i;

const response = {};
const questions = [];

program.version(pjson.version);
program.usage("[command] [options]");

program.command("init")
	.option("-s, --server <server address>", "URL that points to where the database server is (example: mongodb://localhost:27017)")
	.option("-u, --username <username>", "Username of the database server's user, user must have read write access to the database it will be accessing")
	.option("-p, --password <password>", "Password of the database server's user")
	.option("-d, --database <database name>", "Name of the database to use")
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

		inquirer.prompt(questions).then((answer) => {
			_.assign(response, answer);

			// Identify the database type
			const regexResult = databaseRegex.exec(response.server);
			if(regexResult === null){
				throw new Error(`Invalid database server URL: ${response.server}`);
			}else{
				response.databaseType = databaseEnums[regexResult[1]];
				response.serverPath = regexResult[2];
				if(typeof response.databaseType === "undefined"){
					return Promise.reject(new Error(`Database type "${regexResult[1]}" is not supported.`));
				}
			}

			// Create .env file if needed
			if(response.env){
				if(response.databaseType === databaseEnums.mongodb){
					const data = `mongo_server=${response.serverPath}\nmongo_db_name=${response.database}\nmongo_user=${response.username}\nmongo_pass=${response.password}`;
					fs.writeFile("./.env", data).then(() => {
						console.log("Written .env file");
					});
				}
			}

			// Initialize database
			if(response.databaseType === databaseEnums.mongodb){
				return initMongodb(response);
			}

		}).catch((err) => {
			console.error(err);
		});
	});

program.command("migrate")
	.action(function(cmd){
		console.log("Migration implementation pending");
	});

program.parse(process.argv);
