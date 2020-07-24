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
    body('content').optional().isString(),
  ],
  nodeController.updateNode
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
    query('searchQuery').optional().isString(),
  ],
  nodeController.searchNodes
);

// Delete node by id
router.delete('/', isAuth, [query('uuid').exists().isUUID()], nodeController.deleteNodeByUUID);

// return the router
module.exports = router;
