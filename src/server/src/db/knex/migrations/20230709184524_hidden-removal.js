/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => {
	console.log('hidden removal migration');
	return new Promise(async (resolve, reject) => {
		try {
			// remove hidden column from node table if it exists
			if (await knex.schema.hasColumn('node', 'hidden')) {
				await knex.schema.alterTable('node', (table) => {
					table.dropColumn('hidden');
				});
				console.log('removed hidden column from node table');
			}
			// remove searchable column from node table if it exists
			if (await knex.schema.hasColumn('node', 'searchable')) {
				await knex.schema.alterTable('node', (table) => {
					table.dropColumn('searchable');
				});
				console.log('removed searchable column from node table');
			}
			// add linkStart column to association table if it does not exist
			if (!(await knex.schema.hasColumn('association', 'linkStart'))) {
				await knex.schema.alterTable('association', (table) => {
					table.integer('linkStart').nullable().comment('node (null), linkedNode (1), both (2)');
				});
				console.log('added linkStart column to association table');
			}
			console.log('hidden removal migration complete');
			resolve('hidden removal migration completed');
		} catch (err) {
			reject(err);
		}
	});
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => {
	console.log('reversing hidden removal migration');
	return new Promise(async (resolve, reject) => {
		try {
			// add hidden column to node table if it is missing
			if (!(await knex.schema.hasColumn('node', 'hidden'))) {
				await knex.schema.alterTable('node', (table) => {
					table.boolean('hidden').nullable().comment('whether node is hidden');
				});
				console.log('added hidden column back to node table');
			}
			// add searchable column to node table if it is missing
			if (!(await knex.schema.hasColumn('node', 'searchable'))) {
				await knex.schema.alterTable('node', (table) => {
					table.boolean('searchable').nullable().comment('whether node is searchable');
				});
				console.log('added searchable column back to node table');
			}
			// remove linkStart column from association table if it is missing
			if (await knex.schema.hasColumn('association', 'linkStart')) {
				await knex.schema.alterTable('association', (table) => {
					table.dropColumn('linkStart');
				});
				console.log('removed linkStart column from association table');
			}
			console.log('hidden removal migration successfully reversed');
			resolve('hidden removal migration completed');
		} catch (err) {
			reject(err);
		}
	});
};
