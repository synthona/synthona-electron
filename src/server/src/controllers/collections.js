const { Op } = require('sequelize');
// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node, association } = require('../db/models');

exports.createCollection = async (req, res, next) => {
  // this comes from the is-auth middleware
  const userId = req.user.uid;
  const errors = validationResult(req);
  try {
    // catch validation errors
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // process request
    const name = req.body.name || 'empty collection';
    const preview = req.body.preview || '';
    // create collection
    const result = await node.create({
      isFile: false,
      hidden: false,
      searchable: true,
      type: 'collection',
      name: name,
      preview: preview,
      creator: userId,
    });
    // send response
    res.status(200).json({ collection: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
