const { validationResult } = require('express-validator/check');
// bring in data models.
const knex = require('../db/knex/knex');
const day = require('dayjs');

exports.createAssociation = async (req, res, next) => {
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
		const nodeUUID = req.body.nodeUUID;
		const linkedNodeUUID = req.body.linkedNodeUUID;
		// prevent self association ?
		// hmm i might actually remove this
		if (nodeUUID === linkedNodeUUID) {
			const error = new Error('Cannot associate node to itself');
			error.statusCode = 500;
			throw error;
		}
		// we're going to make sure both nodes exist. we should have 2 results
		const node = await knex('node').where({ uuid: nodeUUID }).first();
		const linkedNode = await knex('node').where({ uuid: linkedNodeUUID }).first();
		// throw error if either is empty
		if (!node || !linkedNode) {
			const error = new Error('Could not find both nodes');
			error.statusCode = 404;
			throw error;
		}
		// check to see if association already exists
		const existingAssociation = await knex('association')
			.whereIn('nodeId', [node.id, linkedNode.id])
			.whereIn('linkedNode', [node.id, linkedNode.id])
			.first();
		let newAssociation;
		// if association already exists update linkStart to be 1
		if (existingAssociation) {
			// set the linkStart value
			existingAssociation.linkStart = 1;
			// set the newAssociation value to the updated associaiotn value
			newAssociation = existingAssociation;
			// store this in the DB too (havent tested this yet)
			await knex('association').update({ linkStart: 1 }).where({ id: existingAssociation.id });
		}
		// handle case where there are no current matches
		else {
			// create association
			newAssociation = {
				nodeId: node.id,
				nodeUUID: node.uuid,
				nodeType: node.type,
				linkedNode: linkedNode.id,
				linkedNodeUUID: linkedNode.uuid,
				linkedNodeType: linkedNode.type,
				linkStrength: 1,
				linkStart: null,
				creator: userId,
				createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			};
			// add this one in the database!
			let result = await knex('association').insert(newAssociation);
			newAssociation.id = result[0];
		}
		// re-apply baseURL if linkedNode is a file
		if (linkedNode.isFile || linkedNode.type === 'user') {
			const fullUrl = linkedNode.preview
				? req.protocol + '://' + req.get('host') + '/' + 'file/load/' + linkedNode.uuid
				: null;
			linkedNode.preview = fullUrl;
		}
		// re-apply baseURL if node is a file
		if (node.isFile || node.type === 'user') {
			const fullUrl = node.preview
				? req.protocol + '://' + req.get('host') + '/' + 'file/load/' + node.uuid
				: null;
			node.preview = fullUrl;
		}
		// send response with values
		res.status(200).json({ association: newAssociation, linkedNode, node });
		// res.status(200);
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

// get values for autocompleting the add association search bar
exports.associationAutocomplete = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// store request variables
		var resultLimit = 23;
		var searchQuery = req.query.searchQuery || '';
		var nodeUUID = req.query.nodeUUID;
		var bidirectional = req.query.bidirectional === 'yes' ? true : false;
		// get a list of nodes to exclude from the autocomplete
		const exclusionSubquery = knex('association')
			.select('node.id')
			.modify((queryBuilder) => {
				if (bidirectional) {
					// if bidirectional mode is enabled exclude any nodes already in association with us
					queryBuilder
						.where('association.nodeUUID', nodeUUID)
						.orWhere('association.linkedNodeUUID', nodeUUID);
				} else {
					// unidirectional mode..we're pickier here.
					// we only want (linkStart == null && nodeUUID == nodeUUID) or
					// (linkStart == 1 && linkedNodeUUID == nodeUUID) for autocomplete
					queryBuilder
						.where('association.nodeUUID', nodeUUID)
						.orWhere('association.linkedNodeUUID', nodeUUID)
						.andWhere('association.linkStart', 1);
				}
			})
			.leftJoin('node', function () {
				this.on('association.nodeId', '=', 'node.id').orOn(
					'association.linkedNode',
					'=',
					'node.id'
				);
			});

		const result = await knex('node')
			.select()
			.where({ creator: userId })
			.modify((queryBuilder) => {
				if (searchQuery) {
					if (searchQuery) {
						var splitQuery = searchQuery.split(' ');
						var fuzzySearch = '%';
						if (splitQuery.length > 0) {
							splitQuery.forEach((word) => {
								if (word) {
									fuzzySearch = fuzzySearch + word + '%';
								}
							});
						}
						queryBuilder.andWhereLike('node.name', fuzzySearch);
					}
				}
			})
			.whereNotIn('node.id', exclusionSubquery)
			.whereNotIn('node.uuid', [nodeUUID])
			.orderBy('node.updatedAt', 'desc')
			.limit(resultLimit);
		// send response
		res.status(200).json({ nodes: result });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

// get associations for a given node
exports.getAssociationsByUUID = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
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
		var currentPage = req.query.page || 1;
		var nodeUUID = req.query.nodeUUID;
		var bidirectional = req.query.bidirectional === 'yes' ? true : false;
		var perPage = 30;
		// go ahead and make our query
		const nodeResult = await knex('association')
			.select()
			.where('association.creator', userId)
			.modify((queryBuilder) => {
				if (bidirectional) {
					// if bidirectional mode is enabled exclude any nodes already in association with us
					queryBuilder
						.where('association.nodeUUID', nodeUUID)
						.orWhere('association.linkedNodeUUID', nodeUUID);
				} else {
					// unidirectional mode..we're pickier here.
					// we only want (linkStart == null && nodeUUID == nodeUUID) or
					// (linkStart == 1 && linkedNodeUUID == nodeUUID) for autocomplete
					queryBuilder
						.where('association.nodeUUID', nodeUUID)
						.orWhere('association.linkedNodeUUID', nodeUUID)
						.andWhere('association.linkStart', 1);
				}
			})
			.leftJoin('node', function () {
				this.onNotIn('node.uuid', nodeUUID)
					.on('association.nodeId', '=', 'node.id')
					.orOn('association.linkedNode', '=', 'node.id')
					.onNotIn('node.uuid', nodeUUID);
			})
			.offset((currentPage - 1) * perPage)
			// .orderBy('node.updatedAt', 'desc')
			.orderBy('association.linkStrength', 'desc')
			.limit(perPage);

		// we have to make a separate query to the get the count
		const countResult = await knex('association')
			.select()
			.where('association.creator', userId)
			.modify((queryBuilder) => {
				if (bidirectional) {
					// if bidirectional mode is enabled exclude any nodes already in association with us
					queryBuilder
						.where('association.nodeUUID', nodeUUID)
						.orWhere('association.linkedNodeUUID', nodeUUID);
				} else {
					// unidirectional mode..we're pickier here.
					// we only want (linkStart == null && nodeUUID == nodeUUID) or
					// (linkStart == 1 && linkedNodeUUID == nodeUUID) for autocomplete
					queryBuilder
						.where('association.nodeUUID', nodeUUID)
						.orWhere('association.linkedNodeUUID', nodeUUID)
						.andWhere('association.linkStart', 1);
				}
			})
			.leftJoin('node', function () {
				this.onNotIn('node.uuid', nodeUUID)
					.on('association.nodeId', '=', 'node.id')
					.orOn('association.linkedNode', '=', 'node.id')
					.onNotIn('node.uuid', nodeUUID);
			})
			.count('node.id as count')
			.distinct('node.uuid')
			.first();
		// go ahead and apply the baseURL for images and files
		const results = nodeResult.map((item) => {
			if (item.isFile || item.type === 'user') {
				const fullUrl = item.preview
					? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
					: null;
				item.preview = fullUrl;
			}
			return item;
		});
		// send response
		res.status(200).json({ associations: results, totalItems: countResult.count });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.deleteAssociation = async (req, res, next) => {
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
		// store variables from request
		const nodeA = req.query.nodeA;
		const nodeB = req.query.nodeB;
		const bidirectionalDelete = req.query.bidirectional === 'yes' ? true : false;
		// fetch the association
		const result = await knex('association')
			.select()
			.where({ creator: userId })
			.whereIn('nodeUUID', [nodeA, nodeB])
			.whereIn('linkedNodeUUID', [nodeA, nodeB])
			.first();

		// handle null case
		if (!result) {
			const error = new Error('Could not find any associations matching ' + nodeA + ' or ' + nodeB);
			error.statusCode = 404;
			throw error;
		}
		// if it was bidirectional we need to set it back to unidirectional and set nodeUUID and nodeID to the values from
		// whichever node nodeB is if nodeB is not already the anchornode/nodeId column
		if (result.linkStart === 1 && !bidirectionalDelete) {
			// if nodeB is already the anchor nodeId, all we have to do is update linkStart to null
			if (result.nodeUUID === nodeB) {
				// lets go ahead and set linkStart to null in the database
				await knex('association').update({ linkStart: null }).where({ id: result.id });
			}
			// if nodeB is not the anchor node (nodeId), we need to swap them since nodeId is always
			// expected to be the anchor for unidirectional links
			else {
				// updated data object
				let updatedAssociation = {
					linkStart: null,
					nodeId: result.linkedNode,
					nodeUUID: result.linkedNodeUUID,
					nodeType: result.linkedNodeType,
					linkedNode: result.nodeId,
					linkedNodeUUID: result.nodeUUID,
					linkedNodeType: result.nodeType,
					updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				};
				// lets go ahead and update in the database
				await knex('association').update(updatedAssociation).where({ id: result.id });
			}
		}
		// if there's a link and it only goes one way we can delete it
		else {
			// delete the association from the database
			await knex('association').where({ id: result.id }).delete();
		}
		// set deletedId
		var deletedUUID = nodeB;
		// send response with success message
		res.status(200).json({ message: 'deleted association', deletedUUID });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.updateLinkStrength = async (req, res, next) => {
	const errors = validationResult(req);
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// store variables from request
		const nodeA = req.body.nodeA;
		const nodeB = req.body.nodeB;
		// fetch the association
		const result = await knex('association')
			.select()
			.where({ creator: userId })
			.whereIn('nodeUUID', [nodeA, nodeB])
			.whereIn('linkedNodeUUID', [nodeA, nodeB])
			.first();

		// take our result and increment the linkStrength value
		if (result) {
			await knex('association')
				.increment('linkStrength', 1)
				.where({ creator: userId })
				.whereIn('nodeUUID', [nodeA, nodeB])
				.whereIn('linkedNodeUUID', [nodeA, nodeB]);
		} else {
			const error = new Error('Could not find association between ' + nodeA + ' and ' + nodeB);
			error.statusCode = 422;
			throw error;
		}
		// send response with success message
		res.status(200).json({ message: 'updated link strength' });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
