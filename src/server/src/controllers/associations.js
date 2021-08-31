const { Op } = require('sequelize');
// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node, association } = require('../db/models');

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
		// prevent self association
		if (nodeUUID === linkedNodeUUID) {
			const error = new Error('Cannot associate node to itself');
			error.statusCode = 500;
			throw error;
		}
		// check database to make sure both nodes exist
		const nodeA = await node.findOne({
			where: {
				uuid: nodeUUID,
			},
		});
		const nodeB = await node.findOne({
			where: {
				uuid: linkedNodeUUID,
			},
		});
		// throw error if either is empty
		if (!nodeA || !nodeB) {
			const error = new Error('Could not find both nodes');
			error.statusCode = 404;
			throw error;
		}
		// check to see if association already exists
		const existingAssociation = await association.findAll({
			where: {
				[Op.and]: [
					{ nodeId: { [Op.or]: [nodeA.id, nodeB.id] } },
					{ linkedNode: { [Op.or]: [nodeA.id, nodeB.id] } },
				],
			},
		});
		// handle case where association already exists
		if (existingAssociation.length) {
			const error = new Error('Association already exists');
			error.statusCode = 500;
			throw error;
		}
		// create association
		const newAssociation = await association.create({
			nodeId: nodeA.id,
			nodeUUID: nodeA.uuid,
			nodeType: nodeA.type,
			linkedNode: nodeB.id,
			linkedNodeUUID: nodeB.uuid,
			linkedNodeType: nodeB.type,
			linkStrength: 1,
			creator: userId,
		});
		// load new association with node info for the linked node
		const result = await association.findOne({
			where: {
				nodeId: nodeA.id,
				linkedNode: nodeB.id,
			},
			attributes: ['id', 'nodeId', 'linkedNode'],
			include: [
				{
					model: node,
					as: 'associated',
					where: {
						id: newAssociation.linkedNode,
					},
					attributes: ['uuid', 'isFile', 'path', 'type', 'preview', 'name'],
				},
			],
		});
		// re-apply baseURL if node is a file
		if (result.associated.isFile || result.associated.type === 'user') {
			const fullUrl = result.associated.preview
				? req.protocol + '://' + req.get('host') + '/' + 'file/load/' + result.associated.uuid
				: null;
			result.associated.preview = fullUrl;
		}
		// send response with values
		res.status(200).json({ association: result });
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
		// fetch the node to get the internal ID
		var specificNode = await node.findOne({ where: { uuid: nodeUUID } });
		var nodeId = specificNode.id;
		// make a request to association table to get list of nodes to exclude
		const exclusionValues = await association.findAll({
			where: {
				[Op.or]: {
					nodeId: nodeId,
					linkedNode: nodeId,
				},
			},
			attributes: ['id', 'nodeId', 'linkedNode'],
			raw: true,
		});
		// create exclusionList to prevent re-association
		var exclusionList = [];
		exclusionValues.map((value) => {
			if (!exclusionList.includes(value.nodeId)) {
				exclusionList.push(value.nodeId);
			}
			if (!exclusionList.includes(value.linkedNode)) {
				exclusionList.push(value.linkedNode);
			}
			return;
		});
		// prevent self-association
		if (!exclusionList.includes(nodeId)) {
			exclusionList.push(nodeId);
		}
		// create WHERE statement for request to node table
		var whereStatement = {};
		var orderStatement = [];
		// set searchQuery
		if (searchQuery) {
			var splitQuery = searchQuery.split(' ');
			var fuzzySearch = '%';
			// TODO. i can make this even better by adding an additional OR query to the whereStatement
			// and just passing in the array there instead of into this cycler
			if (splitQuery.length > 0) {
				splitQuery.forEach((word) => {
					if (word) {
						fuzzySearch = fuzzySearch + word + '%';
					}
				});
			}
			whereStatement = {
				[Op.and]: [
					// look for text match for the name
					{
						name: { [Op.like]: '%' + fuzzySearch + '%' },
					},
					// prevent association with exclusionList
					{
						id: { [Op.not]: exclusionList },
					},
				],
			};
			orderStatement = [['name', 'ASC']];
		} else {
			// prevent association with exclusionList
			whereStatement = {
				[Op.and]: [
					{
						id: { [Op.not]: exclusionList },
					},
				],
			};
			// if there is no search query, provide
			// the most recent nodes by default
			orderStatement = [['updatedAt', 'DESC']];
		}
		// don't fetch hidden/searchable nodes unless
		// the node in question is also hidden/searchable
		if (!specificNode.searchable) {
			whereStatement[Op.and].push({
				searchable: false,
			});
		}
		if (!specificNode.hidden) {
			whereStatement[Op.and].push({
				hidden: false,
			});
		}
		// limit results to those created by yourself????
		// TODO: revisit this and think about how it works on multiuser server
		whereStatement.creator = userId;
		// retrieve nodes for the requested page
		const result = await node.findAll({
			where: whereStatement,
			limit: resultLimit,
			order: orderStatement,
			attributes: ['uuid', 'name'],
		});
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
		var perPage = 30;
		// fetch the node to get the internal ID
		var specificNode = await node.findOne({ where: { uuid: nodeUUID } });
		if (!specificNode) {
			const error = new Error('Could not find  node');
			error.statusCode = 404;
			throw error;
		}
		var nodeId = specificNode.id;
		// get the total node count
		const data = await association.findAndCountAll({
			where: {
				creator: userId,
				[Op.or]: [{ nodeId: nodeId }, { linkedNode: nodeId }],
			},
		});
		// retrieve nodes for the requested page
		const totalItems = data.count;
		const result = await association.findAll({
			where: {
				creator: userId,
				[Op.or]: [{ nodeId: nodeId }, { linkedNode: nodeId }],
				// nodeId: nodeId,
			},
			offset: (currentPage - 1) * perPage,
			limit: perPage,
			// sort by linkStrength
			order: [['updatedAt', 'DESC']],
			attributes: [
				'id',
				'nodeId',
				'nodeType',
				'linkedNode',
				'linkedNodeType',
				'linkStrength',
				'updatedAt',
			],
			// include whichever node is the associated one for
			include: [
				{
					model: node,
					where: { id: { [Op.not]: nodeId } },
					required: false,
					as: 'original',
					attributes: ['id', 'uuid', 'isFile', 'path', 'type', 'preview', 'name'],
				},
				{
					model: node,
					where: { id: { [Op.not]: nodeId } },
					required: false,
					as: 'associated',
					attributes: ['id', 'uuid', 'isFile', 'path', 'type', 'preview', 'name'],
				},
			],
		});

		var associations = [];
		// condense results to one list
		result.forEach((association) => {
			if (association.original !== null) {
				associations.push(association.original);
			} else if (association.associated !== null) {
				associations.push(association.associated);
			}
		});
		// TODO!!!! re-apply the base of the image URL (this shouldn't be here lmao. this is only text nodes)
		// i got way ahead of myself refactoring today and basically created a huge mess
		const results = associations.map((item) => {
			if (item.isFile || item.type === 'user') {
				const fullUrl = item.preview
					? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
					: null;
				item.preview = fullUrl;
			}
			return item;
		});
		// send response
		res.status(200).json({ associations: results, totalItems: totalItems });
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
		// find the association in question
		const result = await association.findOne({
			where: {
				creator: userId,
				[Op.and]: [
					{ nodeUUID: { [Op.or]: [nodeA, nodeB] } },
					{ linkedNodeUUID: { [Op.or]: [nodeA, nodeB] } },
				],
			},
			attributes: ['id', 'nodeId', 'nodeType', 'linkedNode', 'linkedNodeType'],
		});
		if (!result) {
			const error = new Error('Could not find association');
			error.statusCode = 404;
			throw error;
		}
		// set deletedId
		var deletedUUID = nodeB;
		// delete the association from the database
		result.destroy();
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
		// find the association in question
		const result = await association.findOne({
			where: {
				creator: userId,
				[Op.and]: [
					{ nodeUUID: { [Op.or]: [nodeA, nodeB] } },
					{ linkedNodeUUID: { [Op.or]: [nodeA, nodeB] } },
				],
			},
		});
		if (result) {
			// increment it by 1
			result.linkStrength++;
			result.save();
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
