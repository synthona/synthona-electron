const path = require('path');
// handle case for sequelize CLI
require('dotenv').config();
global.__coreDataDir = process.env.CORE_DATA_DIRECTORY;
// set dbPath
const dbPath = path.join(__coreDataDir, 'database.sqlite3');
const migrationPath = path.join(__dirname, 'src/db/knex/migrations');

/**
 * this is our core knex configuration
 */

module.exports = {
	development: {
		client: 'sqlite3',
		randomSyntax: 'RANDOM()',
		connection: {
			filename: dbPath,
		},
		migrations: {
			tableName: 'knex_migrations',
			directory: migrationPath,
		},
		useNullAsDefault: true,
	},
	// staging: {
	// 	client: 'sqlite3',
	// randomSyntax: 'RANDOM()',
	// 	connection: {
	// 		filename: sqliteDbPath,
	// 	},
	// 	migrations: {
	// 		tableName: 'knex_migrations',
	// 	},
	// },
	// production: {
	// 	client: 'sqlite3',
	// randomSyntax: 'RANDOM()',
	// 	connection: {
	// 		filename: sqliteDbPath,
	// 	},
	// 	migrations: {
	// 		tableName: 'knex_migrations',
	// 	},
	// },
};
