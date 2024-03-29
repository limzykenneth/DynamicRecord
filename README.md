# Dynamic Record

### A bare minimum Javascript implementation of the Active Record pattern

[![Build Status](https://travis-ci.com/limzykenneth/DynamicRecord.svg?branch=master)](https://travis-ci.com/limzykenneth/DynamicRecord)

Dynamic Record is a database abstraction package for node.js that is inspired by Ruby on Rails' ActiveRecord for node.js. We aim to support most major database systems including MongoDB, MySQL, PostgreSQL and many more. **For the moment there is only support for MongoDB**

**Note**: Dynamic Record is currently in Beta and should not be considered production ready.

## Installation

1. Run `npm install dynamic-record`
2. Ensure you have your database running and you have the appropriate credentials to be used with the app. (You will need read/write permissions)
3. Run the initialization script with `npx dynamic-record init`.
4. Follow the steps in the wizard and everything will be setup correctly for you. Or you can run `npx dynamic-record init` by providing flags and arguments that can be found using `npx dynamic-record init --help`.

## Usage
Although the API is more or less as how we wanted it to be, changes can still occur. Documentation of the API is available at [https://dynamic-record.js.org/](https://dynamic-record.js.org/)

A database initialized with the included `dynamic-record` tool is enough to get started with a user that has `readWrite` access.

Next we look at Dynamic Record in a bit more detail. Dynamic Record is split into three main parts:
* [`DynamicSchema`](#dynamicschema)
* [`DynamicRecord`](#dynamicrecord)
    * [`DynamicRecord.Model`](#dynamicrecordmodel)
* [`DynamicCollection`](#dynamiccollection)

Before diving into the individual parts, we need to explain a few concepts.

First is that for each table (or collection if you are using MongoDB) in your database, you will create an instance of [`DynamicRecord`](#dynamicrecord) and it will be responsible for handling all read write operations to the database.

Next is the idea of models and collections. If you have used an MVC framework such as Backbone before, you will be familiar with this concept. We are borrowing quite directly from the concept in Backbone where models are wrapped data objects and collections are an array-like object that contains multiple entries of models. This corresponds to [`DynamicRecord.Model`](#dynamicrecordmodel) and [`DynamicCollection`](#dynamiccollection) respectively. These instances handle write operations to the database.

Finally for each table in the database they will have their own schema defined with [JSON Schema](https://json-schema.org/). They will be saved in a table named `_schema` and will mainly be used for validation and in the case of NoSQL database, schema definition. They are mainly accessed by [`DynamicSchema`](#dynamicschema) instances.


---
#### **Database connection**
We will need to create a database connection that can be passed to create DynamicRecord instances. These database connection can be reused across multiple instances of DynamicRecord, DynamicSchema, or DynamicCollection objects. You can also create multiple database connection each connecting to a different database server and instantiate DynamicRecord objects with them.
```javascript
const connection = require("dynamic-record").createConnection(database_url);
```

#### **`DynamicSchema`**
Before creating any entries in the database with Dynamic Record, you will first need to define the tables that are going to be used.

In your app, you can create an instance of `DynamicSchema` as follow.
```javascript
const createSchemaInstance = require("dynamic-record").createSchemaInstance;
const mySchema = createSchemaInstance(connection);
```

This will create an empty instance of `DynamicSchema` but it will do nothing else. To create a table in the database with a set schema, call `createTable()` on the instance and provide to it a parameter in the form of a [JSON Schema](https://json-schema.org/) object.

```javascript
const monarchSchema = require("./monarch.schema.json");

monarchSchema.createTable(monarchSchema).then(() => {
	// Schema created in database
});
```

#### **`DynamicRecord`**
This is the main entry point to the ORM. You can initialize an instance of `DynamicRecord` with the following snippet.

```javascript
const createInstance = require("dynamic-record").createInstance;

const myTable = createInstance(connection, "myTableSlug");
```

With the created instance you can fetch a particular entry from the database by providing a query object to match with `findBy()`.

```javascript
myTable.findBy({name: "Henry V"}).then((entry) => {
	console.log(entry.data);
});
```

#### **`DynamicRecord.Model`**
`DynamicRecord.Model` is a wrapper for the objects returned by any query function under [`DynamicRecord`](#dynamicrecord), it is also used to create new models to be inserted into the database. To create a new instance of `DynamicRecord.Model` use the following snippet.

```javascript
const createInstance = require("dynamic-record").createInstance;
const myTable = createInstance(connection, "myTableSlug");

const newKing = new myTable.Model({
	name: "Henry VI",
	house: "York",
	coronation: "6 November 1429"
});
```

At this point although the instance is created and populated with data, it is not saved into the database yet. You can still modify it further by manipulating the `data` property of the instance.

```javascript
newKing.data.house = "Lancaster";
```

When you are ready to save the model into the database, simply call `save()` on the instance.

```javascript
newKing.save().then(() => {
	// Model saved
});
```

#### **`DynamicCollection`**
`DynamicCollection` is usually returned by query functions of a `DynamicRecord` instance that returns more than one entry such as `where()`. You can also create your own `DynamicCollection` instance for easy manipulation of a series of models.

```javascript
const createCollection = require("dynamic-record").createCollection;

const myCollection = createCollection(connection, Model, ...data);
```

`DynamicCollection` extends the native Javascript Array object and thus inherits all of the array functions including `push()`, `forEach()` and `map()`. The difference is that you should only store `DynamicRecord.Model` instances in a `DynamicCollection`.

`DynamicCollection` has a property called `data` that will return all the models' data objects in a native Javascript array.

After modifying the models on the `DynamicCollection` instance and you want to save all the changes into the database, instead of calling `save()` on each of the models individually, you can call `saveAll()` on the `DynamicCollection` instance.

```javascript
myCollection.saveAll().then(() => {
	// All models in collection saved to database
});
```

## Development

1. Clone the repo locally
2. Run `npm install`
3. To build the library, run `npm run build`
4. To run the test:
	1. Make sure you have a database server running and a database already setup with the right user permission.
	2. You can use the CLI tool manually with `node tools/cli.js init` to set up the environment as documented [above](#installation).
	3. Set the following value in a `.env` file in the root of the project, adapting value as appropriate. Note this is only needed for automated tests of this repo.

	```
	database_host=mongodb://test_user:test_password@localhost:27017/dynamic_record
	```

5. Run `npm test`
6. To build the documentation, run `npm run docs` (test must be setup)

## License
[BSD 2-Clause](https://github.com/limzykenneth/DynamicRecord/blob/master/LICENSE)
