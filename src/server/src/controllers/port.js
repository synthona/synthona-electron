const fs = require("fs");
const path = require("path");
const { validationResult } = require("express-validator/check");
// bring in data models.
const knex = require("../db/knex/knex");
const uuid = require("uuid");
const day = require("dayjs");
// set up archiver and unzip library
const archiver = require("archiver");
var admZip = require("adm-zip");
// custom code
const portUtil = require("../util/portUtil");
const fsUtil = require("../util/fsUtil");
const context = require("../util/context");

// generate a data export for this user
exports.exportAllUserData = async (req, res, next) => {
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error("Validation Failed");
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// send back the 200 response to let user know we're working on it
		res.sendStatus(200);
		// this comes from the is-auth middleware
		const userId = req.user.uid;
		// set export name and extension
		const currentDate = new Date();
		const exportName =
			currentDate.getMonth() +
			1 +
			"-" +
			currentDate.getDate() +
			"-" +
			currentDate.getFullYear() +
			" @ " +
			currentDate.getHours() +
			"-" +
			currentDate.getMinutes() +
			"-" +
			currentDate.getSeconds();

		const exportDir = await fsUtil.generateFileLocation(userId, "export");
		const exportDest = path.join(exportDir, exportName + ".synth");
		// create a file to stream archive data to.
		var output = fs.createWriteStream(exportDest);
		var archive = archiver("zip", {
			zlib: { level: 9 }, // Sets the compression level.
		});
		// listen for all archive data to be written
		// 'close' event is fired only when a file descriptor is involved
		output.on("close", async () => {
			console.log(archive.pointer() + " total bytes");
			console.log("archiver has been finalized and the output file descriptor has closed.");
			// create node when the export is done
			const newNode = {
				uuid: uuid.v4(),
				isFile: true,
				type: "package",
				name: exportName,
				preview: null,
				path: exportDest,
				content: exportName,
				creator: userId,
				pinned: true,
				createdAt: day().add(5, "hour").format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				updatedAt: day().add(5, "hour").format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			};
			// create node
			await knex("node").insert(newNode);
		});

		// This event is fired when the data source is drained no matter what was the data source.
		output.on("end", function () {
			console.log("Data has been exported");
		});

		// good practice to catch warnings (ie stat failures and other non-blocking errors)
		archive.on("warning", function (err) {
			if (err.code === "ENOENT") {
				// log warning
			} else {
				// throw error
				throw err;
			}
		});

		// good practice to catch this error explicitly
		archive.on("error", function (err) {
			throw err;
		});

		// load in the node and association export-data from the database
		let nodeData = await knex("node")
			.select()
			.where("node.creator", userId)
			.andWhereNot("node.type", "package")
			.andWhereNot("node.type", "user")
			.orderBy("updatedAt", "desc");
		// loop through all nodes to add files into export
		for (let node of nodeData) {
			// add associated files to the export
			if (node.path && (node.isFile || node.type === "user")) {
				let extension = node.path.substring(node.path.lastIndexOf("."));
				let nodeFile = path.resolve(node.path);
				console.log("gathering files related to " + node.name);
				console.log(nodeFile + "\n");
				if (fs.existsSync(nodeFile) && !fs.lstatSync(nodeFile).isDirectory()) {
					try {
						// append the associated file to the export
						archive.append(fs.createReadStream(nodeFile), {
							name: node.uuid + extension,
						});
					} catch (err) {
						err.statusCode = 500;
						throw err;
					}
				}
			}
			// we also need to grab any existing associations and attach them to the node
			// unfortunately we have to do this for every single one. sorry!
			let value = await knex("association")
				.select(
					"id",
					"nodeId",
					"nodeUUID",
					"nodeType",
					"linkedNode",
					"linkedNodeUUID",
					"linkedNodeType",
					"linkStrength",
					"linkStart",
					"updatedAt",
					"createdAt"
				)
				.where({ nodeId: node.id })
				.whereNotIn("linkedNodeType", ["package", "user"]);
			// store that value in the node object
			// NOTE: why is it called "original"? well its leftover from sequelize.
			// i did it to keep compatibility with the old exports
			node.original = value && value.length > 0 ? value : null;
		}
		// stringify JSON
		const nodeString = JSON.stringify(nodeData);
		console.log("generating nodes.json file in export");
		// append a file containing the nodeData
		archive.append(nodeString, { name: "/db/nodes.json" });
		// load in the user export-data from the database
		const userData = await knex("user").select().where({ id: userId }).first();
		// get the json object for the logged in user
		console.log("adding user avatar files");
		// add avatar files to the export
		if (userData.avatar) {
			let extension = userData.avatar.substring(userData.avatar.lastIndexOf("."));
			let avatarPath = path.resolve(userData.avatar);
			if (fs.existsSync(avatarPath)) {
				try {
					// append the associated file to the export
					archive.append(fs.createReadStream(avatarPath), {
						name: userData.username + "-avatar" + extension,
					});
				} catch (err) {
					err.statusCode = 500;
					throw err;
				}
			}
		}
		console.log("adding user header files");
		// add header to export
		if (userData.header) {
			let extension = userData.header.substring(userData.header.lastIndexOf("."));
			let headerPath = path.resolve(userData.header);
			if (fs.existsSync(headerPath)) {
				try {
					// append the associated file to the export
					archive.append(fs.createReadStream(headerPath), {
						name: userData.username + "-header" + extension,
					});
				} catch (err) {
					err.statusCode = 500;
					throw err;
				}
			}
		}
		console.log("adding user data to export");
		// stringify JSON
		const userString = JSON.stringify([userData]);
		// append a file containing the userData
		archive.append(userString, { name: "/db/user.json" });
		console.log("generating metadata file");
		// add a metadata file
		const metadataString = JSON.stringify({ version: process.env.VERSION });
		// append a file containing the metadata
		archive.append(metadataString, { name: "/db/metadata.json" });
		console.log("generating the file");
		// pipe archive data to the file
		archive.pipe(output);
		// finalize the archive (ie we are done appending files but streams have to finish yet)
		// 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
		archive.finalize();
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.exportFromAnchorUUID = async (req, res, next) => {
	// this comes from the is-auth middleware
	const userId = req.user.uid;
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error("Validation Failed");
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		/* 
		1. grab a list of nodes associated to the anchorNode (bidirectional or unidirectional. either one)
		2. loop through that first list to build the second, final list out of the loop. the relations of the nodes in the list to each other.
		3. generate the file using the result of step 2. 
		4. done! 
		*/
		// send back 200 response to let client know we've recieved the request
		res.sendStatus(200);
		// get the values out of the query
		const exportAnchorUUID = req.body.uuid;
		const bidirectional = req.body.bidirectional === "yes" ? true : false;
		// get the anchor node
		const anchorNode = await knex("node")
			.select()
			.where({ uuid: exportAnchorUUID, creator: userId })
			.first();

		// set export name, destination, and extension
		const exportName = anchorNode.name.trim();
		const exportDir = await fsUtil.generateFileLocation(userId, "export");
		const uniqueName = await fsUtil.generateUniqueFileString(exportDir, exportName + ".synth");
		const exportDest = path.join(exportDir, uniqueName);
		// create a file to stream archive data to.
		var output = fs.createWriteStream(exportDest);
		var archive = archiver("zip", {
			zlib: { level: 9 }, // Sets the compression level.
		});
		// listen for all archive data to be written
		// 'close' event is fired only when a file descriptor is involved
		output.on("close", async () => {
			console.log(archive.pointer() + " total bytes");
			console.log("archiver has been finalized and the output file descriptor has closed.");
			// create node when the export is done
			const newNode = {
				uuid: uuid.v4(),
				isFile: true,
				type: "package",
				name: exportName,
				preview: null,
				path: exportDest,
				content: exportName,
				creator: userId,
				pinned: true,
				createdAt: day().add(5, "hour").format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
				updatedAt: day().add(5, "hour").format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			};
			// create node
			await knex("node").insert(newNode);
		});

		// This event is fired when the data source is drained no matter what was the data source.
		output.on("end", function () {
			console.log("export created");
		});

		// good practice to catch warnings (ie stat failures and other non-blocking errors)
		archive.on("warning", function (err) {
			if (err.code === "ENOENT") {
				// log warning
			} else {
				// throw error
				throw err;
			}
		});
		// // good practice to catch this error explicitly
		archive.on("error", function (err) {
			throw err;
		});

		// retrieve all the nodes associated with the anchornode
		const query1 = await knex("association")
			.select("node.*", "association.*")
			.where("association.creator", userId)
			.modify((queryBuilder) => {
				if (bidirectional) {
					// if bidirectional mode is enabled exclude any nodes already in association with us
					queryBuilder
						.where("association.nodeUUID", exportAnchorUUID)
						.orWhere("association.linkedNodeUUID", exportAnchorUUID);
				} else {
					// unidirectional mode..we're pickier here.
					// we only want (linkStart == null && nodeUUID == nodeUUID) or
					// (linkStart == 1 && linkedNodeUUID == nodeUUID) for autocomplete
					queryBuilder
						.where("association.nodeUUID", exportAnchorUUID)
						.orWhere("association.linkedNodeUUID", exportAnchorUUID)
						.andWhere("association.linkStart", 1);
				}
			})
			.leftJoin("node", function () {
				this.onNotIn("node.uuid", exportAnchorUUID)
					.on("association.nodeId", "=", "node.id")
					.orOn("association.linkedNode", "=", "node.id")
					.onNotIn("node.uuid", exportAnchorUUID);
			})
			.orderBy("association.linkStrength", "desc")
			.distinct();

		// add the anchornode to the list
		query1.push(anchorNode);

		// PHASE 2: time to build the final data object
		/* 
			subquery to determine a list of which nodes are included in this export...this gets passed into the query during the loop
			essentially this subquery returns a list of IDS which we need during the loop for our WHERE theories 
		*/
		const interlinkSubquery = knex("association")
			.select("node.id")
			.where("association.creator", userId)
			.modify((queryBuilder) => {
				if (bidirectional) {
					// if bidirectional mode is enabled exclude any nodes already in association with us
					queryBuilder
						.where("association.nodeUUID", exportAnchorUUID)
						.orWhere("association.linkedNodeUUID", exportAnchorUUID);
				} else {
					// unidirectional mode..we're pickier here.
					// we only want (linkStart == null && nodeUUID == nodeUUID) or
					// (linkStart == 1 && linkedNodeUUID == nodeUUID) for autocomplete
					queryBuilder
						.where("association.nodeUUID", exportAnchorUUID)
						.orWhere("association.linkedNodeUUID", exportAnchorUUID)
						.andWhere("association.linkStart", 1);
				}
			})
			.leftJoin("node", function () {
				this.on("association.nodeId", "=", "node.id").orOn(
					"association.linkedNode",
					"=",
					"node.id"
				);
			})
			.orderBy("association.linkStrength", "desc")
			.distinct();
		// now we're going to loop through the original query and
		for (let node of query1) {
			// we have to make a secondary request here for each one. to get any associations also in the list, see
			const interlinkQuery = await knex("association")
				.select("association.*")
				.where("association.creator", userId)
				.andWhere("node.creator", userId)
				.andWhere("association.nodeId", node.id)
				.whereIn("node.id", interlinkSubquery)
				.whereNotIn("node.id", [node.id])
				.leftJoin("node", function () {
					this.on("association.linkedNode", "=", "node.id");
				})
				.orderBy("association.linkStrength", "desc")
				.distinct();
			if (interlinkQuery.length > 0) {
				let associationList = [];
				for (let interlink of interlinkQuery) {
					associationList.push(interlink);
				}
				node.original = associationList;
			} else {
				node.original = null;
			}
			// add any files to the export
			if (node.isFile) {
				let extension = node.path.substring(node.path.lastIndexOf("."));
				let previewPath = path.resolve(node.path);
				// see if the file exists
				if (fs.existsSync(previewPath) && !fs.lstatSync(previewPath).isDirectory()) {
					try {
						// append the associated file to the export
						archive.append(fs.createReadStream(previewPath), {
							name: node.uuid + extension,
						});
					} catch (err) {
						err.statusCode = 500;
						throw err;
					}
				}
			}
		}
		// stringify JSON
		const nodeString = JSON.stringify(query1);
		// append a file containing the nodeData
		archive.append(nodeString, { name: "/db/nodes.json" });
		// add a metadata file
		const metadataString = JSON.stringify({ version: process.env.VERSION });
		// append a file containing the metadata
		archive.append(metadataString, { name: "/db/metadata.json" });
		// pipe archive data to the file
		archive.pipe(output);
		// finalize the archive (ie we are done appending files but streams have to finish yet)
		// 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
		archive.finalize();
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.removeImportsByPackage = async (req, res, next) => {
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error("Validation Failed");
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// this comes from the is-auth middleware
		const uid = req.user.uid;
		// uuid of the import package node
		const packageUUID = req.body.uuid;
		/* 
			1. delete all the associations including connected associations. via subquery
			2. go back and delete nodes
			3. update the package itself
			4. done!
		*/
		// subquery to get a list of associations for deletion
		const associationSubquery = knex("node").select("node.id").where({ importId: packageUUID });
		// delete all the associations related to the subquery
		await knex("association")
			.whereIn("nodeId", associationSubquery)
			.orWhereIn("linkedNode", associationSubquery)
			.delete();
		// delete all the associations related to this package
		await knex("node").where({ importId: packageUUID }).delete();
		// update the package node itself with the corrected data
		await knex("node")
			.where({ uuid: packageUUID })
			.andWhere({ creator: uid })
			.update({ metadata: null });
		// send response
		res.sendStatus(200);
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.unpackImport = async (req, res, next) => {
	try {
		// catch validation errors
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error("Validation Failed");
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}
		// this comes from the is-auth middleware
		const userId = req.user.uid;
		// uuid of the import package node
		const packageUUID = req.body.uuid;
		// make sure al the file directories are there
		let dataDirectoryPath = path.join(__coreDataDir, "data", userId);
		let userDirectoryPath = path.join(__coreDataDir, "data", userId, "user");
		// generate user data directory if it does not exist
		if (!fs.existsSync(dataDirectoryPath)) {
			fs.mkdirSync(dataDirectoryPath);
		}
		// generate user profile image directory if it does not exist
		if (!fs.existsSync(userDirectoryPath)) {
			fs.mkdirSync(userDirectoryPath);
		}
		// fetch the package node from the DB
		const packageNode = await knex("node")
			.select()
			.where({ uuid: packageUUID })
			.andWhere({ creator: userId })
			.first();
		// check that the node is not already expanded
		if (packageNode.metadata && packageNode.metadata.expanded) {
			err = new Error("package is already expanded");
			err.statusCode = 500;
			throw err;
		}
		// mark the import package as expanded so undo is possible even if the operation fails or is interrupted
		await knex("node")
			.where({ uuid: packageUUID })
			.andWhere({ creator: userId })
			.update({ metadata: JSON.stringify({ expanded: true, importing: true }) });
		// send a 200 response to let the frontend know we've started the import process
		// since it will probably take a while, and the browser may duplicate the request
		// TODO: switch over to websockets or something so we can stream
		// live updates of the import progress to the frontend instead of
		// having to use this workaround
		res.sendStatus(200);
		// fetch the logged in user from the DB
		const loggedInUser = await knex("user").select().where({ id: userId }).first();
		// get the node for the logged in user
		const loggedInUserNode = await knex("node")
			.select()
			.where({ path: loggedInUser.username })
			.andWhere({ creator: userId })
			.andWhere({ type: "user" })
			.first();
		// get the fileUrl
		const packageUrl = path.join(packageNode.path);
		// check zip buffer size before unzipping
		// var buffer = new admZip(packageUrl).toBuffer();
		// const maxZipSize = 1000000000; // 1GB
		// if (buffer.byteLength > maxZipSize) {
		// 	err = new Error('zip buffer exceeds max allowed size');
		// 	err.statusCode = 500;
		// 	throw err;
		// }
		// create new reference to zip
		var zip = new admZip(packageUrl);
		var zipEntries = zip.getEntries();
		// loop through the zip entries and create nodes for them
		for (let entry of zipEntries) {
			// loop through the nodes.json file
			if (entry.name === "nodes.json") {
				// set up main variables for processing
				let jsonData;
				if (typeof entry.getData() === "object") {
					jsonData = JSON.parse(entry.getData());
				} else {
					err = new Error("package data is not a proper JSON object");
					err.statusCode = 500;
					throw err;
				}
				let newNode = {};
				let result;
				let newNodeIdList = [];
				// iterate through the JSON data
				for (let nodeImport of jsonData) {
					console.log("importing " + nodeImport.name);
					// handle file node imports
					if (nodeImport.isFile) {
						let nodeImportPath = nodeImport.path ? nodeImport.path : nodeImport.preview;
						// load the fileEntry
						let extension = null;
						if (nodeImportPath) {
							extension = nodeImportPath.substring(nodeImportPath.lastIndexOf("."));
						}
						// use the uuid to recognize the file
						const fileEntry = zip.getEntry(nodeImport.uuid + extension);
						let filePath;
						let dbFilePath;
						// TODO! i want to actually save the files as a human readable name. with that (2)+ for duplicates
						if (fileEntry && fileEntry.name) {
							// lets make sure the file doesnt already exist before we make another copy
							if (fs.existsSync(nodeImport.path)) {
								// file at this specific path with this specific name already exists lets just use it
								filePath = nodeImport.path;
								dbFilePath = nodeImport.path;
							} else {
								// if it doesn't already exist we should generate the file location and get file path
								filePath = await fsUtil.generateFileLocation(userId, nodeImport.type);
								//extract file to the generated location
								zip.extractEntryTo(fileEntry, filePath, false, true);
								dbFilePath =
									fileEntry && fileEntry.name ? path.join(filePath, fileEntry.name) : null;
							}
						} else {
							// err = new Error('file import error');
							console.log("file import at...");
							console.log(nodeImport);
							// err.statusCode = 500;
							// throw err;
						}
						const previewPath = nodeImport.type === "image" ? dbFilePath : null;
						// generate node
						newNode = {
							uuid: uuid.v4(),
							isFile: nodeImport.isFile,
							type: nodeImport.type,
							name: nodeImport.name,
							preview: previewPath,
							content: nodeImport.content,
							path: dbFilePath,
							creator: userId,
							pinned: nodeImport.pinned,
							createdAt: nodeImport.createdAt,
							updatedAt: nodeImport.updatedAt,
							importId: packageUUID,
						};
						result = await knex("node").insert(newNode);
						newNode.id = result[0];
					}
					// default import code
					else {
						if (nodeImport.type === "user") {
							nodeImport.path = loggedInUser.username;
							nodeImport.preview = loggedInUserNode.preview;
						}
						// generate node
						newNode = {
							uuid: uuid.v4(),
							isFile: nodeImport.isFile,
							type: nodeImport.type,
							name: nodeImport.name,
							preview: nodeImport.preview,
							content: nodeImport.content,
							path: nodeImport.path,
							creator: userId,
							pinned: nodeImport.pinned,
							createdAt: nodeImport.createdAt,
							updatedAt: nodeImport.updatedAt,
							importId: packageUUID,
						};
						result = await knex("node").insert(newNode);
						newNode.id = result[0];
					}
					// if the node in question has associations, process them
					if (nodeImport.original) {
						// loop through the associations for the current node from the JSON file
						for (associationImport of nodeImport.original) {
							// create the association as-it-appears, but set the
							// nodeId and nodeUUID to the new values. linkedNode
							// and linkedNodeUUID will temporarily have the wrong values. this will
							// be corrected at a second pass later in the import
							let newAssociation = {
								nodeId: newNode.id,
								nodeUUID: newNode.uuid,
								nodeType: newNode.type,
								linkedNode: associationImport.linkedNode,
								linkedNodeUUID: associationImport.linkedNodeUUID,
								linkedNodeType: associationImport.linkedNodeType,
								linkStrength: associationImport.linkStrength,
								linkStart: associationImport.linkStart,
								creator: userId,
								importId: packageUUID,
								createdAt: associationImport.createdAt,
								updatedAt: associationImport.updatedAt,
							};
							await knex("association").insert(newAssociation);
						}
						// store the old and new UUIDs and IDs here to be re-processed
						// with the linkedNode and linkedNodeUUID columns at the end
						newNodeIdList.push({
							oldId: nodeImport.id,
							oldUUID: nodeImport.uuid,
							newId: newNode.id,
							newUUID: newNode.uuid,
						});
					}
					// associate the imports to the package so users can easily see what they have imported
					console.log("associating " + newNode.name + " to package");
					// create association between the import package and the new node
					await context.createNewAssociation(packageNode, newNode, userId, packageNode);
				}
				// process the linkedNode and linkedNodeUUID columns
				for (let value of newNodeIdList) {
					// replace the temporary values with the correct values for associations
					await knex("association")
						.where({ linkedNode: value.oldId })
						.andWhere({ linkedNodeUUID: value.oldUUID })
						.andWhere({ importId: packageUUID })
						.update({ linkedNode: value.newId, linkedNodeUUID: value.newUUID });
				}
				// synthesize the imported user information with the loggedInUser
				await portUtil.transferImportedUserData(packageUUID, loggedInUserNode);
			} else if (entry.name === "user.json") {
				// set up main variables for processing
				let jsonData;
				if (typeof entry.getData() === "object") {
					jsonData = JSON.parse(entry.getData());
				} else {
					err = new Error("user package data is not a proper JSON object");
					err.statusCode = 500;
					throw err;
				}
				let userImport = jsonData[0];
				// load the avatar and header info
				let avatarExtension = userImport.avatar.substring(userImport.avatar.lastIndexOf("."));
				let headerExtension = userImport.header.substring(userImport.header.lastIndexOf("."));
				// load both file entries
				const avatarFileEntry = zip.getEntry(userImport.username + "-avatar" + avatarExtension);
				const headerFileEntry = zip.getEntry(userImport.username + "-header" + headerExtension);
				// create empty variables for filepaths
				let avatarFilePath;
				let headerFilePath;
				// import the avatar image
				if (avatarFileEntry && avatarFileEntry.name) {
					avatarFilePath = path.join(__coreDataDir, "data", userId, "user");
					//extract file
					zip.extractEntryTo(avatarFileEntry, avatarFilePath, false, true);
				}
				// import the header image
				if (headerFileEntry && headerFileEntry.name) {
					headerFilePath = path.join(__coreDataDir, "data", userId, "user");
					//extract file
					zip.extractEntryTo(headerFileEntry, headerFilePath, false, true);
				}
				const avatarDbFilePath = path.join(avatarFilePath, avatarFileEntry.name);
				const headerDbFilePath = path.join(headerFilePath, headerFileEntry.name);
				// update the logged in user with the imported data
				console.log("update logged in user object");
				await knex("user")
					.where({ id: userId })
					.update({
						displayName: userImport.displayName,
						bio: userImport.bio,
						avatar: avatarDbFilePath || null,
						header: headerDbFilePath || null,
					});
				console.log("update logged in user node");
				// update the logged in user node as well
				await knex("node")
					.where({ creator: userId })
					.andWhere({ type: "user " })
					.update({ preview: avatarDbFilePath, content: userImport.bio });
			}
		}
		// generate the collection previews for all imports
		await context.regenerateCollectionPreviews(userId, req);
		console.log("\n=================================");
		console.log("finishing up");
		// mark the import package as successfully expanded
		await knex("node")
			.where({ uuid: packageUUID })
			.update({ metadata: JSON.stringify({ expanded: true, success: true, importing: false }) });
		console.log("=================================");
		console.log("import successfully completed");
	} catch (err) {
		// mark the import package as done importing so it can be undone
		await knex("node")
			.where({ uuid: req.body.uuid })
			.update({ metadata: JSON.stringify({ expanded: true, success: false, importing: false }) });
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
