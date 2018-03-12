const Migration = require("../migrations.js");
const ActiveRecord = require("../index.js")

let MigrationDB = new ActiveRecord("test_migration");

let AddModels = new Migration({
	up: {
		init: function(){
			var item1 = new MigrationDB.Model({
				name: "Adipisicing enim",
				user: "Id eiusmod"
			});
			var item2 = new MigrationDB.Model({
				name: "Duis laboris",
				user: "Eu non mollit"
			});

			item1.save();
			item2.save();
		}
	},
	down: {
		init: function(){
			MigrationDB.findBy({
				name: "Adipisicing enim",
				user: "Id eiusmod"
			}).then((item) => {
				item.destroy();
			});

			MigrationDB.findBy({
				name: "Duis laboris",
				user: "Eu non mollit"
			}).then((item) => {
				item.destroy();
			});
		}
	}
});

module.exports = AddModels;