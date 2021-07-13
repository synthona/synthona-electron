'use strict';
const Sequelize = require('sequelize');

module.exports = {
	up: async (query) => {
		// check if the column already exists
		const tableDefinition = await query.describeTable('node');
		if (tableDefinition.pinned) return;
		// add the column if we still need it
		return query.addColumn('node', 'pinned', {
			type: Sequelize.BOOLEAN,
			allowNull: true,
			comment: 'Whether or not the node is pinned',
		});
	},

	down: async (query) => {
		// commented this out because i kept accidentally removing the column when testing other migrations
		// return query.removeColumn('node', 'pinned');
	},
};
