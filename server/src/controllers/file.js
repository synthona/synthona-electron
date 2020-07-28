// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node, association } = require('../db/models');

exports.createFile = async (req, res, next) => {
  // this comes from the is-auth middleware
  const userId = req.user.uid;
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // catch null errors
    if (!req.file) {
      const error = new Error('There was a problem uploading the file');
      error.statusCode = 422;
      throw error;
    }
    // process request
    const fileUrl = req.file.path;
    const dbFileUrl = fileUrl.substring(fileUrl.lastIndexOf('/data/') + 1);
    const nodeType = req.file.nodeType;
    const originalName = req.body.name || req.file.originalname;
    const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
    // create node in the context system
    const result = await node.create({
      isFile: true,
      hidden: false,
      searchable: true,
      type: nodeType,
      name: originalName,
      preview: dbFileUrl,
      path: dbFileUrl,
      content: originalName,
      creator: userId,
    });
    // if there is a linkedNode passed in, associate it
    if (linkedNode) {
      // make sure linkedNode exists
      const nodeB = await node.findOne({
        where: {
          uuid: linkedNode.uuid,
        },
      });
      // throw error if it is empty
      if (!nodeB) {
        const error = new Error('Could not find both nodes');
        error.statusCode = 404;
        throw error;
      }
      // create association
      await association.create({
        nodeId: result.dataValues.id,
        nodeUUID: result.dataValues.uuid,
        nodeType: result.dataValues.type,
        linkedNode: nodeB.id,
        linkedNodeUUID: nodeB.uuid,
        linkedNodeType: nodeB.type,
        linkStrength: 1,
        creator: userId,
      });
    }
    // add the baseURL of the server instance back in
    if (result.isFile) {
      result.preview = result.preview
        ? req.protocol + '://' + req.get('host') + '/' + result.preview
        : null;
    }
    // send response
    res.status(200).json({ node: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
