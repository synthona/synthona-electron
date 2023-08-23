// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const knex = require('../db/knex/knex');

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
