const { node, association, user } = require('../db/models');
const { Op } = require('sequelize');

exports.transferImportedUserData = async (packageUUID, loggedInUserNode) => {
  console.log('\n' + 'associating imported user data to logged in user');
  // 1) "look up" all the user nodes and associations in the import
  const userNodeList = await node.findAll({
    where: {
      importId: packageUUID,
      type: 'user',
    },
    // include whichever node is the associated one for
    include: [
      {
        model: association,
        where: {
          [Op.or]: [{ nodeType: 'user' }, { linkedNodeType: 'user' }],
        },
        required: false,
        as: 'original',
      },
      {
        model: association,
        where: {
          [Op.or]: [{ nodeType: 'user' }, { linkedNodeType: 'user' }],
        },
        required: false,
        as: 'associated',
      },
    ],
  });
  // 2) replace the user part of the association with the values of loggedInUser
  for (userNode of userNodeList) {
    if (userNode.original) {
      userNode.original.forEach((association) => {
        if (association.nodeType === 'user') {
          association.nodeId = loggedInUserNode.id;
          association.nodeUUID = loggedInUserNode.uuid;
          association.save();
        } else if (association.linkedNodeType === 'user') {
          association.linkedNode = loggedInUserNode.id;
          association.linkedNodeUUID = loggedInUserNode.uuid;
          association.save();
        }
      });
    }
    if (userNode.associated) {
      userNode.associated.forEach((association) => {
        if (association.nodeType === 'user') {
          association.nodeId = loggedInUserNode.id;
          association.nodeUUID = loggedInUserNode.uuid;
          association.save();
        } else if (association.linkedNodeType === 'user') {
          association.linkedNode = loggedInUserNode.id;
          association.linkedNodeUUID = loggedInUserNode.uuid;
          association.save();
        }
      });
    }
  }
  // 3) delete all user nodes from nodes table with the importId
  await node.destroy({
    where: {
      [Op.and]: {
        type: 'user',
        importId: packageUUID,
      },
    },
  });
};

exports.countBrokenAssociations = async () => {
  console.log('counting broken associations');
  let count = 0;
  // load all associations into a variable
  const result = await association.findAll({
    order: [['updatedAt', 'ASC']],
  });
  // iterate through the associations
  for (value of result) {
    const anchorNode = await node.findOne({
      where: {
        id: value.nodeId,
      },
    });
    const linkedNode = await node.findOne({
      where: {
        id: value.linkedNode,
      },
    });
    // if one of them is missing, clear the association
    if (!anchorNode || !linkedNode) {
      console.log(
        'id: ' + value.id + ', nodeId: ' + value.nodeId + ', linkedNode: ' + value.linkedNode
      );
      count++;
    }
  }
  console.log('there are ' + count + ' broken associations');
  console.log('done');
  return;
};

exports.findAndReplaceTextNodeUUID = async (oldUUID, newUUID) => {
  console.log('updating text node uuids for ');
  // there might be more than one result. we are simply going to search for the old ID
  // there will be an array of values in return, possibly 1 long or possibly more

  // it will loop through those here. unfortunatley we do have to perform a search for each one don't we?
  // unfortunately yes i think so. which will add time to imports. the only relief is that
  // imports are something you only have to run like, occasionally

  // perform a text search of the content column of the text node types
  // searching for a match of "oldUUID"
  const result = node.findAll({
    where: {
      content: { [Op.like]: '%' + oldUUID },
    },
  });

  // loop through
  for (node of result) {
    console.log(node);
    // the update to be done is that we need to replaced the oldUUID with newUUID
    // directly in the string in the database, without changing anything else
    // and once that's done, we simply save the updated node back to the database!
  }
};
