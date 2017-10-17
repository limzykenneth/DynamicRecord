const ActiveRecord = require("./index.js");

// Tests ------------------------------------------------
var Random = new ActiveRecord("random_table");

var item1 = new Random.Model({"test_string_1": "Lorem ipsum."});
var item2 = new Random.Model({"test_string_1": "Ad ad."});
var item3 = new Random.Model({"test_string_1": "Ad ad."});

var promises = [
	item1.save(),
	item2.save(),
	item3.save()
];

Promise.all(promises).then(function(){
	Random.findBy({"test_string_1": "Lorem ipsum."}).then(function(item){
		console.log(item);
		item.data.test_string_1 = "Duis officia.";
		item.save().then(function(){
			console.log(item);

			Random.where({"test_string_1": "Duis officia."}).then(function(items){
				console.log(items);

				items[0].destroy().then(function(){
					Random.findBy({"test_string_1": "Duis officia."}).then(function(r){
						console.log(r);
					});
				});
			});
		});
	});
}).catch((err) => {
	console.log(err);
});