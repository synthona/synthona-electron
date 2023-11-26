// import dependencies
const express = require('express');
const { body, query } = require('express-validator/check');
// import controller
const userController = require('../controllers/users');
// import route middleware
const isAuth = require('../middleware/is-auth');
const userFileUpload = require('../middleware/user-file');
// import data models
const knex = require('../db/knex/knex');
// set up router
const router = express.Router();

// Get basic profile info by username
router.get(
	'/username',
	isAuth,
	[query('username').exists().isString()],
	userController.getUserByUsername
);

// Get basic profile info by email
// doesn't even look like this is being used right now tbh
router.get(
	'/email',
	isAuth,
	[
		query('email')
			.exists()
			.isString()
			.custom(async (value, { req }) => {
				const tokenUid = parseInt(req.user.uid);
				let user = await knex('user').select().where({ email: value }).first();
				// only let users fetch their own profile by email
				if (user.id !== tokenUid) {
					return Promise.reject('You are not authorized to make this request!');
				}
				return;
			}),
	],
	userController.getUserByEmail
);

// update user by username
router.patch(
	'/info',
	isAuth,
	[
		body('username')
			.exists()
			.isString()
			.custom(async (value, { req }) => {
				const tokenUid = parseInt(req.user.uid);
				let user = await knex('user').select().where({ username: value }).first();
				// only let users edit their own profile
				if (user.id !== tokenUid) {
					return Promise.reject('You are not authorized to make this request!');
				}
				return;
			}),
		body('displayName').optional().isString(),
		body('bio').optional().isString(),
	],
	userController.setUserInfo
);

// need to update this so you can only update your own
router.patch('/avatar', isAuth, userFileUpload, userController.setAvatar);

// need to update this so you can only update your own
router.patch('/header', isAuth, userFileUpload, userController.setHeaderImage);

// load user avatar by uuid
router.get('/load/avatar/:uuid', userController.loadUserAvatar);

// load user header by uuid
router.get('/load/header/:uuid', userController.loadUserHeader);

// update the username
router.patch(
	'/username',
	isAuth,
	[
		body('username')
			.exists()
			.isString()
			.custom(async (value, { req }) => {
				let user = await knex('user').select().where({ username: value }).first();
				// only let users change their name to an available username
				if (user) {
					return Promise.reject('That username is already in use!');
				}
				return;
			}),
	],
	userController.setUsername
);

// update the email
router.patch(
	'/email',
	isAuth,
	[
		body('email')
			.exists()
			.isString()
			.isEmail()
			.custom(async (value, { req }) => {
				let user = await knex('user').select().where({ email: value }).first();
				// only let users change their email to an available email
				if (user) {
					return Promise.reject('That email address is already in use!');
				}
				return;
			}),
	],
	userController.setEmail
);

router.patch(
	'/clear',
	isAuth,
	[body('password').exists().trim().isString().isLength({ min: 5 })],
	userController.clearAllDataByUser
);

// return the router
module.exports = router;
