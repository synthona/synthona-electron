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
  [body('url').exists().isURL, body('name').optional().isString()],
  urlController.createUrl
);
