// custom code
const { validationResult } = require('express-validator/check');
const context = require('../util/context');
// bring in data models.
const { node } = require('../db/models');

// create new text content node
exports.createText = async (req, res, next) => {
  // this comes from the is-auth middleware
  const userId = req.user.uid;
  const errors = validationResult(req);
  try {
    // catch validation errors
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // process request
    const content = req.body.content;
    const name = req.body.name || 'untitled';
    const preview = '';
    // create text node
    const textNode = await node.create({
      isFile: false,
      hidden: false,
      searchable: true,
      type: 'text',
      name: name,
      preview: preview,
      content: content,
      creator: userId,
    });
    // send response
    res.status(200).json({ uuid: textNode.uuid });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// load a single text node
exports.getTextByUUID = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // process request
    const uuid = req.query.uuid;
    // load text node
    const textNode = await node.findOne({
      where: {
        uuid: uuid,
      },
      attributes: [
        'uuid',
        'hidden',
        'searchable',
        'name',
        'type',
        'preview',
        'content',
        'updatedAt',
      ],
    });
    if (!textNode) {
      const error = new Error('Could not find text node');
      error.statusCode = 404;
      throw error;
    }
    context.markNodeView(textNode.uuid);
    // send response
    res.status(200).json({ textNode: textNode });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// delete a single text node
exports.deleteTextByUUID = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // process request
    const uuid = req.query.uuid;
    // load text node
    const textNode = await node.findOne({
      where: {
        uuid: uuid,
      },
    });
    if (!textNode) {
      const error = new Error('Could not find post');
      error.statusCode = 404;
      throw error;
    }
    // delete associations
    context.deleteAssociations(textNode.id);
    // delete node and send response
    textNode.destroy();
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// update a text node
exports.setText = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // process request
    const uuid = req.body.uuid;
    // load text node
    const textNode = await node.findOne({
      where: {
        uuid: uuid,
      },
    });
    if (!textNode) {
      const error = new Error('Could not find text node');
      error.statusCode = 404;
      throw error;
    }
    // update any values that have been changed
    textNode.content = req.body.content ? req.body.content : textNode.content;
    const result = await textNode.save();
    // return result
    res.status(200).json({ node: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.processText = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // process request
    const uuid = req.body.uuid;
    const preview = req.body.preview;
    // load text node
    const textNode = await node.findOne({
      where: {
        uuid: uuid,
      },
    });
    if (!textNode) {
      const error = new Error('Could not find text node');
      error.statusCode = 404;
      throw error;
    }
    textNode.preview = preview ? preview : textNode.preview;
    const result = await textNode.save();
    // send response
    res.status(200).json({ node: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
