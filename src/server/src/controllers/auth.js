// import environment variables
require('dotenv').config();
// import packages
const { validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
// custom code
const tokens = require('../util/tokens');
// bring in data models.
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');

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
		const userUUID = uuid.v4();
		// create account
		const newUser = {
			nodeId: userUUID,
			email: email,
			password: hash,
			username: username,
			displayName: username,
			bio: bio,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create node
		const result = await knex('user').insert(newUser);
		const userId = result[0];
		// generate token
		const token = tokens.generateToken({ id: userId });
		const refreshToken = tokens.generateRefreshToken({ id: userId, password });
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
		const newNode = {
			uuid: userUUID,
			isFile: false,
			type: 'user',
			name: username,
			path: username,
			comment: bio,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create node
		await knex('node').insert(newNode);
		// send the response
		res.status(201).json({
			email: email,
			username: username,
			displayName: username,
			bio: bio,
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
		const requestEmail = req.body.email;
		const password = req.body.password;
		// retrieve account
		const account = await knex('user').select().where({ email: requestEmail }).first().limit(1);
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
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
		const updatedUser = {
			...account,
			password: hash,
		};
		await knex('user').where({ id: uid }).update({ password: hash });
		// generate new token
		const newToken = tokens.generateToken(updatedUser);
		const newRefreshToken = tokens.generateRefreshToken(updatedUser);
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
		const requestEmail = req.body.email;
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
		const account = await knex('user').select().where({ email: requestEmail }).first().limit(1);
		// catch error if no account is found
		if (!account) {
			const error = new Error('A user with this uid could not be found');
			error.statusCode = 401;
			throw error;
		}
		// // update password
		const hash = await bcrypt.hash(newPassword, 12);
		const updatedUser = {
			...account,
			password: hash,
		};
		await knex('user').where({ email: requestEmail }).update({ password: hash });
		// generate new token
		const newToken = tokens.generateToken(updatedUser);
		const newRefreshToken = tokens.generateRefreshToken(updatedUser);
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
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
