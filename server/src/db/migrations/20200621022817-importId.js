'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('node', 'importId', {
        after: 'viewedAt',
        type: Sequelize.UUID,
        comment: 'UUID of the import package, if node was imported from elsewhere',
      }),
      queryInterface.addColumn('association', 'importId', {
        after: 'creator',
        type: Sequelize.UUID,
        comment: 'UUID of the import package, if association was imported from elsewhere',
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('node', 'importId'),
      queryInterface.removeColumn('association', 'importId'),
    ]);
  },
};
