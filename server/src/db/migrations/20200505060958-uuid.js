'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'),
      queryInterface.addColumn('node', 'uuid', {
        after: 'id',
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        comment: 'unique identifier',
      }),
      queryInterface.addColumn('association', 'nodeUUID', {
        after: 'nodeId',
        type: Sequelize.UUID,
        comment: 'unique identifier for the node',
      }),
      queryInterface.addColumn('association', 'linkedNodeUUID', {
        after: 'linkedNodeId',
        type: Sequelize.UUID,
        comment: 'copy of the unique identifier for the linkedNode',
      }),
    ]);
  },

  down: (queryInterface, DataSequelizeTypes) => {
    return Promise.all([
      queryInterface.removeColumn('node', 'uuid'),
      queryInterface.removeColumn('association', 'nodeUUID'),
      queryInterface.removeColumn('association', 'linkedNodeUUID'),
    ]);
  },
};
