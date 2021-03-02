'use strict';
module.exports = (sequelize, DataTypes) => {
  const user = sequelize.define(
    'user',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        comment: 'The ID of the user',
      },
      nodeId: {
        type: DataTypes.UUID,
        comment: 'The context system id',
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The email of the user',
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The username of the user',
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The password for the user',
      },
      displayName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The display name of the user',
      },
      bio: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'The user bio',
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'The fileurl of the user avatar',
      },
      header: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'The fileurl of the user header image',
      },
      // tokenInitiated: {
      //   type: DataTypes.STRING,
      //   allowNull: true,
      //   comment: 'The fileurl of the user header image'
      // },
      createdAt: {
        type: DataTypes.DATE,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    { freezeTableName: true }
  );
  user.associate = function (models) {
    // associations can be defined here
    user.belongsTo(models.node, {
      constraints: false,
      foreignKey: 'nodeId',
      targetKey: 'uuid',
    });
    // user.belongsToMany(node, { through: UserHistory, constraints: false });
  };
  return user;
};
