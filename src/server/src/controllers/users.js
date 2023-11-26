const path = require('path');
var fs = require('fs');
// import packages
const { validationResult } = require('express-validator/check');
const bcrypt = require('bcryptjs');
// bring in data models.
const knex = require('../db/knex/knex');
const day = require('dayjs');
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
		const account = await knex('user')
			.select('username', 'nodeId', 'displayName', 'bio', 'avatar', 'header')
			.where({ username: username })
			.first()
			.limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		if (account.avatar) {
			// add server info to image urls
			account.avatar = account.avatar
				? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId
				: null;
		}
		if (account.header) {
			account.header = account.header
				? req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId
				: null;
		}
		// send response
		res.status(200).json({ user: account });
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
		const reqEmail = req.query.email;
		// load user
		const account = await knex('user')
			.select('username', 'email', 'displayName', 'bio', 'avatar', 'header')
			.where({ email: reqEmail })
			.first()
			.limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		if (account.avatar) {
			// add server info to image urls
			account.avatar = account.avatar
				? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId
				: null;
		}
		if (account.header) {
			account.header = account.header
				? req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId
				: null;
		}
		// send response
		res.status(200).json({ user: account });
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
		const account = await knex('user').select().where({ username: username }).first().limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		// update any values that have been changed
		account.displayName = req.body.displayName ? req.body.displayName : account.displayName;
		account.bio = req.body.bio ? req.body.bio : account.bio;
		await knex('user')
			.where({ username: username })
			.update({
				displayName: account.displayName,
				bio: account.bio,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// update the associated user node if necessary
		if (req.body.bio || req.body.displayName) {
			await knex('node')
				.where({ creator: uid, type: 'user' })
				.update({
					name: account.displayName,
					content: account.bio,
					updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				});
		}
		if (account.avatar) {
			// add server info to image urls
			account.avatar = account.avatar
				? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId
				: null;
		}
		if (account.header) {
			account.header = account.header
				? req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId
				: null;
		}
		// return result
		res.status(200).json({ user: account });
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		// process request
		const username = req.body.username;
		// update any values that have been changed
		account.username = username ? username : account.username;
		// update the value in the DB
		await knex('user')
			.where({ id: uid })
			.update({
				username: account.username,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// update the associated user node if necessary
		if (req.body.username) {
			await knex('node')
				.where({ creator: uid, type: 'user' })
				.update({
					path: account.username,
					updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				});
		}
		if (account.avatar) {
			// add server info to image urls
			account.avatar = account.avatar
				? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId
				: null;
		}
		if (account.header) {
			account.header = account.header
				? req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId
				: null;
		}
		// return result
		res.status(200).json({ user: account });
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		// process request
		const email = req.body.email;
		// update any values that have been changed
		account.email = email ? email : account.email;
		// update the value in the DB
		await knex('user')
			.where({ id: uid })
			.update({
				email: account.email,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// add server info to image urls
		if (account.avatar) {
			account.avatar = account.avatar
				? req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId
				: null;
		}
		if (account.header) {
			account.header = account.header
				? req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId
				: null;
		}
		// return result
		res.status(200).json({ user: account });
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		// delete the old file if needed
		if (account.avatar) {
			var filePath = path.resolve(account.avatar);
			// remove the file if it was stored inside the synthona data structure
			let shouldClearFile = filePath.includes(path.join(__coreDataDir, 'data', uid, 'user'));
			// remove the file if needed
			if (shouldClearFile && fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
				// clean up any empty folders created by this deletion
				await fsUtil.cleanupDataDirectoryFromFilePath(filePath);
			}
		}
		// update the header url
		account.avatar = imageUrl;
		// update the user in the DB
		await knex('user')
			.where({ id: uid })
			.update({
				avatar: account.avatar,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// update the associated user node
		await knex('node')
			.where({ creator: uid, type: 'user' })
			.update({
				preview: account.avatar,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// set up the avatarUrl return value
		const avatarUrl =
			req.protocol + '://' + req.get('host') + '/user/load/avatar/' + account.nodeId;
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
		// check for errors
		if (!account) {
			const error = new Error('Could not find user');
			error.statusCode = 404;
			throw error;
		}
		// delete the old file if needed
		if (account.header) {
			var filePath = path.resolve(account.header);
			// remove the file if it was stored inside the synthona data structure
			let shouldClearFile = filePath.includes(path.join(__coreDataDir, 'data', uid, 'user'));
			// remove the file if needed
			if (shouldClearFile && fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
				// clean up any empty folders created by this deletion
				await fsUtil.cleanupDataDirectoryFromFilePath(filePath);
			}
		}
		// update the header url
		account.header = imageUrl;
		// update the user in the DB
		await knex('user')
			.where({ id: uid })
			.update({
				header: account.header,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// set up the headerUrl return value
		const headerUrl =
			req.protocol + '://' + req.get('host') + '/user/load/header/' + account.nodeId;
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
		// load user
		const account = await knex('user').select('avatar').where({ nodeId: uuid }).first().limit(1);
		// make sure there is a preview and then respond
		if (account && account.avatar) {
			const imagePath = path.resolve(account.avatar);
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
		const account = await knex('user').select('header').where({ nodeId: uuid }).first().limit(1);
		// make sure there is a preview and then respond
		if (account && account.header) {
			const imagePath = path.resolve(account.header);
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
		const account = await knex('user').select().where({ id: uid }).first().limit(1);
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
		// delete node and send response
		await knex('node').where({ creator: uid }).andWhereNot({ type: 'user' }).delete();
		await knex('association').where({ creator: uid }).delete();
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
