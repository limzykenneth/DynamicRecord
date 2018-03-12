const ActiveRecord = require("../index.js");
const assert = require("chai").assert;

let Random = new ActiveRecord("random_table");

describe("Schema", function(){
	it("should exist", function(){
		assert.isDefined(Random);
	});
});

