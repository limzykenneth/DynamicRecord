// An enums of all supported database type
const databaseEnums = Object.freeze({
	mongodb: Symbol("mongodb")
});

// Regex used to detect database type
// const databaseRegex = /^(.+?):\/\/(.+?)(?::(\d+?)?)?$/i;
const databaseRegex = /^(.+?):\/\/(.+?)$/i;

module.exports = {
	databaseEnums,
	databaseRegex
};