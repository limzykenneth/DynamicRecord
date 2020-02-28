#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs").promises;
const program = require("commander");
const inquirer = require("inquirer");
const _ = require("lodash");

const pjson = require("../package.json");
const initMongodb = require("./init/mongodb.js");
const constants = require("./_constants.js");

// CLI Tools
const init = require("./init.js");
const exp = require("./export.js");

const response = {};
const questions = [];

program.version(pjson.version);
program.usage("[command] [options]");

// Initialization tool
init(program);

// Export tool
exp(program);

program.command("migrate")
	.action(function(cmd){
		console.log("Migration implementation pending");
	});

program.command("import")
	.action(function(cmd){
		console.log("Import implementation pending");
	});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
	program.outputHelp();
}