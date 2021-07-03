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

//link file-list
router.put(
  '/link',
  isAuth,
  [
    body('fileList')
      .isJSON()
      .custom((value, { req }) => {
        const fileList = JSON.parse(value);
        // validate the entire fileList object
        for (var file of fileList) {
          const isValidObject =
            typeof file === 'object' &&
            typeof file.name === 'string' &&
            typeof file.path === 'string' &&
            typeof file.type === 'string';
          // if the object is not valid, reject promise
          if (!isValidObject) {
            return Promise.reject('Passed In File List Failed Validation!');
          }
        }
        return value;
      }),
    body('linkedNode').optional().isJSON(),
  ],
  fileController.linkFiles
);

// load file
router.get('/load/:uuid', isAuth, fileController.loadFileByUUID);

// launch shortcut
router.put('/launch', isAuth, [body('uuid').exists().isUUID()], fileController.launchShortcut);

// open shortcut in explorer
router.put(
  '/explorer',
  isAuth,
  [body('uuid').exists().isUUID()],
  fileController.openShortcutInExplorer
);

// return the router
module.exports = router;
