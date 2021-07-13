const path = require('path');
var fs = require('fs');
// bring in libraries for file and directory name generation
const crypto = require('crypto');
const shortId = require('shortid');
// bring in db
const { node } = require('../db/models');

// function to delete empty directories in the data folder from a file
// NOTE: use caution editing this one

// TODO - refactor this to come in from the top level of the data directory and clear out empty directories
// just prefer this to recursion probably since this can possibly be called on files stored outside the app
exports.cleanupDataDirectoryFromFilePath = async (filePath) => {
	try {
		// directory the passed-in file is located within
		var parentDirectory = path.dirname(filePath);
		// app data directory
		var dataDirectory = path.join(__coreDataDir, 'data');
		// if the filepath does not include the data directory path
		// it should not recursively delete anything
		if (!filePath.includes(dataDirectory)) {
			return;
		}
		// if the parentDirectory is also the dataDirectory, stop recursion
		if (parentDirectory === dataDirectory) {
			return;
		}
		// make sure the parent directory to the passed-in file exists
		if (fs.existsSync(parentDirectory)) {
			fs.readdir(parentDirectory, (err, files) => {
				if (err) {
					return next(err);
				} else {
					// if there are no files in the directory
					if (!files.length) {
						// directory appears to be empty, remove it
						if (fs.existsSync(parentDirectory)) {
							fs.rmdirSync(parentDirectory);
						}
						// recursively check to see if the directory above it is also empty
						this.cleanupDataDirectoryFromFilePath(parentDirectory);
					} else {
						// if there is other data, we are done cleaning up
						return;
					}
				}
			});
		}
	} catch (err) {
		console.log(err);
	}
};

exports.generateFileLocation = async (userId, nodeType) => {
	// prepare the directory paths as variables
	const dataDirectory = path.join(__coreDataDir, 'data');
	const userDataDir = path.join(dataDirectory, userId);
	const nodeTypeDirectory = path.join(userDataDir, nodeType);
	// check if directory for this node type exists
	if (!fs.existsSync(nodeTypeDirectory)) {
		// check if userId directory exists
		if (!fs.existsSync(userDataDir)) {
			// check if data directory exists
			if (!fs.existsSync(dataDirectory)) {
				fs.mkdirSync(dataDirectory);
			}
			fs.mkdirSync(userDataDir);
		}
		fs.mkdirSync(nodeTypeDirectory);
	}
	// return the full file path
	return nodeTypeDirectory;
};

exports.generateUniqueFileString = (filePath, fileName) => {
	// if a file at this path with this name already exists, we will have to rename
	if (fs.existsSync(path.join(filePath, fileName))) {
		// pull out the extension
		let extension = fileName.substring(fileName.lastIndexOf('.'));
		// pull out the name
		let name = fileName.substring(0, fileName.lastIndexOf('.')).trim().replace(/\s/g, '');
		// generate a new name with a unique ID as part of it
		let uniqueName = name + '-' + shortId.generate();
		// add extension back and return
		return uniqueName + extension;
	} else {
		return fileName;
	}
};

exports.setFilePathToNullById = async (id) => {
	try {
		await node.update(
			{
				path: null,
			},
			{ where: { id: id }, silent: true }
		);
	} catch (err) {
		console.log(err);
	}
};
