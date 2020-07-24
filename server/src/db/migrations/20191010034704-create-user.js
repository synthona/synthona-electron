'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('user', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        comment: 'The ID of the user',
      },
      nodeId: {
        type: Sequelize.INTEGER,
        comment: 'The context system id',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The email of the user',
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The username of the user',
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The password for the user',
      },
      displayName: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The display name of the user',
      },
      bio: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'The user bio',
      },
      avatar: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'The fileurl of the user avatar',
      },
      header: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'The fileurl of the user header image',
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
    return queryInterface.dropTable('user');
  },
};
