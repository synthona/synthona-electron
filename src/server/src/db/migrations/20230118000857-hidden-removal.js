'use strict';
const Sequelize = require('sequelize');

let nodeTableDefinition;
let associationTableDefinition;

module.exports = {
	up: async (query) => {
		/*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
		// check if the columns already exist
		nodeTableDefinition = await query.describeTable('node');
		associationTableDefinition = await query.describeTable('association');
		// migrations
		if (nodeTableDefinition.hidden) {
			console.log('removing hidden column from node table');
			await query.removeColumn('node', 'hidden');
		}
		if (nodeTableDefinition.searchable) {
			console.log('removing searchable column from node table');
			await query.removeColumn('node', 'searchable');
		}
		if (!associationTableDefinition.linkStart) {
			console.log('creating linkStart column in association table');
			await query.addColumn('association', 'linkStart', {
				type: Sequelize.INTEGER,
				allowNull: true,
				comment: 'where does the link start, node (null), linkedNode (1), or both (2)?',
			});
		}
		return;
	},

	down: async (query, dataTypes) => {
		/*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
		// check if the columns already exist
		nodeTableDefinition = await query.describeTable('node');
		associationTableDefinition = await query.describeTable('association');
		if (!nodeTableDefinition.hidden) {
			console.log('creating hidden column');
			await query.addColumn('node', 'hidden', {
				type: Sequelize.BOOLEAN,
				comment: 'can it be accessed directly or only through its associations?',
			});
		}
		if (!nodeTableDefinition.searchable) {
			console.log('creating searchable');
			await query.addColumn('node', 'searchable', {
				type: Sequelize.BOOLEAN,
				comment: 'should it appear in search?',
			});
		}
		return;
	},
};
