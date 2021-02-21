// import dependencies
const express = require('express');
const { body, query } = require('express-validator/check');
// import controller
const urlController = require('../controllers/url');
// import route middleware
const isAuth = require('../middleware/is-auth');
// set up router
const router = express.Router();

// Create text node
// TODO: add custom check to make sure it is a quilljs delta
router.put(
  '/',
  isAuth,
  [
    body('isFile').exists().isBoolean(),
    body('type').exists().isString(),
    body('name').exists().isString(),
    body('preview').exists().isString(),
    body('path').exists().isString(),
    body('content').exists().isString(),
    body('linkedNode').optional().isJSON(),
  ],
  urlController.createUrl
);

// return the router
module.exports = router;
