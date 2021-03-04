const { Op } = require('sequelize');
const { node, association } = require('../db/models');

// util function to delete associations for a node
exports.deleteAssociations = async (id) => {
  try {
    await association.destroy({
      where: {
        [Op.or]: [{ nodeId: id }, { linkedNode: id }],
      },
    });
  } catch (err) {
    err.statusCode = 500;
    err.message = 'Failed to delete associations';
  }
};

// util function to mark a node as viewed
exports.markNodeView = async (uuid) => {
  // mark the node as updated
  try {
    const result = await node.findOne({
      where: {
        uuid: uuid,
      },
    });
    result.changed('updatedAt', true);
    const updatedNode = await result.save();
    return updatedNode;
  } catch (err) {
    err.statusCode = 500;
    err.message = 'Failed to mark view in context system';
  }
};

exports.createNewAssociation = async (anchorNode, linkedNode, userId, importId) => {
  try {
    // create association
    const newAssociation = await association.create({
      nodeId: anchorNode.id,
      nodeUUID: anchorNode.uuid,
      nodeType: anchorNode.type,
      linkedNode: linkedNode.id,
      linkedNodeUUID: linkedNode.uuid,
      linkedNodeType: linkedNode.type,
      importId: importId.uuid || null,
      linkStrength: 1,
      creator: userId,
    });
    // return the value
    return newAssociation;
  } catch (err) {
    err.statusCode = 500;
    err.message = 'Failed to mark view in context system';
  }
};
