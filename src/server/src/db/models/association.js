'use strict';
module.exports = (sequelize, DataTypes) => {
  const association = sequelize.define(
    'association',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        comment: 'The Association ID',
      },
      nodeId: {
        type: DataTypes.INTEGER,
        comment: 'The Node which is being associated',
        allowNull: true,
      },
      nodeUUID: {
        type: DataTypes.UUID,
        comment: 'unique identifier for the node',
        allowNull: true,
      },
      nodeType: {
        type: DataTypes.STRING,
        comment: 'The node type',
        allowNull: true,
      },
      linkedNode: {
        type: DataTypes.INTEGER,
        comment: 'the node being linked to',
        allowNull: true,
      },
      linkedNodeUUID: {
        type: DataTypes.UUID,
        comment: 'copy of the unique identifier for the linkedNode',
        allowNull: true,
      },
      linkedNodeType: {
        type: DataTypes.STRING,
        comment: 'The linked node type',
        allowNull: true,
      },
      linkStrength: {
        type: DataTypes.INTEGER,
        comment: 'left associated node association strength',
        allowNull: true,
      },
      creator: {
        type: DataTypes.INTEGER,
        comment: 'The creator of the association',
        allowNull: true,
      },
      importId: {
        type: DataTypes.UUID,
        after: 'creator',
        comment: 'UUID of the import package, if association was imported from elsewhere',
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    { freezeTableName: true }
  );
  association.associate = function (models) {
    // associations can be defined here
    association.belongsTo(models.user, { constraints: false, foreignKey: 'creator' });
    association.belongsTo(models.node, {
      as: 'original',
      constraints: false,
      foreignKey: 'nodeId',
      targetKey: 'id',
    });
    association.belongsTo(models.node, {
      as: 'associated',
      constraints: false,
      foreignKey: 'linkedNode',
      targetKey: 'id',
    });
  };
  return association;
};
