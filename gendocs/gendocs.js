const bluebird = require("bluebird");
const parse = bluebird.promisifyAll(require("comment-parser"));
const glob = require("glob");
const fs = require("fs").promises;
const path = require("path");
const _ = require("lodash");
const rootPath = path.join(__dirname, "..");

glob(path.join(__dirname, "../src/**/*.ts"), async (err, files) => {
// glob(path.join(__dirname, "../src/+(DynamicCollection|DynamicSchema).ts"), async (err, files) => {
	const result = {};
	const promises = [];

	files.forEach((file) => {
		promises.push(
			parse.fileAsync(file, {
				join: true
			}).then((data) => {
				if(data.length > 0){
					result[path.relative(rootPath, file)] = processData(data);
				}
			})
		);
	});

	await Promise.all(promises);

	fs.writeFile(path.join(__dirname, "./data.json"), JSON.stringify(result, null, 2));
});

function processData(data){
	const ret = [];

	data.forEach((entry) => {
		const newEntry = {};
		// Replace line breaks with space
		entry.description = entry.description.replace(/\b\n\b/gm, " ");

		entry.tags.forEach((tag) => {
			tag.description = tag.description.replace(/\b\n\b/gm, " ");
		});


		// Determine type of entry
		// - class
		// - method
		// - property
		if(getTag(entry, ["class", "constructor"])){
			newEntry.itemType = "class";

		}else if(getTag(entry, "method")){
			newEntry.itemType = "method";
		}else{
			newEntry.itemType = "property";
		}

		// Get name, line, and source
		newEntry.name = getTag(entry, ["name", "method"]).name;
		newEntry.line = entry.line;
		newEntry.source = entry.source;

		// Get descriptions
		newEntry.description = entry.description || "";

		// Process by itemType
		if(newEntry.itemType === "class"){
			// Get return
			newEntry.return = {
				type: newEntry.name,
				description: getTag(entry, "return")?.description || ""
			};

			// Get parameters
			newEntry.params = [];
			getTags(entry, "param").forEach((param) => {
				newEntry.params.push({
					type: param.type,
					name: param.name,
					description: param.description,
					optional: param.optional
				});
			});

			// Get extends
			newEntry.extends = getTag(entry, "extends")?.name || "";

		}else if(newEntry.itemType === "method"){
			// Get return
			if(getTag(entry, "return")){
				newEntry.return = {
					type: getTag(entry, "return").type,
					description: getTag(entry, "return").description
				};
			}

			// Get parameters
			newEntry.params = [];
			getTags(entry, "param").forEach((param) => {
				newEntry.params.push({
					type: param.type,
					name: param.name,
					description: param.description,
					optional: param.optional
				});
			});

			// Get static
			newEntry.static = getTag(entry, "static") ? true : false;

			if(newEntry.static !== true){
				// Get private
				newEntry.private = getTag(entry, "private") ? true : false;

				// Get memberOf
				newEntry.memberOf = getTag(entry, "memberOf")?.name || entry.name;
			}

		}else if(newEntry.itemType === "property"){
			newEntry.type = getTag(entry, "type").name || "any";

			// Get static
			newEntry.static = getTag(entry, "static") ? true : false;

			if(newEntry.static !== true){
				// Get private
				newEntry.private = getTag(entry, "private") ? true : false;

				// Get memberOf
				newEntry.memberOf = getTag(entry, "memberOf")?.name;
			}
		}

		// General
		if(getTag(entry, "hidden")){
			newEntry.hidden = true;
		}

		ret.push(newEntry);

		function getTag(entry, t){
			if(Array.isArray(t)){
				let result = false;

				return _.find(entry.tags, (tag) => {
					for(const e of t){
						if(tag.tag === e){
							return true;
						}
					}

					return false;
				});
			}else{
				return _.find(entry.tags, (tag) => {
					return tag.tag === t;
				});
			}
		}

		function getTags(entry, t){
			if(Array.isArray(t)){
				let result = false;

				return _.filter(entry.tags, (tag) => {
					for(const e of t){
						if(tag.tag === e){
							return true;
						}
					}

					return false;
				});
			}else{
				return _.filter(entry.tags, (tag) => {
					return tag.tag === t;
				});
			}
		}
	});

	return ret;
}