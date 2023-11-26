/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => {
	console.log('running pinned column migration');
	return new Promise(async (resolve, reject) => {
		// add pinned column to node table if it doesn't exist
		if (!(await knex.schema.hasColumn('node', 'pinned'))) {
			await knex.schema.alterTable('node', (table) => {
				table.boolean('pinned').nullable().comment('whether node is favorited/pinned');
			});
			console.log('pinned column added to the node table');
		}
		resolve('pins migration completed');
	});
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => {
	console.log('removing pinned column from node table');
	return knex.schema.alterTable('node', (table) => {
		table.dropColumn('pinned');
	});
};
