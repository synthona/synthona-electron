// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');

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
		// fetch all the collection nodes so we can process them...
		let nodeData = await knex('node').select().where({ type: 'collection', creator: userId });
		// loop through the collections so we can updat ethem :)
		for (let collection of nodeData) {
			const collectionUUID = collection.uuid;
			// fetch the top 4 associated nodes with the collection so we can use them for the preview
			const associationResult = await knex('association')
				.select()
				.where('association.nodeUUID', collectionUUID)
				.andWhere('association.creator', userId)
				.whereIn('node.type', ['image', 'text', 'url'])
				.orWhere('association.linkedNodeUUID', collectionUUID)
				.where('association.creator', userId)
				.whereIn('node.type', ['image', 'text', 'url'])
				.leftJoin('node', function () {
					this.onNotIn('node.uuid', collectionUUID)
						.on('association.nodeId', '=', 'node.id')
						.orOn('association.linkedNode', '=', 'node.id')
						.onNotIn('node.uuid', collectionUUID);
				})
				.orderBy('association.linkStrength', 'desc')
				.limit(4);
			// create the new preview array
			let updatedPreview = [];
			// loop through the associations to create the new preview array
			for (let association of associationResult) {
				let newPreviewPath = association.preview ? association.preview : '';
				// make sure we set the url correctly for files
				if (association.isFile) {
					newPreviewPath =
						req.protocol + '://' + req.get('host') + '/file/load/' + association.uuid;
				}
				updatedPreview.push({ type: association.type, preview: newPreviewPath });
			}
			// go ahead and set the updated preview for this particular collectionUUID
			await knex('node')
				.where({ uuid: collectionUUID })
				.update({ preview: JSON.stringify(updatedPreview) });
		}
		// UM! okay :) i think this works. nice job!
		// send back 200 status
		res.sendStatus(200);
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
