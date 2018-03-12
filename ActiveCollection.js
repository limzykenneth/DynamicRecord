var _ = require("lodash");

class ActiveCollection extends Array{
	init(){
		this.data = [];
		_.each(this, (el, i) => {
			this.data.push(el.data);
		});
	}
}

module.exports = ActiveCollection;