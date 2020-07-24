// import dependencies
const express = require('express');
const { query, body } = require('express-validator/check');
// import controller
const fileController = require('../controllers/file');
// import route middleware
const isAuth = require('../middleware/is-auth');
const fileUpload = require('../middleware/file-upload');

// set up router
const router = express.Router();

// upload a file
router.put(
  '/',
  isAuth,
  [body('name').optional().isString(), body('linkedNode').optional().isJSON()],
  fileUpload,
  fileController.createFile
);

// return the router
module.exports = router;
