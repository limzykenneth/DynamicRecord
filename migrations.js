const _ = require("lodash");
const ActiveRecord = require("./index.js");

let Migration = function(d){
	this.name = "";
	this.definition = [];

	if(d.change){
		let c = d.change;
		c.createTable.call(this);
	}
};

Migration.prototype.dbName = function(name){
	this.name = name;
};

Migration.prototype.string = function(name){
	this.definition.push({
		label: name,
		type: "string"
	});
};

Migration.prototype.text = function(name){
	this.definition.push({
		label: name,
		type: "text"
	});
};

Migration.prototype.int = function(name){
	this.definition.push({
		label: name,
		type: "int"
	});
};

Migration.prototype.timestamps = function(){

};

// Commit changes and create/update the schema
Migration.prototype.commit = function(){

};

module.exports = Migration;