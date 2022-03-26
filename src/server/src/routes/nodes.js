// import dependencies
const express = require('express');
const { query, body } = require('express-validator/check');
// import controller
const nodeController = require('../controllers/nodes');
// import route middleware
const isAuth = require('../middleware/is-auth');

// set up router
const router = express.Router();

// create a new node
router.put(
	'/',
	isAuth,
	[
		body('isFile').exists().isBoolean(),
		body('type').exists().isString(),
		body('name').exists().isString(),
		body('preview').exists().isString(),
		body('content').exists().isString(),
		body('linkedNode').optional().isJSON(),
	],
	nodeController.createNode
);

// update a node by uuid
router.patch(
	'/',
	isAuth,
	[
		body('uuid').exists().isUUID(),
		body('name').optional().isString(),
		body('hidden').optional().isBoolean(),
		body('searchable').optional().isBoolean(),
		body('preview').optional().isString(),
		body('path').optional().isString(),
		body('content').optional().isString(),
		body('pinned').optional().isBoolean(),
	],
	nodeController.updateNode
);

// clear a node preview by uuid
router.patch(
	'/preview/clear',
	isAuth,
	[body('uuid').exists().isUUID()],
	nodeController.clearNodePreview
);

// fetch a node by uuid
router.get('/', isAuth, [query('uuid').exists().isUUID()], nodeController.getNodeByUUID);

// mark a node as viewed
router.patch('/viewed', isAuth, [body('uuid').exists().isUUID()], nodeController.markNodeView);

// return search as a page
// empty search returns all
router.get(
	'/search',
	isAuth,
	[
		query('page').optional().isNumeric(),
		query('type').optional().isString(),
		query('pinned').optional().isBoolean(),
		query('searchQuery').optional().isString(),
		query('sortType').optional().isString(),
		query('sortOrder').optional().isString(),
	],
	nodeController.searchNodes
);

// get association and node data for network visualizer
router.get(
	'/graph',
	isAuth,
	[
		query('anchorNode').optional().isUUID(),
		query('type').optional().isString(),
		query('searchQuery').optional().isString(),
	],
	nodeController.getGraphData
);

// Delete node by id
router.delete('/', isAuth, [query('uuid').exists().isUUID()], nodeController.deleteNodeByUUID);

// return the router
module.exports = router;
