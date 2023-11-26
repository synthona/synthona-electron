// import dependencies
const express = require('express');
const { body } = require('express-validator/check');
// import data models
const knex = require('../db/knex/knex');
const authController = require('../controllers/auth');
// import auth middleware
const isAuth = require('../middleware/is-auth');
// set up router
const router = express.Router();

router.put(
	'/signup',
	[
		body('email')
			.exists()
			.isEmail()
			.withMessage('Please enter a valid email')
			.normalizeEmail()
			.custom(async (value, { req }) => {
				let user = await knex('user').select().where({ email: value }).first();
				if (user) {
					return Promise.reject('Email address already exists!');
				}
				return;
			}),
		body('password').exists().isString().trim().isLength({ min: 5 }),
		body('username')
			.exists()
			.isString()
			.trim()
			.custom(async (value, { req }) => {
				let user = await knex('user').select().where({ username: value }).first();
				if (user) {
					return Promise.reject('user already exists!');
				}
				return;
			}),
	],
	authController.signup
);

router.put(
	'/login',
	[
		body('email').exists().isEmail().normalizeEmail(),
		body('password').exists().trim().isString().isLength({ min: 5 }),
	],
	authController.login
);

router.put(
	'/forgot-password',
	[
		body('email').exists().isEmail().normalizeEmail(),
		body('newPassword').exists().trim().isString(),
		body('confirmNewPassword').exists().trim().isString(),
	],
	authController.forgotPassword
);

router.patch(
	'/password',
	isAuth,
	[
		body('oldPassword').exists().trim().isString().isLength({ min: 5 }),
		body('newPassword').exists().trim().isString().isLength({ min: 5 }),
	],
	authController.changePassword
);

router.get('/', isAuth, authController.isAuthenticated);

router.get('/signout', isAuth, authController.signOut);

// return the router
module.exports = router;
