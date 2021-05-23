// import environment variables
require('dotenv').config();
// import packages
const { validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
// custom code
const tokens = require('../util/tokens');
// bring in data models.
const { user, node } = require('../db/models');

exports.signup = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // store incoming info in variables.
    const email = req.body.email.trim();
    const username = req.body.username.trim();
    const password = req.body.password.trim();
    // set header, bio, and avatar defaults
    const bio = 'new user';

    // process request.
    const hash = await bcrypt.hash(password, 12);
    // create account
    const account = await user.create({
      email: email,
      password: hash,
      bio: bio,
      displayName: username,
      username: username,
    });
    // generate token
    const token = tokens.generateToken(account);
    const refreshToken = tokens.generateRefreshToken(account);
    // set the jwt cookies
    res.cookie('jwt', token, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 15 * 60000),
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 60 * 60000 * 24 * 3),
    });
    // create node in the context system
    const contextNode = await node.create({
      isFile: false,
      type: 'user',
      hidden: false,
      searchable: true,
      name: account.displayName,
      path: account.username,
      comment: account.bio,
      creator: account.id,
    });
    // set the nodeId
    account.nodeId = contextNode.uuid;
    await account.save();
    // send the response
    res.status(201).json({
      email: account.email,
      username: account.username,
      displayName: account.displayName,
      bio: account.bio,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.login = async (req, res, next) => {
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
    const email = req.body.email;
    const password = req.body.password;
    // retrieve account
    const account = await user.findOne({
      where: { email: email },
    });
    // catch error if no account is found
    if (!account) {
      const error = new Error('A user with this email could not be found');
      error.statusCode = 401;
      throw error;
    }
    // verify password
    const isEqual = await bcrypt.compare(password, account.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect');
      error.statusCode = 401;
      throw error;
    }
    // generate token
    const token = tokens.generateToken(account);
    const refreshToken = tokens.generateRefreshToken(account);
    // set the jwt cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 15 * 60000),
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 60 * 60000 * 24 * 3),
    });
    // set the header and avatar urls if needed
    let fullAvatarUrl;
    let fullHeaderUrl;
    if (account.avatar) {
      fullAvatarUrl =
        req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId;
    }
    if (account.header) {
      fullHeaderUrl =
        req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId;
    }
    // send response
    res.status(201).json({
      email: account.email,
      username: account.username,
      displayName: account.displayName,
      avatar: fullAvatarUrl,
      bio: account.bio,
      header: fullHeaderUrl,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
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
    const oldPassword = req.body.oldPassword.trim();
    const newPassword = req.body.newPassword.trim();
    // verify old password
    const isEqual = await bcrypt.compare(oldPassword, account.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect');
      error.statusCode = 401;
      throw error;
    }
    // update password
    const hash = await bcrypt.hash(newPassword, 12);
    account.password = hash;
    const result = await account.save();
    // generate new token
    const newToken = tokens.generateToken(result);
    const newRefreshToken = tokens.generateRefreshToken(account);
    // set the jwt cookie
    res.cookie('jwt', newToken, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 15 * 60000),
    });
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 60 * 60000 * 24 * 3),
    });
    // send the response
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // get data from req
    const email = req.body.email;
    const newPassword = req.body.newPassword.trim();
    const confirmNewPassword = req.body.confirmNewPassword.trim();
    // check that passwords match
    const isEqual = newPassword === confirmNewPassword;
    if (!isEqual) {
      const error = new Error('Passwords do not match');
      error.statusCode = 401;
      throw error;
    }
    // fetch the account so we can modify it
    const account = await user.findOne({
      where: { email: email },
    });
    // catch error if no account is found
    if (!account) {
      const error = new Error('A user with this uid could not be found');
      error.statusCode = 401;
      throw error;
    }
    // // update password
    const hash = await bcrypt.hash(newPassword, 12);
    account.password = hash;
    const result = await account.save();
    // generate new token
    const newToken = tokens.generateToken(result);
    const newRefreshToken = tokens.generateRefreshToken(account);
    // set the jwt cookie
    res.cookie('jwt', newToken, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 15 * 60000),
    });
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      sameSite: true,
      expires: new Date(Date.now() + 60 * 60000 * 24 * 3),
    });
    // send the response
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.isAuthenticated = async (req, res, next) => {
  const uid = req.user.uid;
  try {
    const account = await user.findOne({
      where: { id: uid },
    });
    if (!account) {
      const error = new Error('A user with this uid could not be found');
      error.statusCode = 401;
      throw error;
    }
    // set the header and avatar urls if needed
    let fullAvatarUrl;
    let fullHeaderUrl;
    if (account.avatar) {
      fullAvatarUrl =
        req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId;
    }
    if (account.header) {
      fullHeaderUrl =
        req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId;
    }
    // // send reponse
    res.status(201).json({
      email: account.email,
      username: account.username,
      displayName: account.displayName,
      avatar: fullAvatarUrl,
      bio: account.bio,
      header: fullHeaderUrl,
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.signOut = (req, res, next) => {
  res.clearCookie('jwt', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.sendStatus(200);
};
