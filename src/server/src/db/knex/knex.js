require('dotenv').config();

const environment = process.env.ENVIRONMENT || 'development';
const config = require('../../../knexfile.js')[environment];
const { knex } = require('knex');

// add a custom knex extension for ordering our results randomly
knex.QueryBuilder.extend('orderByRandom', function (values) {
	try {
		// return the correct ORDER BY RANDOM()/RAND() syntax for the DB
		return this.orderByRaw(config.randomSyntax);
	} catch (err) {
		return console.log(err);
	}
});

module.exports = knex(config);
