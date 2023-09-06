// import dependencies
const express = require('express');
const { body } = require('express-validator/check');
// import db model
const { node } = require('../db/models');
// import controller
const portController = require('../controllers/port');
// import route middleware
const isAuth = require('../middleware/is-auth');

// set up router
const router = express.Router();

// generate a user-data export
router.put('/export/all', isAuth, portController.exportAllUserData);

// generate export from UUID
router.put(
	'/export',
	isAuth,
	[body('uuid').exists().isUUID(), body('bidirectional').optional().isString()],
	portController.exportFromAnchorUUID
);

// clear imports from a package
router.patch(
	'/export/undo',
	isAuth,
	[
		body('uuid')
			.exists()
			.isUUID()
			.custom((value, { req }) => {
				return node
					.findOne({
						where: { uuid: value },
					})
					.then((node) => {
						if (!(node && node.metadata && node.metadata.expanded)) {
							return Promise.reject('package is not expanded');
						}
					});
			}),
	],
	portController.removeImportsByPackage
);

// import a synthona package
router.put('/import', isAuth, [body('uuid').exists().isUUID()], portController.unpackImport);

// return the router
module.exports = router;
