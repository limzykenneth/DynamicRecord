// An enums of all supported database type
const mongoDBSymbol = Symbol("mongodb");
const databaseEnums = Object.freeze({
	mongodb: mongoDBSymbol,
	"mongodb+srv": mongoDBSymbol,
	mysql: Symbol("mysql")
});

// Regex used to detect database type
// const databaseRegex = /^(.+?):\/\/(.+?)(?::(\d+?)?)?$/i;
const databaseRegex = /^(?<schema>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;

module.exports = {
	databaseEnums,
	databaseRegex
};