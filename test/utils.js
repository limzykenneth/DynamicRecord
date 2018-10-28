let utils = function(connect){
	this.connect = connect;
};

utils.prototype.dropTestTable = function(cb){
	this.connect.then((db) => {
		return db.collection("random_table").drop().then(() => {
			return Promise.resolve(db);
		}).catch((err) => {
			if(err.message == "ns not found"){
				return Promise.resolve(db);
			}else{
				console.error(err);
			}
		});
	}).then((db) => {
		db.collection("_counters").drop().then(cb).catch((err) => {
			if(err.message == "ns not found"){
				cb();
			}else{
				console.error(err);
			}
		});
	});
};

module.exports = utils;