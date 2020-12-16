const path = require('path');
var fs = require('fs');
// bring in data models.
const { node, association } = require('../db/models');
const { Op } = require('sequelize');
// custom code
const { validationResult } = require('express-validator/check');
const context = require('../util/context');
const fsUtil = require('../util/fsUtil');

exports.createNode = async (req, res, next) => {
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
    const type = req.body.type;
    const name = req.body.name;
    const isFile = req.body.isFile;
    const preview = req.body.preview;
    const content = req.body.content;
    const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
    const path =
      req.body.type === 'url' || (req.body.type === 'image' && req.body.isFile === false)
        ? req.body.preview
        : null;
    // userId comes from the is-auth middleware
    const userId = req.user.uid;
    // create node
    const result = await node.create({
      isFile: isFile,
      hidden: false,
      searchable: true,
      type: type,
      name: name,
      path: path,
      preview: preview,
      content: content,
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
      if (nodeB) {
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
    }
    // remove values that don't need to be returned
    delete result.dataValues.isFile;
    delete result.dataValues.color;
    delete result.dataValues.impressions;
    delete result.dataValues.views;
    delete result.dataValues.createdFrom;
    // send response
    res.status(200).json({ node: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getNodeByUUID = async (req, res, next) => {
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
    // load node
    const result = await node.findOne({
      where: {
        uuid: uuid,
      },
      attributes: [
        'uuid',
        'isFile',
        'hidden',
        'searchable',
        'comment',
        'metadata',
        'type',
        'name',
        'preview',
        'content',
        'path',
        'updatedAt',
      ],
    });
    if (!result) {
      const error = new Error('Could not find  node');
      error.statusCode = 404;
      throw error;
    }
    context.markNodeView(result.uuid);
    // add full file url
    if (result.isFile || result.type === 'user') {
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

exports.markNodeView = async (req, res, next) => {
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
    context.markNodeView(uuid);
    // send response
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateNode = async (req, res, next) => {
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
    const existingNode = await node.findOne({
      where: {
        uuid: uuid,
      },
    });
    if (!existingNode) {
      const error = new Error('Could not find node');
      error.statusCode = 404;
      throw error;
    }
    // update any values that have been changed
    existingNode.name = req.body.name ? req.body.name : existingNode.name;
    existingNode.preview = req.body.preview ? req.body.preview : existingNode.preview;
    existingNode.content = req.body.content ? req.body.content : existingNode.content;
    existingNode.hidden =
      typeof req.body.hidden === 'boolean' ? req.body.hidden : existingNode.hidden;
    existingNode.searchable =
      typeof req.body.searchable === 'boolean' ? req.body.searchable : existingNode.searchable;
    // save and store result
    const result = await existingNode.save({ silent: true });
    // it's an file, re-apply the baseURL
    if (result.isFile || result.type === 'user') {
      const fullUrl = result.preview
        ? req.protocol + '://' + req.get('host') + '/' + result.preview
        : null;
      result.preview = fullUrl;
    }
    // return result
    res.status(200).json({ node: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.searchNodes = async (req, res, next) => {
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
    // process request
    var currentPage = req.query.page || 1;
    var perPage = 15;
    var type = req.query.type || null;
    var searchQuery = req.query.searchQuery || '';

    // create WHERE statement
    var whereStatement = {};
    if (searchQuery) {
      whereStatement[Op.or] = [
        {
          name: { [Op.like]: '%' + searchQuery + '%' },
        },
        {
          preview: { [Op.like]: '%' + searchQuery + '%' },
        },
        {
          content: { [Op.like]: '%' + searchQuery + '%' },
        },
      ];
      // if there is a search query only return searchable items
      whereStatement.searchable = true;
    } else {
      // in an open request do not return hidden items
      whereStatement.hidden = { [Op.not]: true };
    }
    // exclude user nodes from the explore page for now
    // whereStatement.type = { [Op.not]: 'user' };
    if (type) whereStatement.type = type;
    // make sure the only nodes retrieved are from the logged in user
    whereStatement.creator = userId;
    // get the total node count
    const data = await node.findAndCountAll({
      where: whereStatement,
    });
    // retrieve nodes for the requested page
    const totalItems = data.count;
    const result = await node.findAll({
      where: whereStatement,
      offset: (currentPage - 1) * perPage,
      limit: perPage,
      order: [['updatedAt', 'DESC']],
      attributes: ['uuid', 'isFile', 'name', 'path', 'type', 'preview', 'updatedAt'],
      raw: true,
    });
    // TODO!!!! re-apply the base of the image URL (this shouldn't be here lmao. this is only text nodes)
    // i got way ahead of myself refactoring today and basically created a huge mess
    const results = result.map((item) => {
      if (item.isFile || item.type === 'user') {
        const fullUrl = item.preview
          ? req.protocol + '://' + req.get('host') + '/' + item.preview
          : null;
        item.preview = fullUrl;
      }
      return item;
    });
    // send response
    res.status(200).json({ nodes: results, totalItems: totalItems });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// delete a single node and any associations
exports.deleteNodeByUUID = async (req, res, next) => {
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
    const nodeToDelete = await node.findOne({
      where: {
        uuid: uuid,
      },
    });
    if (!nodeToDelete) {
      const error = new Error('Could not find node');
      error.statusCode = 404;
      throw error;
    }
    // if the node is a file, delete from the file system
    if (nodeToDelete.isFile) {
      var filePath = path.join(__basedir, nodeToDelete.preview);
      // remove the file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // clean up any empty folders created by this deletion
        fsUtil.cleanupDataDirectoryFromFilePath(filePath);
      }
    }
    // delete associations
    context.deleteAssociations(nodeToDelete.id);
    // delete node and send response
    nodeToDelete.destroy();
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// get the data for the graph display
// TODO: there is probably room for optimization here
exports.getGraphData = async (req, res, next) => {
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
    // process request
    const perPage = 77;
    const anchorNode = req.query.anchorNode;
    let nodeList;
    let nodeIdList = [];
    // depending on if an anchorNode is passed in, fetch the data
    if (anchorNode) {
      nodeList = [];
      // grab the anchornode
      const anchor = await node.findOne({
        where: {
          creator: userId,
          uuid: anchorNode,
        },
      });
      // 1. fetch the nodes
      const oringalList = await association.findAll({
        where: {
          creator: userId,
          [Op.or]: [{ nodeUUID: anchorNode }, { linkedNodeUUID: anchorNode }],
        },
        limit: perPage,
        // sort by linkStrength
        order: [['linkStrength', 'DESC']],
        attributes: [
          'id',
          'nodeId',
          'nodeType',
          'linkedNode',
          'linkedNodeType',
          'linkStrength',
          'updatedAt',
        ],
        // include whichever node is the associated one for each
        include: [
          {
            model: node,
            where: { id: { [Op.not]: anchorNode } },
            required: false,
            as: 'original',
            attributes: ['id', 'uuid', 'isFile', 'path', 'type', 'preview', 'name'],
          },
          {
            model: node,
            where: { id: { [Op.not]: anchorNode } },
            required: false,
            as: 'associated',
            attributes: ['id', 'uuid', 'isFile', 'path', 'type', 'preview', 'name'],
          },
        ],
      });
      // 2. turn the nodelist into an array to be passed into the second query
      oringalList.map((node) => {
        // grab the left associated nodes
        if (node.original.dataValues.uuid !== anchor.uuid) {
          nodeIdList.push(node.original.dataValues.id);
          nodeList.push(node.original.dataValues);
        }
        // grab the right associated nodes
        if (node.associated.dataValues.uuid !== anchor.uuid) {
          nodeIdList.push(node.associated.dataValues.id);
          nodeList.push(node.associated.dataValues);
        }
      });
      // add the anchorNode to the nodeIdList and nodeList as well
      nodeIdList.push(anchor.dataValues.id);
      nodeList.push(anchor.dataValues);
    } else {
      // 1. fetch the nodelist
      nodeList = await node.findAll({
        where: {
          creator: userId,
        },
        limit: perPage,
        raw: true,
        order: [['updatedAt', 'DESC']],
        attributes: ['id', 'uuid', 'name', 'path', 'type', 'updatedAt'],
      });
      // 2. turn the nodelist into an array to be passed into the second query
      nodeList.map((node) => {
        if (!nodeIdList.includes(node.id)) {
          nodeIdList.push(node.id);
        }
      });
    }
    // 3. retrieve the list of associations
    const associations = await association.findAll({
      where: {
        creator: userId,
        [Op.and]: [{ nodeId: { [Op.in]: nodeIdList } }, { linkedNode: { [Op.in]: nodeIdList } }],
      },
      raw: true,
      order: [['linkStrength', 'DESC']],
      attributes: [
        'id',
        'nodeId',
        'nodeType',
        'linkedNode',
        'linkedNodeType',
        'linkStrength',
        'updatedAt',
      ],
    });
    // 4. send response, return both lists as JSON data
    res.status(200).json({ nodes: nodeList, associations: associations });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
