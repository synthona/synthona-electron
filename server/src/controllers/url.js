// custom code
const { validationResult } = require('express-validator/check');
const scraper = require('../util/scraper');
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
    // scrape the url
    const openGraphData = await scraper.scrapeOpenGraph(req.body.path);
    // process request
    const content = req.body.content;
    const name = openGraphData.title || openGraphData.og_title || req.body.name || 'untitled';
    const preview = openGraphData.og_image || openGraphData.image || null;
    const path = req.body.path;
    // create text node
    const urlNode = await node.create({
      isFile: false,
      hidden: false,
      searchable: true,
      type: 'url',
      name: name,
      preview: preview,
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
