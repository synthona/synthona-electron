const { node, association } = require('../db/models');
const { Op } = require('sequelize');

exports.maintainAssociationStrengthValues = async () => {
  // TODO: complete this function and set it to run
  // periodically! it should fetch the MIN linkStrength in the table and
  // check to see if it is greater than a certain threshold value. if it is,
  // it should go through the entire database and decrement every linkstrength
  // by whatever the difference between the MIN linkstrength and 1 is
  // this is basically to try to prevent linkstrengths in the table from getting
  // up into too high of numbers. there will probably still be drift in the system
  // but it will be mitigated by this
  // =================================================================================================
  // part II: getting by MIN won't work because many will hover at 1
  // a better solution is to just rank every node from most to least and
  // just iterate through relabeling them in the correct ordering, getting ride of the "space between"
  // nodes which will emerge? although. this does kind of...lose information
  // so it might be better to just condense it rather than relable completely. i will keep thinking about it
  // =================================================================================================
  // // perform a maintenance check to see if related association strengths should be decremented
  // const maintenanceCheck = await association.min({
  //   where: {
  //     creator: userId,
  //     attributes: ['linkStrength'],
  //   },
  // });
  // // if the limit has been reached bring the values back down
  // if (maintenanceCheck.linkStrength > 100) {
  //   console.log('maintenance time!');
  //   // this is where u have to fetch literally all the associations
  //   var maintenanceAssociations = await association.findAll({
  //     where: {
  //       creator: userId,
  //       [Op.or]: [
  //         { nodeId: nodeA },
  //         { linkedNode: nodeA },
  //       ],
  //       attributes: ['linkStrength'],
  //     }
  //   });
  //   // loop through them and decrement them by whatever the difference
  //   // between maintenanceCheck.linkStrength and zero is
  //   maintenanceAssociations.forEach(association => {
  //     console.log(association);
  //   })
  // }
};

// exports.regenerateAssociationTypes = async () => {
//   const result = await association.findAll({
//     where: {},
//     include: [
//       {
//         model: node,
//         as: 'original',
//         attributes: ['id', 'isFile', 'type', 'preview', 'name'],
//       },
//       {
//         model: node,
//         as: 'associated',
//         attributes: ['id', 'isFile', 'type', 'preview', 'name'],
//       },
//     ],
//   });
//   result.forEach((value) => {
//     console.log('\n');
//     console.log('id: ' + value.id);
//     console.log('original type: ' + value.original.type);
//     console.log('associated type: ' + value.associated.type);
//     var nodeType = value.original.type;
//     var linkedNodeType = value.associated.type;
//     association.update(
//       {
//         nodeType: nodeType,
//         linkedNodeType: linkedNodeType,
//       },
//       { where: { id: value.id } },
//       { silent: true }
//     );
//   });
//   console.log('\n');
//   console.log('done');
//   return;
// };

// exports.regenerateAssociationUUIDS = async () => {
//   const result = await association.findAll({
//     where: {},
//     include: [
//       {
//         model: node,
//         as: 'original',
//         attributes: ['id', 'uuid', 'isFile', 'type', 'preview', 'name'],
//       },
//       {
//         model: node,
//         as: 'associated',
//         attributes: ['id', 'uuid', 'isFile', 'type', 'preview', 'name'],
//       },
//     ],
//   });
//   result.forEach((value) => {
//     console.log('\n');
//     console.log('id: ' + value.id);
//     console.log('original uuid: ' + value.original.uuid);
//     console.log('associated uuid: ' + value.associated.uuid);
//     var nodeUUID = value.original.uuid;
//     var linkedNodeUUID = value.associated.uuid;
//     association.update(
//       {
//         nodeUUID: nodeUUID,
//         linkedNodeUUID: linkedNodeUUID,
//       },
//       { where: { id: value.id } },
//       { silent: true }
//     );
//   });
//   console.log('\n');
//   console.log('done');
//   return;
// };

// needed to regenerate imageUrls after renaming "uploads" directory to "data"
// exports.regenerateImageUrls = async () => {
//   const result = await node.findAll({
//     where: {
//       isFile: true,
//       type: 'image',
//     },
//     order: [['updatedAt', 'ASC']],
//   });
//   result.forEach((value) => {
//     console.log(value.preview);
//     const preview = value.preview;
//     const replaceCreator = preview.replace(value.creator, 'images');
//     const updatedValue = replaceCreator.replace('images', value.creator);
//     console.log(updatedValue);
//     node.update(
//       {
//         preview: updatedValue,
//       },
//       { where: { id: value.id } },
//       { silent: true }
//     );
//   });
//   console.log('done');
//   return;
// };

// needed to regenerate isFile values because some were getting set incorrectly
// exports.regenerateIsFileValues = async () => {
//   const result = await node.findAll({
//     where: {
//       isFile: true,
//     },
//     order: [['updatedAt', 'ASC']],
//   });
//   result.forEach((value) => {
//     if (value.type === 'text' || value.type === 'collection' || value.type === 'user') {
//       node.update(
//         {
//           isFile: false,
//         },
//         { where: { id: value.id } },
//         { silent: true }
//       );
//     }
//   });
//   console.log('done');
//   return;
// };

// copy the values over from the comment column to the preview column
// exports.commentColumnUpdate = async () => {
//   const result = await node.findAll({
//     order: [['updatedAt', 'ASC']],
//   });
//   result.forEach((value) => {
//     console.log(value.name);
//     node.update(
//       {
//         preview: value.comment,
//       },
//       { where: { id: value.id } },
//       { silent: true }
//     );
//   });
//   console.log('done');
//   return;
// };

// generate path column values
// exports.generatePathColumn = async () => {
//   const result = await node.findAll({
//     where: {
//       [Op.or]: [{ isFile: true }, { type: 'url' }, { type: 'image' }],
//     },
//     order: [['updatedAt', 'ASC']],
//   });
//   result.forEach((value) => {
//     console.log(value.comment);
//     node.update(
//       {
//         path: value.comment,
//       },
//       { where: { id: value.id } },
//       { silent: true }
//     );
//   });
//   console.log('done');
//   return;
// };

exports.clearBrokenAssociations = async () => {
  console.log('clearing broken associations');
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
      value.destroy();
    }
  }
  console.log('done');
  return;
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
    // if one of them is missing, count it as broken
    if (!anchorNode || !linkedNode) {
      console.log(
        'id: ' + value.id + ', nodeId: ' + value.nodeId + ', linkedNode: ' + value.linkedNode
      );
      count++;
    }
  }
  console.log('there are ' + count + ' broken associations');
  return;
};
