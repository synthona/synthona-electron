// imports
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const shortId = require('shortid');

// set up multer config for file uploads
const fileStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		// generate user directory if it does not exist
		if (!fs.existsSync(path.join(__coreDataDir, 'data', req.user.uid))) {
			fs.mkdirSync(path.join(__coreDataDir, 'data', req.user.uid));
		}
		// generate a hash for the folder name
		file.hash = crypto.createHash('md5').update(file.originalname).digest('hex');
		// generate directories
		const directoryLayer1 = path.join(
			__coreDataDir,
			'data',
			req.user.uid,
			file.hash.substring(0, 3)
		);
		// if new directories are needed generate them
		if (!fs.existsSync(directoryLayer1)) {
			fs.mkdirSync(directoryLayer1);
		}
		// make sure filename is unique for this location
		file.uniqueName = file.originalname;
		// if filename does not exist yet we don't have to do anything
		if (!fs.existsSync(path.join(directoryLayer1, file.uniqueName))) {
			// pull out the extension and lowercase it
			let extension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
			// pull out the name
			let name = file.originalname
				.substring(0, file.originalname.lastIndexOf('.'))
				.trim()
				.replace(/\s/g, '');
			// add extension back and store the unique value
			file.uniqueName = name + extension;
		}
		// if the file aleady exist here we should add a shortId to it to make it unique
		else {
			// create a hash of the filename
			file.uniqueName = file.originalname;
			// pull out the extension
			let extension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
			// pull out the name
			let name = file.originalname
				.substring(0, file.originalname.lastIndexOf('.'))
				.trim()
				.replace(/\s/g, '');
			// generate a new name with a unique ID as part of it
			let uniqueName = name + '-' + shortId.generate();
			// add extension back and store the unique value
			file.uniqueName = uniqueName + extension;
		}
		// second param is storage location
		cb(null, directoryLayer1);
	},
	filename: (req, file, cb) => {
		// second param is file name
		cb(null, file.uniqueName);
	},
});

// determine which mimeTypes match with which nodeTypes
const imageMimetypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'];
const audioMimetypes = ['audio/mpeg', 'audio/x-m4a', 'audio/wav'];

// set up allowed mimetype config and prepare nodeType for controller
const fileFilter = (req, file, cb) => {
	if (imageMimetypes.includes(file.mimetype)) {
		file.nodeType = 'image';
		cb(null, true);
	} else if (audioMimetypes.includes(file.mimetype)) {
		file.nodeType = 'audio';
		cb(null, true);
	} else if (file.mimetype === 'application/zip') {
		file.nodeType = 'zip';
		cb(null, true);
	} else if (file.mimetype === 'application/octet-stream' && file.originalname.includes('.synth')) {
		file.nodeType = 'package';
		cb(null, true);
	} else {
		file.nodeType = 'file';
		cb(null, true);
	}
};

const limits = {
	files: 1, // allow only 1 file per request
	// fileSize: '500 * 1024 * 1024', // 500 MB (max file size)
};

module.exports = multer({ storage: fileStorage, limits: limits, fileFilter: fileFilter }).single(
	'image'
);
