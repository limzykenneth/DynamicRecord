const MongoClient = require("mongodb").MongoClient;
const fs = require("fs").promises;
const _ = require("lodash");

module.exports = async function(url, output){
	const connect = MongoClient.connect(url, {
		useUnifiedTopology: true,
		useNewUrlParser: true
	});
	const client = await connect;
	const db = client.db();

	let exportedData = {
		tables: {}
	};

	// 1. Get JSON Schema of tables saved in database
	const col = await db.collection("_schema").find({}).toArray();
	_.each(col, (m) => {
		m.$id = m._$id;
		m.$schema = m._$schema;

		delete m._$id;
		delete m._$schema;
		delete m._id;
	});
	exportedData.schemas = col;

	// 2. Get counters current settings (required?)

	// 3. Get exported data of individual tables
	for(let i=0; i<col.length; i++){
		const result = await db.collection(col[i].$id).find().toArray();

		exportedData.tables[col[i].$id] = _.map(result, (m) => {
			delete m._id;
			return m;
		});
	}

	// 4. Save all data in one JSON file
	await fs.writeFile(output, JSON.stringify(exportedData, null, 2));

	client.close();
};