const MongoClient = require("mongodb").MongoClient;
const fs = require("fs").promises;
const _ = require("lodash");

module.exports = async function(response){
	const connect = MongoClient.connect(response.url, {useUnifiedTopology: true});
	const client = await connect;
	const db = client.db();

	const fileText = await fs.readFile(response.input, {encoding: "utf8"});
	let {schemas, tables} = JSON.parse(fileText);
	const tableNames = _.keys(tables);

	// 1. Check for existing conflicting collections
	const collectionList = await db.listCollections({}, {nameOnly: true}).toArray();
	_.each(collectionList, (collection) => {
		if(_.includes(tableNames, collection.name)){
			console.error(`Table with name "${collection.name}" already exist. Aborting.`);
			process.exit(1);
		}
	});

	// 2. Check for conflicting _counters entry
	const countersList = await db.collection("_counters").find().toArray();
	_.each(countersList, (counter) => {
		if(_.includes(tableNames, counter._$id)){
			console.error(`Counter for table "${counter._$id}" already exist. Aborting.`);
			process.exit(1);
		}
	});

	// 3. Replace schema fields mongodb doesn't like
	schemas = _.map(schemas, (schema) => {
		schema._$id = schema.$id;
		schema._$schema = schema.$schema;
		delete schema.$id;
		delete schema.$schema;

		return schema;
	});

	const schemaCol = await db.createCollection("_schema");
	// Create unique index for "_schema" collection
	await schemaCol.createIndex("_$id", {unique: true});

	// 4. Try to insert schemas, exit without changing anything if conflicting index found
	try {
		await schemaCol.insertMany(schemas);
	} catch(e) {
		// Duplicate key error
		if(e.code === 11000){
			console.error("There are existing entries in the database with name that conflicts with the schema being inserted. Aborting.");
			process.exit(1);
		}
	}

	// 5. Create the remaining collections
	for(const tableName of tableNames){
		const collection = await db.createCollection(tableName);

		// Create relevant indexes
		const s = _.find(schemas, (schema) => {
			return schema._$id === tableName;
		});

		for(const f in s.properties){
			if(s.properties[f].isAutoIncrement) s.properties[f].isUnique = true;

			if(s.properties[f].isAutoIncrement || s.properties[f].isIndex){
				await collection.createIndex(f, {unique: s.properties[f].isUnique || false});
			}
		}

		await collection.insertMany(tables[tableName]);
	}

	// 6. Create _counters collection
	const countersCol = await db.createCollection("_counters");
	for(const schema of schemas){
		await countersCol.insertOne({
			_$id: schema._$id,
			sequences: {}
		});

		for(const columnLabel in schema.properties){
			if(schema.properties[columnLabel].isAutoIncrement){
				const sequenceKey = `sequences.${columnLabel}`;
				const allSequences = _.map(tables[schema._$id], (entry) => {
					return entry[columnLabel];
				});
				allSequences.push(0);
				let newSequence = _.max(allSequences);

				await countersCol.findOneAndUpdate({_$id: schema._$id}, {
					$set: {
						[sequenceKey]: newSequence
					}
				});
			}
		}
	}

	console.log("Import successful!");

	// Close connection
	client.close();
};