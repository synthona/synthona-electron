'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('association', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'The Association ID',
      },
      nodeId: {
        type: Sequelize.INTEGER,
        comment: 'The Node which is being associated',
        unique: false,
      },
      nodeUUID: {
        type: Sequelize.UUID,
        comment: 'unique identifier for the node',
      },
      nodeType: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The node type',
      },
      linkedNode: {
        type: Sequelize.INTEGER,
        comment: 'the node being linked to',
        unique: false,
      },
      linkedNodeUUID: {
        type: Sequelize.UUID,
        comment: 'copy of the unique identifier for the linkedNode',
      },
      linkedNodeType: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The linked node type',
      },
      linkStrength: {
        type: Sequelize.INTEGER,
        comment: 'left associated node association strength',
      },
      creator: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The creator of the association',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('association');
  },
};
