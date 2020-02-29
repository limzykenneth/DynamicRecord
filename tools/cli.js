#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs").promises;
const program = require("commander");
const inquirer = require("inquirer");
const _ = require("lodash");

const pjson = require("../package.json");

// CLI Tools
const init = require("./init.js");
const exp = require("./export.js");
const imp = require("./import.js");

const response = {};
const questions = [];

program.version(pjson.version);
program.usage("[command] [options]");

// Initialization tool
init(program);

// Export tool
exp(program);

// Import tool
imp(program);

program.command("migrate")
	.action(function(cmd){
		console.log("Migration implementation pending");
	});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
	program.outputHelp();
}