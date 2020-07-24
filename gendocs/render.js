const Handlebars = require("Handlebars");
const marked = require("marked");
const fs = require("fs");
const fsp = fs.promises;
const _ = require("lodash");
const glob = require("glob");
const path = require("path");
const pjson = require("../package.json");

Handlebars.registerHelper("markdown", (content) => {
	return new Handlebars.SafeString(marked(content));
});

Handlebars.registerHelper("ifNotEmpty", (context, options) => {
	if(!_.isEmpty(context)){
		return options.fn(context);
	}else{
		return "";
	}
});

Handlebars.registerHelper("ifEquals", function(a, b, options) {
	if (a == b) {
		return options.fn(this);
	} else {
		return options.inverse(this);
	}
});

Handlebars.registerHelper("JSONStringify", (context, options) => {
	return JSON.stringify(context);
});

// Register all in partials folder as partials
glob("./templates/partials/*.@(handlebars|hbs)", (err, files) => {
	if(err) throw err;

	files.forEach(async (file) => {
		const templateString = fs.readFileSync(file, {encoding: "utf8"});
		const template = Handlebars.compile(templateString);
		Handlebars.registerPartial(path.basename(file, path.extname(file)), template);
	});
});

function renderPage(page, data){
	const templateString = fs.readFileSync(`./templates/pages/${page}.handlebars`, {encoding: "utf8"});
	const template = Handlebars.compile(templateString);

	return template(data);
}

module.exports = async function(data){
	const templateString = await fsp.readFile("./templates/layout.handlebars", {encoding: "utf8"});
	const template = Handlebars.compile(templateString);
	const readme = await fsp.readFile("../README.md", {encoding: "utf8"});

	const page = renderPage("index", {
		data: data,
		readme: readme
	});

	const result = template({
		title: "DynamicRecord",
		version: pjson.version,
		body: page,
		data: data
	});

	await fsp.mkdir("../docs", {recursive: true});
	await Promise.all([
		fsp.writeFile("../docs/index.html", result),
		fsp.copyFile("./assets/style.css", "../docs/style.css")
	]);

	// Render individual pages
	_.each(data.classes, async (cls, name) => {
		const page = renderPage("item", {
			data: cls
		});

		const result = template({
			title: "DynamicRecord",
			version: pjson.version,
			body: page,
			data: data,
			selected: name
		});

		await fsp.writeFile(`../docs/${name}.html`, result);
	});

	_.each(data.globals, (glb) => {

	});
};