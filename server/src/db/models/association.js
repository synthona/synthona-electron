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
      },
      nodeUUID: {
        type: DataTypes.UUID,
        comment: 'unique identifier for the node',
      },
      nodeType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The node type',
      },
      linkedNode: {
        type: DataTypes.INTEGER,
        comment: 'the node being linked to',
      },
      linkedNodeUUID: {
        type: DataTypes.UUID,
        comment: 'copy of the unique identifier for the linkedNode',
      },
      linkedNodeType: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'The linked node type',
      },
      linkStrength: {
        type: DataTypes.INTEGER,
        comment: 'left associated node association strength',
      },
      creator: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'The creator of the association',
      },
      importId: {
        type: DataTypes.UUID,
        after: 'creator',
        comment: 'UUID of the import package, if association was imported from elsewhere',
      },
      createdAt: {
        allowNull: false,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: DataTypes.DATE,
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
