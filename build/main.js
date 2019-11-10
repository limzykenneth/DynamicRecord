require("dotenv").config();
let DynamicRecord;
switch (process.env.database_provider) {
    case "mongodb":
        DynamicRecord = require("./DynamicRecord.js");
        break;
    default:
        throw new Error("Environment not set up correctly");
}
module.exports = DynamicRecord;
