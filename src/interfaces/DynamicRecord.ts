export interface QueryOptions {
	sort?: Sort,
	limit?: number,
	offset?: number
}

interface Sort {
	[key: string]: string
}