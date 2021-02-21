// import dependencies
const express = require('express');
const { body, query } = require('express-validator/check');
// import controller
const associationController = require('../controllers/associations');
// import route middleware
const isAuth = require('../middleware/is-auth');

// set up router
const router = express.Router();

// Create association
router.put(
  '/',
  isAuth,
  [body('nodeUUID').exists().isUUID(), body('linkedNodeUUID').exists().isUUID()],
  associationController.createAssociation
);

// Get associations by UUID
router.get(
  '/',
  isAuth,
  [query('nodeUUID').exists().isUUID(), query('page').optional().isNumeric()],
  associationController.getAssociationsByUUID
);

// autocomplete for creating associations
router.get(
  '/autocomplete',
  isAuth,
  [query('nodeUUID').exists().isUUID(), query('searchQuery').optional().isString()],
  associationController.associationAutocomplete
);

// delete association
router.delete(
  '/',
  isAuth,
  [query('nodeA').exists().isUUID(), query('nodeB').exists().isUUID()],
  associationController.deleteAssociation
);

// update link strength
router.put(
  '/linkstrength',
  isAuth,
  [body('nodeA').exists().isUUID(), body('nodeB').exists().isUUID()],
  associationController.updateLinkStrength
);

// return the router
module.exports = router;
