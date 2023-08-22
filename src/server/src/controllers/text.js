// custom code
const { validationResult } = require('express-validator/check');
const context = require('../util/context');
// bring in data models.
const { node } = require('../db/models');
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');

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
		const newNode = {
			uuid: uuid.v4(),
			isFile: false,
			type: 'text',
			name: name,
			preview: preview,
			content: content,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create text node
		await knex('node').insert(newNode);
		// send response
		res.status(200).json({ uuid: newNode.uuid });
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
		const textNode = await knex('node')
			.select('uuid', 'name', 'type', 'preview', 'content', 'updatedAt')
			.where({ uuid: uuid })
			.first()
			.limit(1);
		// make sure we got a result
		if (!textNode) {
			const error = new Error('Could not find text node');
			error.statusCode = 404;
			throw error;
		}
		// send response
		res.status(200).json({ textNode: textNode });
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
		let textNode = await knex('node').select().where({ uuid: uuid }).first().limit(1);
		// make sure we got a result
		if (!textNode) {
			const error = new Error('Could not find text node');
			error.statusCode = 404;
			throw error;
		}
		// update any values that have been changed
		let updatedContent = req.body.content ? req.body.content : textNode.content;
		// update in the database
		await knex('node').where({ uuid }).update({ content: updatedContent });
		// set up return value
		textNode.content = updatedContent;
		const result = textNode;
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
		// load text node
		const textNode = await knex('node').select().where({ uuid: uuid }).first().limit(1);
		// make sure we got a result
		if (!textNode) {
			const error = new Error('Could not find text node');
			error.statusCode = 404;
			throw error;
		}
		// update any values that have been changed
		let updatedPreview = req.body.preview ? req.body.preview : textNode.preview;
		// update in the database
		await knex('node').where({ uuid }).update({ preview: updatedPreview });
		// set up return value
		textNode.preview = updatedPreview;
		const result = textNode;
		// return result
		res.status(200).json({ node: result });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
