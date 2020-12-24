// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node } = require('../db/models');

// create new url node
exports.createUrl = async (req, res, next) => {
  console.log('creating url');
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

    // HAVE TO SCRAPE THE URL HERE>>>!!!!!

    // process request
    const content = req.body.content;
    const name = req.body.name || 'untitled';
    const preview = req.body.content;
    const path = req.body.path;
    // create text node
    const urlNode = await node.create({
      isFile: false,
      hidden: false,
      searchable: true,
      type: 'url',
      name: name,
      preview: null,
      path: path,
      content: content,
      creator: userId,
    });
    // send response
    res.status(200).json({ node: urlNode });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
