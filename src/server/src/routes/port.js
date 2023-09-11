// import dependencies
const express = require('express');
const { body } = require('express-validator/check');
// import db model
const knex = require('../db/knex/knex');
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
			.custom(async (value, { req }) => {
				let package = await knex('node').select().where({ uuid: value }).first();
				let metadata = package.metadata ? JSON.parse(package.metadata) : null;
				if (metadata && !metadata.expanded) {
					return Promise.reject('package is not expanded');
				}
				return;
			}),
	],
	portController.removeImportsByPackage
);

// import a synthona package
router.put('/import', isAuth, [body('uuid').exists().isUUID()], portController.unpackImport);

// return the router
module.exports = router;
