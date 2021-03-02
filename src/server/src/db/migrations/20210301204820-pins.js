'use strict';
const Sequelize = require('sequelize');

module.exports = {
  up: async (query) => {
    return query.addColumn('node', 'pinned', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      comment: 'Whether or not the node is pinned',
    });
  },

  down: async (query) => {
    return query.removeColumn('node', 'pinned');
  },
};
