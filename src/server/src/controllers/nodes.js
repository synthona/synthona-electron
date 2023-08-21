const path = require('path');
var fs = require('fs');
// bring in data models.
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');
// custom code
const { validationResult } = require('express-validator/check');
const context = require('../util/context');
const fsUtil = require('../util/fsUtil');

exports.createNode = async (req, res, next) => {
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
		const type = req.body.type;
		const name = req.body.name;
		const isFile = req.body.isFile;
		const preview = req.body.preview;
		const content = req.body.content;
		const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
		const path =
			req.body.type === 'url' || (req.body.type === 'image' && req.body.isFile === false)
				? req.body.preview
				: null;
		// userId comes from the is-auth middleware
		const userId = req.user.uid;
		// object to store newnode
		let newNode = {
			uuid: uuid.v4(),
			isFile: isFile,
			type: type,
			name: name,
			path: path,
			preview: preview,
			content: content,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create node
		const result = await knex('node').insert(newNode);
		// if there is a linkedNode passed in, associate it
		if (linkedNode) {
			// make sure linkedNode exists
			const nodeB = await knex('node').select().where({ uuid: linkedNode.uuid }).first();
			// make sure we got a result
			if (nodeB) {
				// create association
				await knex('association').insert({
					nodeId: result[0],
					nodeUUID: newNode.uuid,
					nodeType: newNode.type,
					linkedNode: nodeB.id,
					linkedNodeUUID: nodeB.uuid,
					linkedNodeType: nodeB.type,
					linkStrength: 1,
					creator: userId,
					createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
					updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				});
			}
		}
		// send response
		res.status(200).json({ node: newNode });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.getNodeByUUID = async (req, res, next) => {
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
		// load node
		const result = await knex('node')
			.select(
				'uuid',
				'isFile',
				'comment',
				'metadata',
				'type',
				'name',
				'preview',
				'content',
				'path',
				'pinned',
				'updatedAt'
			)
			.where({ uuid: uuid })
			.first()
			.limit(1);
		// make sure we have a result
		if (!result) {
			const error = new Error('Could not find  node');
			error.statusCode = 404;
			throw error;
		}
		// add full file url
		if (result.isFile || result.type === 'user') {
			result.preview = result.preview
				? req.protocol + '://' + req.get('host') + '/file/load/' + result.uuid
				: null;
		}
		// send response
		res.status(200).json({ node: result });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.getRandomNode = async (req, res, next) => {
	try {
		// this comes from the is-auth middleware
		const userId = req.user.uid;
		// load random node
		const result = await knex('node')
			.select(
				'id',
				'uuid',
				'isFile',
				'comment',
				'metadata',
				'type',
				'name',
				'preview',
				'content',
				'path',
				'pinned',
				'updatedAt'
			)
			.orderByRandom()
			.where({ creator: userId })
			.limit(1)
			.first();
		// make sure we got a result
		if (!result) {
			const error = new Error('Could not find  node');
			error.statusCode = 404;
			throw error;
		}
		// add full file url
		if (result.isFile || result.type === 'user') {
			result.preview = result.preview
				? req.protocol + '://' + req.get('host') + '/file/load/' + result.uuid
				: null;
		}
		// send response
		res.status(200).json({ node: result });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.markNodeView = async (req, res, next) => {
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
		context.markNodeView(uuid);
		// send response
		res.sendStatus(200);
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.updateNode = async (req, res, next) => {
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
		// load node
		const existingNode = await knex('node').select().where({ uuid }).first();
		// make sure existing node exists
		if (!existingNode) {
			const error = new Error('Could not find node');
			error.statusCode = 404;
			throw error;
		}
		const name = req.body.name ? req.body.name : existingNode.name;
		const preview =
			req.body.preview || req.body.preview === '' ? req.body.preview : existingNode.preview;
		const path = req.body.path ? req.body.path : existingNode.path;
		const content = req.body.content ? req.body.content : existingNode.content;
		const pinned = typeof req.body.pinned === 'boolean' ? req.body.pinned : existingNode.pinned;
		// create object for updating in the DB
		let updatedNode = {
			name,
			preview,
			path,
			content,
			pinned,
			// updatedAt: day().format(`YYYY-MM-DD HH:mm:ss.sssZ`), // something about this is not right...have to look into it. maybe just remove it. i dont think it was here before
		};
		// update in the database
		await knex('node').where({ uuid }).update(updatedNode);
		// update valeus that have changed for our return value
		existingNode.name = name;
		existingNode.preview = preview;
		existingNode.path = path;
		existingNode.content = content;
		existingNode.pinned = pinned;
		// it's an file, re-apply the baseURL
		if (existingNode.isFile || existingNode.type === 'user') {
			const fullUrl = existingNode.preview
				? req.protocol + '://' + req.get('host') + '/file/load/' + existingNode.uuid
				: null;
			existingNode.preview = fullUrl;
		}
		// return result
		res.status(200).json({ node: existingNode });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.searchNodes = async (req, res, next) => {
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
		// var perPage = 15;
		var perPage = 30;
		var type = req.query.type || null;
		var searchQuery = req.query.searchQuery || '';
		var pinned = req.query.pinned || null;
		var sortType = req.query.sortType || 'updatedAt';
		var sortOrder = req.query.sortOrder || 'DESC';

		if (sortType) {
			switch (sortType) {
				case 'recent':
					sortType = 'updatedAt';
					break;
				case 'created':
					sortType = 'createdAt';
					break;
				case 'views':
					sortType = 'views';
					break;
				default:
					sortType = 'updatedAt';
					break;
			}
		}
		if (sortOrder) {
			switch (sortOrder) {
				case 'ASC':
					sortOrder = 'ASC';
					break;
				case 'DESC':
					sortOrder = 'DESC';
					break;
				default:
					sortOrder = 'DESC';
					break;
			}
		}

		let fuzzySearch = '';
		if (searchQuery) {
			fuzzySearch = searchQuery.toLowerCase().replace(' ', '%');
		}

		// make our query
		const data = await knex('node')
			.select('uuid', 'isFile', 'name', 'path', 'type', 'preview', 'views', 'updatedAt')
			.where({ creator: userId })
			.modify((queryBuilder) => {
				// add sortType and sortOrder
				if (sortType && sortOrder) {
					queryBuilder.orderBy(sortType, sortOrder);
				}
				// add pinned check if we need to
				if (pinned) queryBuilder.andWhereLike('pinned', true);
				// add type check if we need to
				if (type) queryBuilder.andWhereLike('type', type);
				// add the query in here
				if (searchQuery) {
					queryBuilder.andWhereLike('name', `${'%' + fuzzySearch + '%'}`);
					queryBuilder.orWhereLike('name', `${'%' + searchQuery + '%'}`);
					queryBuilder.orWhereLike('content', `${'%' + searchQuery + '%'}`);
					queryBuilder.orWhereLike('content', `${'%' + fuzzySearch + '%'}`);
				}
			})
			.offset((currentPage - 1) * perPage)
			.limit(perPage);
		// retrieve nodes for the requested page
		const totalItems = await knex('node')
			.select('uuid', 'isFile', 'name', 'path', 'type', 'preview', 'views', 'updatedAt')
			.where({ creator: userId })
			.modify((queryBuilder) => {
				// add sortType and sortOrder
				if (sortType && sortOrder) {
					queryBuilder.orderBy(sortType, sortOrder);
				}
				// add pinned check if we need to
				if (pinned) queryBuilder.andWhereLike('pinned', true);
				// add type check if we need to
				if (type) queryBuilder.andWhereLike('type', type);
				// add the query in here
				if (searchQuery) {
					queryBuilder.andWhereLike('name', `${'%' + fuzzySearch + '%'}`);
					queryBuilder.orWhereLike('name', `${'%' + searchQuery + '%'}`);
					queryBuilder.orWhereLike('content', `${'%' + searchQuery + '%'}`);
					queryBuilder.orWhereLike('content', `${'%' + fuzzySearch + '%'}`);
				}
			})
			.count('id as count')
			.first();
		// loop through the results and apply the file basis
		const results = data.map((item) => {
			// TODO - > can i move this step client side? it will save a lot of trouble
			if (item.isFile || item.type === 'user') {
				const fullUrl = item.preview
					? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
					: null;
				item.preview = fullUrl;
			}
			return item;
		});
		// send response
		res.status(200).json({ nodes: results, totalItems: totalItems.count });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

// delete a single node and any associations
exports.clearNodePreview = async (req, res, next) => {
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
		// update the node with the new full path
		const result = await knex('node')
			.where({ uuid: uuid })
			.update({
				preview: null,
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			});
		// send response
		res.status(200).json({ node: result });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

// delete a single node and any associations
exports.deleteNodeByUUID = async (req, res, next) => {
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
		const nodeToDelete = await knex('node').where({ uuid: uuid }).first();
		// make sure we got something here
		if (!nodeToDelete) {
			const error = new Error('Could not find node');
			error.statusCode = 404;
			throw error;
		}
		// if the node is a file, check if we need to delete from the file system
		if (nodeToDelete.isFile && nodeToDelete.path) {
			var filePath = path.join(nodeToDelete.path);
			// remove the file if it exists & is in the synthona core data directory
			if (fs.existsSync(filePath) && filePath.includes(__coreDataDir)) {
				fs.unlinkSync(filePath);
				// clean up any empty folders created by this deletion
				fsUtil.cleanupDataDirectoryFromFilePath(filePath);
			}
		}
		// delete associations
		context.deleteAssociations(nodeToDelete.id);
		// delete node and send response
		await knex('node').where({ uuid: uuid }).first().delete();
		// send 200 response
		res.sendStatus(200);
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

// get the data for the graph display
// TODO: there is probably room for optimization here
exports.getGraphData = async (req, res, next) => {
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
		const perPage = req.query.graphRenderLimit || 100;
		const anchorNode = req.query.anchorNode;
		var bidirectional = req.query.bidirectional === 'yes' ? true : false;
		let nodeList = [];
		let associations = [];
		// check if there's an anchorNode or not
		if (anchorNode) {
			// load anchornode
			const anchor = await knex('node')
				.select(
					'id',
					'uuid',
					'isFile',
					'comment',
					'metadata',
					'type',
					'name',
					'preview',
					'content',
					'path',
					'pinned',
					'updatedAt'
				)
				.where({ uuid: anchorNode })
				.andWhere({ creator: userId })
				.first()
				.limit(1);
			// add it to the list
			nodeList = nodeList.concat(anchor);
			// fetch the nodes
			let result = await knex
				.select('*')
				.from('association')
				.where('association.creator', userId)
				.andWhere('node.creator', userId)
				.andWhere('association.nodeUUID', anchorNode)
				.orWhere('association.linkedNodeUUID', anchorNode)
				.modify((queryBuilder) => {
					// include bidirectional results if needed
					if (!bidirectional) {
						queryBuilder.andWhere('association.linkStart', 1);
					}
				})
				.leftJoin('node', function () {
					this.on('node.id', '=', 'association.nodeId')
						.andOnNotIn('node.uuid', [anchorNode])
						.orOn('node.id', '=', 'association.linkedNode')
						.andOnNotIn('node.uuid', [anchorNode]);
				})
				.limit(perPage);
			// store our nodes and associations in the nodeList
			nodeList = nodeList.concat(result);
		} else {
			// no anchor node
			// 1. FETCH NODES
			let result = await knex
				.select('*')
				.from('node')
				.where('creator', userId)
				.limit(perPage)
				.orderBy('updatedAt', 'desc');
			// store those values in the nodeList
			nodeList = nodeList.concat(result);
			// 2. FETCH ASSOCIATIONS
			// subquery for association request
			const subquery = knex('node')
				.select('id')
				.from('node')
				.where('creator', userId)
				.limit(perPage)
				.orderBy('updatedAt', 'desc');
			// retreive associations based on subquery
			associations = await knex
				.select('*')
				.from('association')
				.where({ creator: userId })
				.andWhere('linkedNode', 'in', subquery)
				.andWhere('nodeId', 'in', subquery)
				.orderBy('updatedAt', 'desc');
		}
		// map through results and prepare them accordingly
		const results = nodeList.map((item) => {
			// add full path for files
			if (item.isFile || item.type === 'user') {
				const fullUrl = item.preview
					? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
					: null;
				const fullPath = item.path
					? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
					: null;
				item.path = fullPath;
				item.preview = fullUrl;
			}
			// create association list (if needed)
			if (item.nodeId) {
				associations.push({ nodeId: item.nodeId, linkedNode: item.linkedNode });
			}
			return item;
		});
		// 4. send response, return both lists as JSON data
		res.status(200).json({ nodes: results, associations: associations });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
