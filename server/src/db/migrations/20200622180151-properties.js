'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('node', 'metadata', {
        after: 'uuid',
        type: Sequelize.JSON,
        comment: 'json object containing non-query-able properties for the node',
      }),
      queryInterface.addColumn('node', 'path', {
        after: 'metadata',
        type: Sequelize.STRING,
        comment: 'url associated with the node or file path',
      }),
      queryInterface.addColumn('node', 'preview', {
        after: 'name',
        type: Sequelize.STRING(2500),
        comment: 'whatever information is needed for the node preview',
      }),
      queryInterface.renameColumn('node', 'summary', 'comment'),
      // been meaning to remove this for a while
      queryInterface.removeColumn('node', 'createdFrom'),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('node', 'properties'),
      queryInterface.removeColumn('node', 'path'),
      queryInterface.removeColumn('node', 'preview'),
      queryInterface.renameColumn('node', 'comment', 'preview'),
    ]);
  },
};
