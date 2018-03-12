const Migration = require("../migrations.js");

let DropTable = new Migration({
	change: {
		dropTable: function(t){
			t.dbName("test_migration");
		}
	}
});

module.exports = DropTable;