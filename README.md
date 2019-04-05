# Dynamic Record (Working Title)

### A bare minimum Javascript implementation of the Active Record pattern

Dynamic Record is a database abstraction package for node.js that is inspired by Ruby on Rails' ActiveRecord. We aim to support most major database systems including MongoDB, MySQL, PostgreSQL and many more.

**Note**: Dynamic Record is currently in early Alpha and should not be considered production ready.

---

## Usage
Although the API is more or less as how we wanted it to be, changes can still occur, so for now to find out about how to use Dynamic Record, please see the inline documentations and tests for examples.

---

## Notes
`_schema` metadatabse uses json-schema and each entry is a json-schema object. In RMDB they will be saved as string, with the `$id` duplicated as a separate unique index column for fast querying (reasoning: the whole json-schema structure has no reason to be queried separately and `properties` can be some times very deeply nested).

A table storing the schemas will be created that will be used internally (in both NoSQL and RMDB).

More to come...