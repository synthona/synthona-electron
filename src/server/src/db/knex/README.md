# Synthona & Knex.js
*this document is intended to offer a quick reference guide for working on synthona database development with knex*

- the intention here is that we will document processes for creating migrations, running migrations, updating schemas, and more
- there ARE specific patterns unique to synthona, which is part of the purpose behind this documentation 
- for more in-depth information about knex in a general sense, check out the [official knex.js documentation](https://knexjs.org/guide/)
---
*commands need to be run inside **/synthona-electron/src/server/***

---

## Useful Commands

creating a new migration

    $ knex migrate:make migration_name

testing your next migration *(they will also be run when you start the server)*

    $ knex migrate:up

rolling back migrations during development

    $ knex migrate:down

---

## How Synthona Uses Knex.js
- knex is a query builder tool so that synthona can work with sqlite (and other database systems). Saves us some trouble by stripping out unsafe characters from queries, providing more universal query structures across different DB systems, helping to manage our migrations, and more, all without the overcomplications of something like a full ORM
- knex is loaded up is through the knex.js file
- utility functions, database initialization, and migrations are handled through setup.js in the same directory as the knex.js file


