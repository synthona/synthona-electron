// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');
const { regenerateCollectionPreviews } = require('../util/context');

// i dont think this is even being used tbh
exports.createCollection = async (req, res, next) => {
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
		const name = req.body.name || 'empty collection';
		const preview = req.body.preview || '';
		const newNode = {
			uuid: uuid.v4(),
			isFile: false,
			type: 'collection',
			name: name,
			preview: preview,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create node
		await knex('node').insert(newNode);
		// send response
		res.status(200).json({ collection: newNode });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.regenerateCollectionPreviews = async (req, res, next) => {
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
		await regenerateCollectionPreviews(userId, req);
		// UM! okay :) i think this works. nice job!
		// send back 200 status
		res.sendStatus(200);
	} catch (err) {
		console.log('uh something went wrong..');
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
