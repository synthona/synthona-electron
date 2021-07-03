const path = require('path');
var fs = require('fs');
// import packages
const { validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
// bring in data models.
const { Op } = require('sequelize');
const { user, node, association } = require('../db/models');
// bring in util functions
const fsUtil = require('../util/fsUtil');

// load a single user by Username
exports.getUserByUsername = async (req, res, next) => {
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
    const username = req.query.username;
    // load user
    const userNode = await user.findOne({
      where: { username },
      attributes: ['username', 'nodeId', 'displayName', 'bio', 'avatar', 'header'],
    });
    // check for errors
    if (!userNode) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    if (userNode.avatar) {
      // add server info to image urls
      userNode.avatar = userNode.avatar
        ? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + userNode.nodeId
        : null;
    }
    if (userNode.header) {
      userNode.header = userNode.header
        ? req.protocol + '://' + req.get('host') + '/user/load/header/' + userNode.nodeId
        : null;
    }
    // send response
    res.status(200).json({ user: userNode });
    // res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// load a single user by email
exports.getUserByEmail = async (req, res, next) => {
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
    const email = req.query.email;
    // load user
    const userNode = await user.findOne({
      where: { email },
      attributes: ['username', 'email', 'displayName', 'bio', 'avatar', 'header'],
    });
    // check for errors
    if (!userNode) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    if (userNode.avatar) {
      // add server info to image urls
      userNode.avatar = userNode.avatar
        ? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + userNode.nodeId
        : null;
    }
    if (userNode.header) {
      userNode.header = userNode.header
        ? req.protocol + '://' + req.get('host') + '/user/load/header/' + userNode.nodeId
        : null;
    }
    // send response
    res.status(200).json({ user: userNode });
    // res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// update basic user information
exports.setUserInfo = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // uid from auth token
    const uid = req.user.uid;
    // process request
    const username = req.body.username;
    // load user
    const profile = await user.findOne({
      where: { username, id: uid },
    });
    // check for errors
    if (!profile) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    // update any values that have been changed
    profile.displayName = req.body.displayName ? req.body.displayName : profile.displayName;
    profile.bio = req.body.bio ? req.body.bio : profile.bio;
    const result = await profile.save();
    // update the associated user node if necessary
    if (req.body.bio || req.body.displayName) {
      await node.update(
        {
          name: result.displayName,
          content: result.bio,
        },
        {
          where: {
            creator: uid,
            type: 'user',
          },
        }
      );
    }
    if (profile.avatar) {
      // add server info to image urls
      profile.avatar = profile.avatar
        ? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + profile.nodeId
        : null;
    }
    if (profile.header) {
      profile.header = profile.header
        ? req.protocol + '://' + req.get('host') + '/user/load/header/' + profile.nodeId
        : null;
    }
    // return result
    res.status(200).json({ user: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// update username
exports.setUsername = async (req, res, next) => {
  // NOTE: this info is generated server side in is-auth.js
  // so doesn't need to be validated here
  const uid = req.user.uid;
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // load user
    const userNode = await user.findByPk(uid);
    // check for errors
    if (!userNode) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    // process request
    const username = req.body.username;
    // update any values that have been changed
    userNode.username = username ? username : userNode.username;
    const result = await userNode.save();
    // update the associated user node if necessary
    if (req.body.username) {
      await node.update(
        {
          path: result.username,
        },
        {
          where: {
            creator: uid,
            type: 'user',
          },
        }
      );
    }
    if (userNode.avatar) {
      // add server info to image urls
      userNode.avatar = userNode.avatar
        ? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + userNode.nodeId
        : null;
    }
    if (userNode.header) {
      userNode.header = userNode.header
        ? req.protocol + '://' + req.get('host') + '/user/load/header/' + userNode.nodeId
        : null;
    }
    // return result
    res.status(200).json({ user: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// update email
exports.setEmail = async (req, res, next) => {
  // NOTE: this info is generated server side in is-auth.js
  // so doesn't need to be validated here
  const uid = req.user.uid;
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // load user
    const userNode = await user.findByPk(uid);
    // check for errors
    if (!userNode) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    // process request
    const email = req.body.email;
    // update any values that have been changed
    userNode.email = email ? email : userNode.email;
    const result = await userNode.save();
    // add server info to image urls
    if (userNode.avatar) {
      userNode.avatar = userNode.avatar
        ? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + userNode.nodeId
        : null;
    }
    if (userNode.header) {
      userNode.header = userNode.header
        ? req.protocol + '://' + req.get('host') + '/user/load/header/' + userNode.nodeId
        : null;
    }
    // return result
    res.status(200).json({ user: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// update user avatar
exports.setAvatar = async (req, res, next) => {
  try {
    // catch null errors
    if (!req.file) {
      const error = new Error('There was a problem uploading the file');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // this comes from the is-auth middleware
    const uid = req.user.uid;
    // process request
    const imageUrl = req.file.path;
    // load user
    const userNode = await user.findByPk(uid);
    // check for errors
    if (!userNode) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    // delete the old file if it exists
    if (userNode.avatar) {
      var filePath = path.resolve(userNode.avatar);
      // remove the file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // clean up any empty folders created by this deletion
        await fsUtil.cleanupDataDirectoryFromFilePath(filePath);
      }
    }
    // update the header url
    userNode.avatar = imageUrl;
    const result = await userNode.save();
    // update the associated user node
    // this should be made more specific
    await node.update(
      {
        preview: result.avatar,
      },
      {
        where: {
          creator: uid,
          type: 'user',
        },
      }
    );
    const avatarUrl = req.protocol + '://' + req.get('host') + '/user/load/avatar/' + result.nodeId;
    // send response
    res.status(200).json({ url: avatarUrl });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

// update user header image
exports.setHeaderImage = async (req, res, next) => {
  try {
    // catch null errors
    if (!req.file) {
      const error = new Error('There was a problem uploading the file');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // this comes from the is-auth middleware
    const uid = req.user.uid;
    // process request
    const imageUrl = req.file.path;
    // load user
    const userNode = await user.findByPk(uid);
    // check for errors
    if (!userNode) {
      const error = new Error('Could not find user');
      error.statusCode = 404;
      throw error;
    }
    // delete the old file
    // delete the old file if it exists
    if (userNode.header) {
      var filePath = path.resolve(userNode.header);
      // remove the file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // clean up any empty folders created by this deletion
        await fsUtil.cleanupDataDirectoryFromFilePath(filePath);
      }
    }
    // update the header url
    userNode.header = imageUrl;
    const result = await userNode.save();
    const headerUrl = req.protocol + '://' + req.get('host') + '/user/load/header/' + result.nodeId;
    // send response
    res.status(200).json({ url: headerUrl });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.loadUserAvatar = async (req, res, next) => {
  try {
    const uuid = req.params.uuid;
    // load node
    const result = await user.findOne({
      where: {
        nodeId: uuid,
      },
      attributes: ['avatar'],
    });
    // make sure there is a preview and then respond
    if (result && result.avatar) {
      const imagePath = path.resolve(result.avatar);
      res.sendFile(path.resolve(imagePath));
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

exports.loadUserHeader = async (req, res, next) => {
  try {
    const uuid = req.params.uuid;
    // load node
    const result = await user.findOne({
      where: {
        nodeId: uuid,
      },
      attributes: ['header'],
    });
    // make sure there is a preview and then respond
    if (result && result.header) {
      const imagePath = path.resolve(result.header);
      res.sendFile(path.resolve(imagePath));
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

exports.clearAllDataByUser = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // NOTE: this info is generated server side in is-auth.js
    // so doesn't need to be validated here
    const uid = req.user.uid;
    const account = await user.findOne({
      where: { id: uid },
    });
    // catch error if no account is found
    if (!account) {
      const error = new Error('A user with this uid could not be found');
      error.statusCode = 401;
      throw error;
    }
    // store incoming info in variables.
    const password = req.body.password.trim();
    // verify old password
    const isEqual = await bcrypt.compare(password, account.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect');
      error.statusCode = 401;
      throw error;
    }
    // remove all nodes created by the logged in user which are not of type user
    await node.destroy({ where: { [Op.and]: { creator: uid, [Op.not]: { type: 'user' } } } });
    await association.destroy({ where: { creator: uid } });
    // clean up the data folder as well
    fs.readdir(path.join(__coreDataDir, 'data', uid), (err, files) => {
      if (err) {
        return next(err);
      } else {
        files.forEach((file) => {
          if (file !== 'user') {
            const filePath = path.join(__coreDataDir, 'data', uid, file);
            fs.rmdirSync(filePath, { recursive: true });
          }
        });
      }
    });
    // send response
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
