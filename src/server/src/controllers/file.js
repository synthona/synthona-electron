// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node, association, user } = require('../db/models');
// import node dependencies
const path = require('path');
const fs = require('fs');

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
      preview: fileUrl,
      path: fileUrl,
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
        ? req.protocol + '://' + req.get('host') + '/file/load/' + result.uuid
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

exports.linkFiles = async (req, res, next) => {
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
    // grab the input values from the request
    const fileList = JSON.parse(req.body.fileList);
    const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
    // determine which mimeTypes match with which nodeTypes
    const imageMimetypes = [
      'image/png',
      'image/jpg',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/heic',
    ];
    const audioMimetypes = ['audio/mpeg', 'audio/x-m4a', 'audio/wav'];
    let resultList = [];
    // iterate through the passed-in file list
    for (var file of fileList) {
      // set the nodeType value for this file
      let nodeType = null;
      let preview = null;
      let extension = file.name.substring(file.name.lastIndexOf('.'));
      if (imageMimetypes.includes(file.type)) {
        nodeType = 'image';
        preview = file.path;
      } else if (audioMimetypes.includes(file.type)) {
        nodeType = 'audio';
      } else if (file.type === 'application/zip' && !extension === '.synth') {
        nodeType = 'zip';
      } else if (extension === '.synth') {
        nodeType = 'package';
      } else {
        nodeType = 'file';
      }
      // create the corresponding node in the database
      const result = await node.create({
        isFile: true,
        hidden: false,
        searchable: true,
        type: nodeType,
        name: file.name,
        preview: preview,
        path: file.path,
        content: null,
        creator: userId,
      });
      resultList.push(result);
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
    }
    // fix the preview URLs...
    // TODO..mabye i should store them like this in the database...
    const results = resultList.map((item) => {
      if (item.isFile) {
        const fullUrl = item.preview
          ? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
          : null;
        item.preview = fullUrl;
      }
      return item;
    });
    // send response
    res.status(200).json({ nodes: results });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.loadFileByUUID = async (req, res, next) => {
  // this comes from the is-auth middleware
  const userId = req.user.uid;
  try {
    const uuid = req.params.uuid;
    // load node
    const result = await node.findOne({
      where: {
        uuid: uuid,
        creator: userId,
      },
      attributes: ['preview', 'path', 'name'],
    });
    // make sure there is a preview and then respond
    if (result && result.preview) {
      const filePath = result.preview;
      const basename = path.basename(filePath);
      const extension = basename.substring(basename.lastIndexOf('.'));
      res.download(filePath, result.name + extension);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.openShortcutInExplorer = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // verify that the logged in user is the one who created the shortcut
    const uuid = req.body.uuid;
    // load node
    const result = await node.findOne({
      where: {
        uuid: uuid,
      },
      attributes: ['uuid', 'path', 'creator'],
    });
    // check for issues
    if (!result) {
      const error = new Error('there was a problem launching the shortcut');
      error.statusCode = 404;
      throw error;
    }
    // set path variable
    const path = result.dataValues.path;
    var exec = require('child_process').exec;
    // surround the path with double-quotes to avoid any issues to do with spaces in file paths
    const stringPath = ' "' + path + '"';
    // launch the command
    exec(openInExplorerCode() + stringPath);
    // send 200 status to interface
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.launchShortcut = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // verify that the logged in user is the one who created the shortcut
    const uuid = req.body.uuid;
    // load node
    const result = await node.findOne({
      where: {
        uuid: uuid,
      },
      attributes: ['uuid', 'path', 'creator'],
    });
    // check for issues
    if (!result) {
      const error = new Error('there was a problem launching the shortcut');
      error.statusCode = 404;
      throw error;
    }
    // set path variable
    const path = result.dataValues.path;
    var exec = require('child_process').exec;
    // surround the path with double-quotes to avoid any issues to do with spaces in file paths
    const stringPath = ' "' + path + '"';
    // launch the command
    exec(getLaunchCode() + stringPath);
    // send 200 status to interface
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

function getLaunchCode() {
  switch (process.platform) {
    case 'darwin':
      return 'open';
    case 'win32':
      return 'start';
    case 'win64':
      return 'start';
    default:
      return 'xdg-open';
  }
}

function openInExplorerCode() {
  switch (process.platform) {
    case 'darwin':
      return 'open -R';
    case 'win32':
      return 'start';
    case 'win64':
      return 'start';
    default:
      return 'xdg-open';
  }
}
