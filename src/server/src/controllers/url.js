// custom code
const { validationResult } = require('express-validator/check');
const scraper = require('../util/scraper');
// bring in data models.
const { node, association } = require('../db/models');

// create new url node
exports.createUrl = async (req, res, next) => {
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
		let openGraphData = {};
		try {
			openGraphData = await scraper.scrapeOpenGraph(req.body.path);
		} catch (err) {
			console.log('scraping error at ' + req.body.path);
		}
		// process request
		const content = req.body.content;
		const name = openGraphData.title || openGraphData.og_title || req.body.name || 'untitled';
		const preview = openGraphData.og_image || openGraphData.image || null;
		const path = req.body.path;
		const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
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
		// if there is a linkedNode passed in, associate it
		if (linkedNode) {
			// make sure linkedNode exists
			const nodeB = await node.findOne({
				where: {
					uuid: linkedNode.uuid,
				},
			});
			// throw error if it is empty
			if (!nodeB) {
				const error = new Error('Could not find both nodes');
				error.statusCode = 404;
				throw error;
			}
			// throw error if it is empty
			if (nodeB) {
				// create association
				await association.create({
					nodeId: urlNode.dataValues.id,
					nodeUUID: urlNode.dataValues.uuid,
					nodeType: urlNode.dataValues.type,
					linkedNode: nodeB.id,
					linkedNodeUUID: nodeB.uuid,
					linkedNodeType: nodeB.type,
					linkStrength: 1,
					creator: userId,
				});
			}
		}
		// send response
		res.status(200).json({ node: urlNode });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
