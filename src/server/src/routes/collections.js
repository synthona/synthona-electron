// import dependencies
const express = require('express');
const { body, query } = require('express-validator/check');
// import controller
const collectionController = require('../controllers/collections');
// import route middleware
const isAuth = require('../middleware/is-auth');

// set up router
const router = express.Router();

// Create collection
router.put(
  '/',
  isAuth,
  [body('name').exists().isString(), body('content').optional().isString()],
  collectionController.createCollection
);

router.patch('/regenerate', isAuth, collectionController.regenerateCollectionPreviews);

// return the router
module.exports = router;
