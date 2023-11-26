// custom code
const { validationResult } = require('express-validator/check');
const scraper = require('../util/scraper');
// bring in data models.
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');

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
		// create url node
		const urlNode = {
			uuid: uuid.v4(),
			isFile: false,
			type: 'url',
			name: name,
			preview: preview,
			path: path,
			content: content,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create node
		const result = await knex('node').insert(urlNode);
		// if there is a linkedNode passed in, associate it
		if (linkedNode) {
			// make sure linkedNode exists
			const nodeB = await knex('node').select().where({ uuid: linkedNode.uuid }).first();
			// make sure we got a result
			if (nodeB) {
				// create association
				await knex('association').insert({
					nodeId: result[0],
					nodeUUID: urlNode.uuid,
					nodeType: urlNode.type,
					linkedNode: nodeB.id,
					linkedNodeUUID: nodeB.uuid,
					linkedNodeType: nodeB.type,
					linkStrength: 1,
					creator: userId,
					createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
					updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
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
