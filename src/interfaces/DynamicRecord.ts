export interface QueryOptions {
	sort?: Sort,
	limit?: number,
	offset?: number
}

interface Sort {
	[key: string]: string
}

export interface DataObject extends Object {}

export interface MongoDBObject extends DataObject {
	_id: string
}