const path = require('path');
// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node } = require('../db/models');

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

exports.regenerateCollectionPreviews = async (req, res, next) => {
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
    // fetch all the collection nodes for the logged in user
    const nodeData = await node.findAll({
      where: {
        type: 'collection',
        creator: userId,
      },
    });
    // loop through
    for (let collection of nodeData) {
      // loop through each collection
      const collectionJSON = JSON.parse(collection.preview);
      for (let item of collectionJSON) {
        let preview = item.preview;
        // limit the updates to file previews since everything else should work fine
        if (item.type === 'image' && preview.includes(path.join('data', userId))) {
          // grab the substring containing the data folder path
          const shortPath = preview.substring(preview.lastIndexOf('data'));
          // lookup full data for item
          const fullItemData = await node.findOne({
            where: {
              preview: shortPath,
            },
          });
          // return the updated values
          item.preview = req.protocol + '://' + req.get('host') + '/file/load/' + fullItemData.uuid;
        }
      }
      const newPreview = JSON.stringify(collectionJSON);
      // save the updated values to the database
      await node.update(
        {
          preview: newPreview,
        },
        {
          where: {
            type: 'collection',
            uuid: collection.uuid,
          },
          silent: true,
        }
      );
    }
    // send back 200 status
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
