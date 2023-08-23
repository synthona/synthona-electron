const { validationResult } = require('express-validator/check');
// import node dependencies
const fs = require('fs');
// bring in data models.
const knex = require('../db/knex/knex');
const uuid = require('uuid');
const day = require('dayjs');

exports.createFile = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// catch null errors
		if (!req.file) {
			const error = new Error('There was a problem uploading the file');
			error.statusCode = 422;
			throw error;
		}
		// process request
		const fileUrl = req.file.path;
		const nodeType = req.file.nodeType;
		const originalName = req.body.name || req.file.originalname;
		const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
		// create new node
		const newNode = {
			uuid: uuid.v4(),
			isFile: true,
			type: nodeType,
			name: originalName,
			preview: fileUrl,
			path: fileUrl,
			content: originalName,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		// create new node
		let result = await knex('node').insert(newNode);
		// if there is a linkedNode passed in, associate it
		if (linkedNode) {
			// make sure linkedNode exists
			const nodeB = await knex('node').select().where({ uuid: linkedNode.uuid }).first();
			// make sure we got a result
			if (nodeB) {
				// create association
				await knex('association').insert({
					nodeId: result[0],
					nodeUUID: newNode.uuid,
					nodeType: newNode.type,
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
		// add the baseURL of the server instance back in
		if (result.isFile) {
			result.preview = result.preview
				? req.protocol + '://' + req.get('host') + '/file/load/' + result.uuid
				: null;
		}
		// send response
		res.status(200).json({ node: result });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.linkFiles = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// grab the input values from the request
		const fileList = JSON.parse(req.body.fileList);
		const linkedNode = req.body.linkedNode ? JSON.parse(req.body.linkedNode) : null;
		// determine which mimeTypes match with which nodeTypes
		const imageMimetypes = [
			'image/png',
			'image/jpg',
			'image/jpeg',
			'image/gif',
			'image/webp',
			'image/heic',
		];
		const audioMimetypes = ['audio/mpeg', 'audio/x-m4a', 'audio/wav'];
		let resultList = [];
		// iterate through the passed-in file list
		for (var file of fileList) {
			// set the nodeType value for this file
			let nodeType = null;
			let preview = null;
			let extension = file.name.substring(file.name.lastIndexOf('.'));
			if (imageMimetypes.includes(file.type)) {
				nodeType = 'image';
				preview = file.path;
			} else if (audioMimetypes.includes(file.type)) {
				nodeType = 'audio';
			} else if (file.type === 'application/zip' && !(extension === '.synth')) {
				nodeType = 'zip';
			} else if (extension === '.synth') {
				nodeType = 'package';
			} else if (process.platform === 'darwin' && file.path.includes('.app/')) {
				// we are doing a little magic here to auto-generate a shortcut
				// launcher path on mac for applications if u select any file within them
				// TODO: make this a little more user friendly by integrating electron file-dialogue
				// and making it so selecting "packages" on mac treats them as files
				let appDirPath = file.path.substring(0, file.path.lastIndexOf('.app') + 4);
				// set the file path to that .app path
				file.path = appDirPath;
				// attempt to extract the App Name from the end of the path, & before the .app extension
				let appName = appDirPath.substring(
					appDirPath.lastIndexOf('/') + 1,
					appDirPath.lastIndexOf('.app')
				);
				file.name = appName;
				// set the node type to file still
				nodeType = 'file';
			} else {
				// catchall for adding any other files at all
				nodeType = 'file';
			}
			// object to store newnode
			let newNode = {
				uuid: uuid.v4(),
				isFile: true,
				type: nodeType,
				name: file.name,
				preview: preview,
				path: file.path,
				content: file.name,
				creator: userId,
				createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			};
			// create the corresponding node in the database
			const result = await knex('node').insert(newNode);
			resultList.push(newNode);
			// if there is a linkedNode passed in, associate it
			if (linkedNode) {
				// make sure linkedNode exists
				const nodeB = await knex('node').select().where({ uuid: linkedNode.uuid }).first();
				// make sure we got a result
				if (nodeB) {
					// create association
					await knex('association').insert({
						nodeId: result[0],
						nodeUUID: newNode.uuid,
						nodeType: newNode.type,
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
		}
		// fix the preview URLs...
		// TODO..mabye i should store them like this in the database...
		const results = resultList.map((item) => {
			if (item.isFile) {
				const fullUrl = item.preview
					? req.protocol + '://' + req.get('host') + '/file/load/' + item.uuid
					: null;
				item.preview = fullUrl;
			}
			return item;
		});
		// send response
		res.status(200).json({ nodes: results });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.loadFileByUUID = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		const uuid = req.params.uuid;
		// load node
		const result = await knex('node')
			.select('id', 'type', 'preview', 'path', 'name')
			.where({ uuid: uuid, creator: userId })
			.first()
			.limit(1);
		// make sure we got a result
		if (!result) {
			const error = new Error('node does not exist, maybe it was deleted');
			error.statusCode = 404;
			throw error;
		}
		// set path variable
		const filePath = result.path;
		const fileExists = fs.existsSync(filePath);
		// check to see if the file exists
		if (!fileExists && result.type !== 'user') {
			console.log('file at path ' + result.path + ' is broken');
		}
		// make sure there is a preview and then respond
		if (result && result.preview) {
			const filePreview = result.preview;
			res.download(filePreview, result.name);
		} else {
			res.sendStatus(404);
		}
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.openShortcutInExplorer = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// verify that the logged in user is the one who created the shortcut
		const uuid = req.body.uuid;
		// load node
		const result = await knex('node')
			.select('id', 'uuid', 'path', 'creator')
			.where({ uuid: uuid, creator: userId })
			.first()
			.limit(1);
		// make sure there is a result
		if (!result) {
			const error = new Error('there was a problem launching the shortcut');
			error.statusCode = 404;
			throw error;
		}
		// set path variable
		const filePath = result.path;
		const fileExists = fs.existsSync(filePath);
		// check to see if the file exists
		if (fileExists) {
			var exec = require('child_process').exec;
			// surround the path with double-quotes to avoid any issues to do with spaces in file paths
			const stringPath = ' "' + filePath + '"';
			// launch the command
			exec(openInExplorerCode() + stringPath);
			// send 200 status to interface
			res.sendStatus(200);
		} else {
			console.log('file at path ' + result.path + ' is broken');
			res.sendStatus(404);
		}
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.launchShortcut = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation Failed');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// verify that the logged in user is the one who created the shortcut
		const uuid = req.body.uuid;
		// load node
		const result = await knex('node')
			.select('id', 'uuid', 'path', 'creator')
			.where({ uuid: uuid, creator: userId })
			.first()
			.limit(1);
		// make sure there is a result
		if (!result) {
			const error = new Error('there was a problem launching the shortcut');
			error.statusCode = 404;
			throw error;
		}
		// set path variable
		const filePath = result.path;
		const fileExists = fs.existsSync(filePath);
		// check to see if the file exists
		if (fileExists) {
			var exec = require('child_process').exec;
			// surround the path with double-quotes to avoid any issues to do with spaces in file paths
			const stringPath = ' "' + filePath + '"';
			// launch the command
			exec(getLaunchCode() + stringPath);
			// send 200 status to interface
			res.sendStatus(200);
		} else {
			console.log('file at path ' + result.path + ' is broken');
			res.sendStatus(404);
		}
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

function getLaunchCode() {
	switch (process.platform) {
		case 'darwin':
			return 'open';
		case 'win32':
			return 'explorer.exe';
		case 'win64':
			return 'explorer.exe';
		default:
			return 'xdg-open';
	}
}

function openInExplorerCode() {
	switch (process.platform) {
		case 'darwin':
			return 'open -R';
		case 'win32':
			return 'explorer.exe /select,';
		case 'win64':
			return 'explorer.exe /select,';
		default:
			return 'xdg-open';
	}
}
