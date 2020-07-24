'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('node', 'searchable', {
        after: 'hidden',
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'unique identifier',
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([queryInterface.removeColumn('node', 'searchable')]);
  },
};
