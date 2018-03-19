var _ = require("lodash");

class ActiveCollection extends Array{
	get data(){
		let result = [];
		_.each(this, (el, i) => {
			result.push(el.data);
		});
		return result;
	}
}

module.exports = ActiveCollection;