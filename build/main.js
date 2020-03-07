require("dotenv").config();
const databaseURIRegex = /^(?<schema>.+?):\/\/(?:(?<username>.+?)(?::(?<password>.+))?@)?(?<host>.+?)(?::(?<port>\d+?))?(?:\/(?<database>.+?))?(?:\?(?<options>.+?))?$/;
const regexResult = process.env.database_host.match(databaseURIRegex);
let DynamicRecord;
switch (regexResult.groups.schema) {
    case "mongodb":
        DynamicRecord = require("./DynamicRecord.js");
        break;
    default:
        throw new Error("Environment not set up correctly");
}
module.exports = DynamicRecord;
