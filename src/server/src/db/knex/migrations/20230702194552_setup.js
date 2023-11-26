/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => {
	console.log('initializing root database tables');
	return new Promise(async (resolve, reject) => {
		try {
			// create user table if it doesn't exist
			if (!(await knex.schema.hasTable('user'))) {
				await knex.schema.createTable('user', (table) => {
					table.increments('id').primary().comment('the ID of the user');
					table.uuid('nodeId').nullable().comment('context system id');
					table.string('email').notNullable().comment('email of the user');
					table.string('username').notNullable().comment('username of the user');
					table.string('password').notNullable().comment('password for the user');
					table.string('displayName').notNullable().comment('display name for the user');
					table.string('bio').nullable().comment('user bio');
					table.string('avatar').nullable().comment('fileurl of the user avatar');
					table.string('header').nullable().comment('fileurl of the user header image');
					table.date('createdAt').nullable().comment('date when the user was created');
					table.date('updatedAt').nullable().comment('last time user was updated');
				});
			}
			// create node table if it doesn't exist
			if (!(await knex.schema.hasTable('node'))) {
				await knex.schema.createTable('node', (table) => {
					table.increments('id').primary().comment('the node id');
					table.uuid('uuid').notNullable().comment('unique identifier');
					table.json('metadata').nullable().comment('json node metadata object');
					table.string('path').nullable().comment('url or file path');
					table.boolean('isFile').nullable().comment('is there a file for this node');
					table.string('type').nullable().comment('node type');
					table.string('name').nullable().comment('display name of the node');
					table.string('preview', 2500).nullable().comment('node preview information');
					table.string('comment', 2500).nullable().comment('node comment or description');
					table.text('content').nullable().comment('core node content');
					table.string('color').nullable().comment('color associated to the node');
					table
						.integer('impressions')
						.nullable()
						.comment('number of times node has been previewed');
					table.integer('views').nullable().comment('node content view count');
					table.integer('creator').nullable().comment('creator id for the node');
					table.boolean('pinned').nullable().comment('whether node is favorited/pinned');
					table.date('viewedAt').nullable().comment('last date this node was viewed');
					table.uuid('importId').nullable().comment('UUID of the import package if needed');
					table.date('createdAt').nullable().comment('date node was created');
					table.date('updatedAt').nullable().comment('last updated at date');
				});
			}
			// create association table if it doesn't exist
			if (!(await knex.schema.hasTable('association'))) {
				await knex.schema.createTable('association', (table) => {
					table.increments('id').primary().comment('The Association ID');
					table.integer('nodeId').nullable().comment('The Node which is being associated');
					table.uuid('nodeUUID').nullable().comment('Unique identifier for the node');
					table.string('nodeType').nullable().comment('The Node Type');
					table.integer('linkedNode').nullable().comment('The Node being linked to');
					table.uuid('linkedNodeUUID').nullable().comment('Unique identifier for the linkedNode');
					table.string('linkedNodeType').nullable().comment('Linked Node Type');
					table
						.integer('linkStrength')
						.nullable()
						.comment('left associated node association strength');
					table.integer('linkStart').nullable().comment('node (null), linkedNode (1), both (2)');
					table.integer('creator').nullable().comment('creator of the association');
					table.uuid('importId').nullable().comment('UUID of the import package, if there is one');
					table.date('createdAt').nullable().comment('creation timestamp');
					table.date('updatedAt').nullable().comment('updated timestamp');
				});
			}
			resolve('core database tables initialized');
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
	console.log('clearing root database tables');
	return knex.schema.dropTable('user').dropTable('node').dropTable('association');
};
