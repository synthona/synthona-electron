'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('node', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'The node ID',
      },
      uuid: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        comment: 'unique identifier',
      },
      isFile: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        comment: 'is there a file associated with the node?',
      },
      hidden: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        comment: 'can it be accessed directly or only through its associations?',
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The Node type',
      },
      name: {
        type: Sequelize.STRING,
        comment: 'The name of the node',
      },
      preview: {
        type: Sequelize.STRING(2500),
        comment: 'the preview description data',
      },
      content: {
        type: Sequelize.TEXT,
        comment: 'the content',
      },
      color: {
        type: Sequelize.STRING,
        comment: 'The associated color',
      },
      impressions: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'The number of times a node has been sent to a Client',
      },
      views: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'The number of times a node has been Accessed',
      },
      creator: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'The creator of the node',
      },
      createdFrom: {
        type: Sequelize.INTEGER,
        comment: 'last node viewed before this was created',
      },
      viewedAt: {
        type: Sequelize.DATE,
        comment: 'last date this node was viewed',
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
    return queryInterface.dropTable('node');
  },
};
