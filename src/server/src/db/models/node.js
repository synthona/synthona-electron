'use strict';
module.exports = (sequelize, DataTypes) => {
  const node = sequelize.define(
    'node',
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
        comment: 'The node ID',
      },
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        comment: 'unique identifier',
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        comment: 'json object containing non-query-able properties for the node',
      },
      path: {
        type: DataTypes.STRING,
        comment: 'url or file path associated with the node',
      },
      isFile: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
        comment: 'is there a file on the server associated with this?',
      },
      hidden: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
        comment: 'can it be accessed directly or only through its associations?',
      },
      searchable: {
        allowNull: true,
        type: DataTypes.BOOLEAN,
        comment: 'should it appear in search?',
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'The Node type',
      },
      name: {
        type: DataTypes.STRING,
        comment: 'The name of the node',
      },
      preview: {
        type: DataTypes.STRING(2500),
        comment: 'whatever information is needed for the node preview',
      },
      comment: {
        type: DataTypes.STRING(2500),
        comment: 'a user comment',
      },
      content: {
        type: DataTypes.TEXT,
        comment: 'the content',
      },
      color: {
        type: DataTypes.STRING,
        comment: 'The associated color',
      },
      impressions: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'The number of times a node has been sent to a Client',
      },
      views: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'The number of times a node has been Accessed',
      },
      creator: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'The creator of the node',
      },
      pinned: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: 'Whether or not the node is pinned',
      },
      viewedAt: {
        type: DataTypes.DATE,
        comment: 'last date this node was viewed',
      },
      importId: {
        type: DataTypes.UUID,
        comment: 'UUID of the import package, if association was imported from elsewhere',
      },
      createdAt: {
        allowNull: true,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: true,
        type: DataTypes.DATE,
      },
    },
    { freezeTableName: true }
  );
  node.associate = function (models) {
    // associations can be defined here
    node.belongsTo(models.user, { constraints: false, foreignKey: 'creator' });
    node.hasMany(models.association, {
      as: 'original',
      constraints: false,
      foreignKey: 'nodeId',
      // foreignKey: 'id',
      // targetKey: 'nodeId',
    });
    node.hasMany(models.association, {
      as: 'associated',
      constraints: false,
      // foreignKey: 'id',
      // targetKey: 'linkedNode',
      foreignKey: 'linkedNode',
    });
    node.belongsToMany(node, {
      through: models.association,
      as: 'left',
      foreignKey: 'nodeId',
      otherKey: 'linkedNode',
      constraints: false,
    });
    node.belongsToMany(node, {
      through: models.association,
      as: 'right',
      foreignKey: 'linkedNode',
      otherKey: 'nodeId',
      constraints: false,
    });
    node.hasOne(models.user, { constraints: false, foreignKey: 'nodeId', sourceKey: 'uuid' });
  };
  return node;
};
