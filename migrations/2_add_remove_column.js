const Migration = require("../migrations.js");

let AddRemoveColumn = new Migration({
	change: {
		addColumn: function(t){
			t.dbName("test_migration");
			t.columnName("user");
			t.columnType("string");
		},
		removeColumn: function(t){
			t.dbName("test_migration");
			t.columnName("description");
		}
	}
});

module.exports = AddRemoveColumn;