const cheerio = require('cheerio');
const request = require('request');
const url = require('url');

exports.scrapeOpenGraph = async (inputUrl) => {
	return new Promise(function (resolve, reject) {
		// extract baseUrl
		var pathArray = inputUrl.split('/');
		var protocol = pathArray[0];
		var host = pathArray[2];
		var baseUrl = protocol + '//' + host;
		// create ogData variable
		let ogData;
		request(
			{
				uri: inputUrl,
				timeout: 3000,
			},
			(error, res, body) => {
				if (!error) {
					var $ = cheerio.load(body);
					let image = $('img').first();
					let imageUrl;
					// only set this is there is an image available
					if ($(image).attr('src')) {
						imageUrl = url.resolve(baseUrl, $(image).attr('src'));
					}
					// store ogData
					ogData = {
						title: $('title').text(),
						image: imageUrl || null,
						og_title: $('meta[property="og:title"]').attr('content') || null,
						og_url: $('meta[property="og:url"]').attr('content') || null,
						og_image: $('meta[property="og:image"]').attr('content') || null,
						og_type: $('meta[property="og:type"]').attr('content') || null,
					};
					// resolve and return data
					resolve(ogData);
				} else {
					reject(error);
				}
			}
		);
	});
};
