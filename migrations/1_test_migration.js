const Migration = require("../migrations.js");

let TestMigration = new Migration({
	change: {
		createTable: function(){
			this.dbName("test_migration");

			this.string("name");
			this.text("description");
			this.timestamps();
		}
	}
});

console.log(TestMigration);
TestMigration.commit();

module.exports = TestMigration;