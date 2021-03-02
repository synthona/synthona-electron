const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node, association, user } = require('../db/models');
const { Op } = require('sequelize');
// set up archiver and unzip library
const archiver = require('archiver');
var admZip = require('adm-zip');
// custom code
const portUtil = require('../util/portUtil');
const fsUtil = require('../util/fsUtil');

// generate a data export for this user
exports.exportAllUserData = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // this comes from the is-auth middleware
    const userId = req.user.uid;
    // set export name and extension
    const currentDate = new Date();
    const exportName =
      currentDate.getMonth() +
      1 +
      '-' +
      currentDate.getDate() +
      '-' +
      currentDate.getFullYear() +
      ' @ ' +
      currentDate.getHours() +
      '-' +
      currentDate.getMinutes() +
      '-' +
      currentDate.getSeconds() +
      '.synth';

    const exportDest = await fsUtil.generateFileLocation(userId, exportName);
    const exportFile = path.join(exportDest, exportName);
    const dbFileUrl = exportFile.substring(exportFile.lastIndexOf('data'));
    // create a file to stream archive data to.
    var output = fs.createWriteStream(exportFile);
    var archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });
    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on('close', async () => {
      // console.log(archive.pointer() + ' total bytes');
      // console.log('archiver has been finalized and the output file descriptor has closed.');
      // create node when the export is done
      await node.create({
        isFile: true,
        hidden: false,
        searchable: true,
        type: 'package',
        name: exportName,
        preview: dbFileUrl,
        path: dbFileUrl,
        content: exportName,
        creator: userId,
      });
      // TODO: send back the created export to the client as a file
      res.sendStatus(200);
    });

    // This event is fired when the data source is drained no matter what was the data source.
    output.on('end', function () {
      // console.log('Data has been exported');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });

    // good practice to catch this error explicitly
    archive.on('error', function (err) {
      throw err;
    });

    // load in the node and association export-data from the database
    const nodeData = await node.findAll({
      where: {
        creator: userId,
        [Op.and]: [{ [Op.not]: { type: 'package' } }],
      },
      order: [['updatedAt', 'DESC']],
      // attributes: ['id', 'uuid'],
      // include the associations
      include: [
        {
          model: association,
          where: { [Op.and]: [{ [Op.not]: { linkedNodeType: 'package' } }, { creator: userId }] },
          required: false,
          as: 'original',
          attributes: [
            'id',
            'nodeId',
            'nodeUUID',
            'nodeType',
            'linkedNode',
            'linkedNodeUUID',
            'linkedNodeType',
            'linkStrength',
            'updatedAt',
            'createdAt',
          ],
        },
      ],
    });
    // loop through all nodes to add files into export
    await nodeData.forEach((node) => {
      // add associated files to the export
      if (node.isFile || node.type === 'user') {
        let extension = node.preview.substring(node.preview.lastIndexOf('.'));
        let nodeFile = path.join(__coreDataDir, node.preview);
        if (fs.existsSync(nodeFile)) {
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
    });
    // stringify JSON
    const nodeString = JSON.stringify(nodeData);
    // append a file containing the nodeData
    archive.append(nodeString, { name: '/db/nodes.json' });
    // load in the user export-data from the database
    const userData = await user.findAll({
      where: {
        id: userId,
      },
      raw: true,
    });
    // get the json object for the logged in user
    const userValues = userData[0];
    // add avatar files to the export
    if (userValues.avatar) {
      let extension = userValues.avatar.substring(userValues.avatar.lastIndexOf('.'));
      let avatarPath = path.join(__coreDataDir, userValues.avatar);
      if (fs.existsSync(avatarPath)) {
        try {
          // append the associated file to the export
          archive.append(fs.createReadStream(avatarPath), {
            name: userValues.username + '-avatar' + extension,
          });
        } catch (err) {
          err.statusCode = 500;
          throw err;
        }
      }
    }
    // add header to export
    if (userValues.header) {
      let extension = userValues.header.substring(userValues.header.lastIndexOf('.'));
      let headerPath = path.join(__coreDataDir, userValues.header);
      if (fs.existsSync(headerPath)) {
        try {
          // append the associated file to the export
          archive.append(fs.createReadStream(headerPath), {
            name: userValues.username + '-header' + extension,
          });
        } catch (err) {
          err.statusCode = 500;
          throw err;
        }
      }
    }
    // stringify JSON
    const userString = JSON.stringify(userData);
    // append a file containing the userData
    archive.append(userString, { name: '/db/user.json' });
    // add a metadata file
    const metadataString = JSON.stringify({ version: process.env.VERSION });
    // append a file containing the metadata
    archive.append(metadataString, { name: '/db/metadata.json' });
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
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    let exportDirectory = path.join(__coreDataDir, 'data', userId, 'exports');
    // generate export directory if it does not exist
    if (!fs.existsSync(exportDirectory)) {
      fs.mkdirSync(exportDirectory);
    }
    // get the values out of the query
    const exportAnchorUUID = req.body.uuid;
    const includeAnchorNode = true;

    // get the list of nodes so the ids can be put into a
    //  list for the followup query
    const nodeIdListQuery = await node.findAll({
      where: {
        uuid: exportAnchorUUID,
        creator: userId,
      },
      attributes: ['id', 'name'],
      include: [
        {
          model: node,
          as: 'left',
          attributes: ['id', 'name'],
        },
        {
          model: node,
          as: 'right',
          attributes: ['id', 'name'],
        },
      ],
    });

    // create a list of exported IDS so incomplete
    // associations can be removed from the export
    const exportIdList = [];
    // let anchorNodeId = null;
    let anchorNodeName = '';
    for (let node of nodeIdListQuery) {
      if (node.left) {
        for (let leftNode of node.left) {
          exportIdList.push(leftNode.id);
        }
      }
      if (node.right) {
        for (let rightNode of node.right) {
          exportIdList.push(rightNode.id);
        }
      }
      // set anchorNodeName
      anchorNodeName = node.name.trim();
      // add the anchorNode
      exportIdList.push(node.id);
      // anchorNodeId = node.id;
    }
    // set export name, destination, and extension
    const exportName = anchorNodeName + '.synth';
    const exportDest = await fsUtil.generateFileLocation(userId, exportName);
    const exportFile = path.join(exportDest, exportName);
    const dbFileUrl = exportFile.substring(exportFile.lastIndexOf('data'));
    // create a file to stream archive data to.
    var output = fs.createWriteStream(exportFile);
    var archive = archiver('zip', {
      zlib: { level: 9 }, // Sets the compression level.
    });
    // listen for all archive data to be written
    // 'close' event is fired only when a file descriptor is involved
    output.on('close', async () => {
      // console.log(archive.pointer() + ' total bytes');
      // console.log('archiver has been finalized and the output file descriptor has closed.');
      // create node when the export is done
      await node.create({
        isFile: true,
        hidden: false,
        searchable: true,
        type: 'package',
        name: anchorNodeName,
        preview: dbFileUrl,
        path: dbFileUrl,
        content: anchorNodeName,
        creator: userId,
      });
      // TODO: send back the created export to the client as a file
      res.sendStatus(200);
    });

    // // This event is fired when the data source is drained no matter what was the data source.
    output.on('end', function () {
      // console.log('export created');
    });

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log warning
      } else {
        // throw error
        throw err;
      }
    });
    // // good practice to catch this error explicitly
    archive.on('error', function (err) {
      throw err;
    });
    // make another query to fetch the export data based on
    // the exportIdList we already have
    const exportData = await node.findAll({
      where: {
        uuid: exportAnchorUUID,
        creator: userId,
      },
      include: [
        {
          model: node,
          required: false,
          as: 'right',
          include: [
            {
              model: association,
              as: 'original',
              required: false,
              attributes: [
                'id',
                'nodeId',
                'nodeUUID',
                'nodeType',
                'linkedNode',
                'linkedNodeUUID',
                'linkedNodeType',
                'linkStrength',
                'updatedAt',
                'createdAt',
              ],
              where: {
                [Op.and]: [
                  // we only want to grab the associations where both items,
                  // left and right, are associate with packageUUID
                  { nodeId: { [Op.in]: exportIdList } },
                  { linkedNode: { [Op.in]: exportIdList } },
                ],
              },
            },
          ],
        },
        {
          model: node,
          required: false,
          as: 'left',
          include: [
            {
              model: association,
              attributes: [
                'id',
                'nodeId',
                'nodeUUID',
                'nodeType',
                'linkedNode',
                'linkedNodeUUID',
                'linkedNodeType',
                'linkStrength',
                'updatedAt',
                'createdAt',
              ],
              as: 'original',
              required: false,
              where: {
                [Op.and]: [
                  // we only want to grab the associations where both items,
                  // left and right, are associated with packageUUID
                  { nodeId: { [Op.in]: exportIdList } },
                  { linkedNode: { [Op.in]: exportIdList } },
                  { [Op.not]: { nodeType: 'package' } },
                  { [Op.not]: { linkedNodeType: 'package' } },
                ],
              },
            },
          ],
        },
        {
          model: association,
          attributes: [
            'id',
            'nodeId',
            'nodeUUID',
            'nodeType',
            'linkedNode',
            'linkedNodeUUID',
            'linkedNodeType',
            'linkStrength',
            'updatedAt',
            'createdAt',
          ],
          required: false,
          as: 'original',
        },
      ],
    });

    // loop through the data to restructure it into the export format
    const exportJSON = [];
    let anchorNode = null;
    for (let node of exportData) {
      anchorNode = node;
      if (node.left) {
        for (let leftNode of node.left) {
          if (leftNode.isFile) {
            let extension = leftNode.preview.substring(leftNode.preview.lastIndexOf('.'));
            let leftPreviewPath = path.join(__coreDataDir, leftNode.preview);
            // see if the file exists
            if (fs.existsSync(leftPreviewPath)) {
              try {
                // append the associated file to the export
                archive.append(fs.createReadStream(leftPreviewPath), {
                  name: leftNode.uuid + extension,
                });
              } catch (err) {
                err.statusCode = 500;
                throw err;
              }
            }
          }
          exportJSON.push(leftNode);
          delete leftNode.dataValues.association;
        }
        // remove these values so they are not duplicated in the export
        delete anchorNode.dataValues.left;
      }
      if (node.right) {
        for (let rightNode of node.right) {
          if (rightNode.isFile) {
            let extension = rightNode.preview.substring(rightNode.preview.lastIndexOf('.'));
            let rightPreviewPath = path.join(__coreDataDir, rightNode.preview);
            // see if the file exists
            if (fs.existsSync(rightPreviewPath)) {
              try {
                // append the associated file to the export
                archive.append(fs.createReadStream(rightPreviewPath), {
                  name: rightNode.uuid + extension,
                });
              } catch (err) {
                err.statusCode = 500;
                throw err;
              }
            }
          }
          exportJSON.push(rightNode);
          delete rightNode.dataValues.association;
        }
        // remove these values so they are not duplicated in the export
        delete anchorNode.dataValues.right;
      }
      // add the anchor node
      if (includeAnchorNode) {
        if (anchorNode.isFile) {
          let extension = anchorNode.preview.substring(anchorNode.preview.lastIndexOf('.'));
          let anchorNodePreviewPath = path.join(__coreDataDir, anchorNode.preview);
          // see if the file exists
          if (fs.existsSync(anchorNodePreviewPath)) {
            try {
              // append the associated file to the export
              archive.append(fs.createReadStream(anchorNodePreviewPath), {
                name: anchorNode.uuid + extension,
              });
            } catch (err) {
              err.statusCode = 500;
              throw err;
            }
          }
        }
        exportJSON.push(anchorNode);
      }
    }
    // stringify JSON
    const nodeString = JSON.stringify(exportJSON);
    // append a file containing the nodeData
    archive.append(nodeString, { name: '/db/nodes.json' });
    // add a metadata file
    const metadataString = JSON.stringify({ version: process.env.VERSION });
    // append a file containing the metadata
    archive.append(metadataString, { name: '/db/metadata.json' });
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

exports.unpackSynthonaImport = async (req, res, next) => {
  try {
    // catch validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // this comes from the is-auth middleware
    const userId = req.user.uid;
    // uuid of the import package node
    const packageUUID = req.body.uuid;
    // mark the import package as expanded so undo is possible even if the operation fails
    await node.update(
      {
        metadata: { expanded: true },
      },
      {
        where: {
          uuid: packageUUID,
        },
      }
    );
    let userDirectoryPath = path.join(__coreDataDir, 'data', userId);
    // generate user data directory if it does not exist
    if (!fs.existsSync(userDirectoryPath)) {
      fs.mkdirSync(userDirectoryPath);
    }
    // fetch the package node from the DB
    const packageNode = await node.findOne({
      where: { [Op.and]: [{ uuid: packageUUID }, { creator: userId }] },
      raw: true,
    });
    // fetch the logged in user from the DB
    const loggedInUser = await user.findOne({
      where: {
        id: userId,
      },
    });
    // get the node for the logged in user
    const loggedInUserNode = await node.findOne({
      where: {
        path: loggedInUser.username,
        creator: userId,
        type: 'user',
      },
    });
    // check that the node is not already expanded
    if (packageNode.metadata && packageNode.metadata.expanded) {
      err = new Error('package is already expanded');
      err.statusCode = 500;
      throw err;
    }
    // get the fileUrl
    const packageUrl = path.join(__coreDataDir, packageNode.preview);
    // check zip buffer size before unzipping
    // var buffer = new admZip(packageUrl).toBuffer();
    // const maxZipSize = 1000000000; // 1GB
    // if (buffer.byteLength > maxZipSize) {
    //   err = new Error('zip buffer exceeds max allowed size');
    //   err.statusCode = 500;
    //   throw err;
    // }
    // create new reference to zip
    var zip = new admZip(packageUrl);
    var zipEntries = zip.getEntries();
    // loop through the zip entries and create nodes for them
    for (let entry of zipEntries) {
      // loop through the nodes.json file
      if (entry.name === 'nodes.json') {
        // set up main variables for processing
        let jsonData = JSON.parse(entry.getData());
        let newNode = {};
        let newNodeIdList = [];
        // iterate through the JSON data
        for (let nodeImport of jsonData) {
          console.log('importing ' + nodeImport.name);
          // handle file node imports
          if (nodeImport.isFile) {
            // load the fileEntry
            let extension = nodeImport.preview.substring(nodeImport.preview.lastIndexOf('.'));
            // use the uuid to recognize the file
            const fileEntry = zip.getEntry(nodeImport.uuid + extension);
            let filePath;
            if (fileEntry && fileEntry.name) {
              // generate the file location and get file path
              filePath = await fsUtil.generateFileLocation(userId, fileEntry.name);
              //extract file to the generated directory
              zip.extractEntryTo(fileEntry, filePath, false, true);
            } else {
              console.log('file import error at: ');
              console.log(nodeImport);
            }
            const dbFilePath = path.join(
              filePath.substring(filePath.lastIndexOf('data')),
              fileEntry.name
            );
            // generate node
            newNode = await node.create({
              isFile: nodeImport.isFile,
              hidden: nodeImport.hidden,
              searchable: nodeImport.searchable,
              type: nodeImport.type,
              name: nodeImport.name,
              preview: dbFilePath || null,
              content: nodeImport.content,
              path: nodeImport.path,
              creator: userId,
              pinned: nodeImport.pinned,
              createdAt: nodeImport.createdAt,
              importId: packageUUID,
            });
          }
          // default import code
          else {
            if (nodeImport.type === 'user') {
              nodeImport.path = loggedInUser.username;
            }
            // generate node
            newNode = await node.create({
              isFile: nodeImport.isFile,
              hidden: nodeImport.hidden,
              searchable: nodeImport.searchable,
              type: nodeImport.type,
              name: nodeImport.name,
              preview: nodeImport.preview,
              content: nodeImport.content,
              path: nodeImport.path,
              creator: userId,
              pinned: nodeImport.pinned,
              createdAt: nodeImport.createdAt,
              importId: packageUUID,
            });
          }
          // if the node in question has associations, process them
          if (nodeImport.original) {
            // loop through the associations for the current node from the JSON file
            for (associationImport of nodeImport.original) {
              // create the association as-it-appears, but set the
              // nodeId and nodeUUID to the new values. linkedNode
              // and linkedNodeUUID will temporarily have the wrong values. this will
              // be corrected at a second pass later in the import
              await association.create(
                {
                  nodeId: newNode.id,
                  nodeUUID: newNode.uuid,
                  nodeType: newNode.type,
                  linkedNode: associationImport.linkedNode,
                  linkedNodeUUID: associationImport.linkedNodeUUID,
                  linkedNodeType: associationImport.linkedNodeType,
                  linkStrength: associationImport.linkStrength,
                  creator: userId,
                  importId: packageUUID,
                  createdAt: associationImport.createdAt,
                  updatedAt: associationImport.updatedAt,
                },
                { silent: true }
              );
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
        }
        // process the linkedNode and linkedNodeUUID columns
        for (let value of newNodeIdList) {
          // update the UUIDs in all text content to reflect new post-import values
          // for testing only
          portUtil.findAndReplaceTextNodeUUID(value.oldUUID, value.newUUID, packageUUID);
          // replace the temporary values with the correct values for associations
          association.update(
            {
              linkedNode: value.newId,
              linkedNodeUUID: value.newUUID,
            },
            {
              where: {
                [Op.and]: [
                  { linkedNode: value.oldId },
                  { linkedNodeUUID: value.oldUUID },
                  { importId: packageUUID },
                ],
              },
            },
            { silent: true }
          );
        }
        // synthesize the imported user information with the loggedInUser
        await portUtil.transferImportedUserData(packageUUID, loggedInUserNode);
      } else if (entry.name === 'user.json') {
        // set up main variables for processing
        let jsonData = JSON.parse(entry.getData());
        let userImport = jsonData[0];
        // load the avatar and header info
        let avatarExtension = userImport.avatar.substring(userImport.avatar.lastIndexOf('.'));
        let headerExtension = userImport.header.substring(userImport.header.lastIndexOf('.'));
        // load both file entries
        const avatarFileEntry = zip.getEntry(userImport.username + '-avatar' + avatarExtension);
        const headerFileEntry = zip.getEntry(userImport.username + '-header' + headerExtension);
        // create empty variables for filepaths
        let avatarFilePath;
        let headerFilePath;
        // import the avatar image
        if (avatarFileEntry && avatarFileEntry.name) {
          avatarFilePath = path.join(__coreDataDir, 'data', userId, 'user');
          //extract file
          zip.extractEntryTo(avatarFileEntry, avatarFilePath, false, true);
        }
        // import the header image
        if (headerFileEntry && headerFileEntry.name) {
          headerFilePath = path.join(__coreDataDir, 'data', userId, 'user');
          //extract file
          zip.extractEntryTo(headerFileEntry, headerFilePath, false, true);
        }
        // file paths for DB storage
        const avatarDbPath = path.join(
          avatarFilePath.substring(avatarFilePath.lastIndexOf('data')),
          avatarFileEntry.name
        );
        const headerDbPath = path.join(
          headerFilePath.substring(headerFilePath.lastIndexOf('data')),
          headerFileEntry.name
        );
        // update the logged in user with the imported data
        console.log('update logged in user object');
        await user.update(
          {
            displayName: userImport.displayName,
            bio: userImport.bio,
            avatar: avatarDbPath || null,
            header: headerDbPath || null,
          },
          {
            where: {
              id: userId,
            },
          }
        );
        console.log('update logged in user node');
        // update the logged in user node as well
        await node.update(
          {
            preview: avatarDbPath,
            content: userImport.bio,
          },
          {
            where: {
              creator: userId,
              type: 'user',
            },
          }
        );
      }
    }
    // generate the collection previews for all imports
    // get a list of nodes which are files so the associated files can be removed
    const collectionList = await node.findAll({
      where: {
        [Op.and]: [{ importId: packageUUID }, { creator: userId }, { type: 'collection' }],
      },
      silent: true,
    });
    console.log('regenerating collection previews');
    for (collection of collectionList) {
      const result = await association.findAll({
        where: {
          creator: userId,
          [Op.or]: [{ nodeId: collection.id }, { linkedNode: collection.id }],
        },
        limit: 4,
        silent: true,
        // sort by linkStrength
        order: [['linkStrength', 'DESC']],
        attributes: [
          'id',
          'nodeId',
          'nodeType',
          'linkedNode',
          'linkedNodeType',
          'linkStrength',
          'updatedAt',
        ],
        // include whichever node is the associated one for
        include: [
          {
            model: node,
            where: {
              [Op.and]: { id: { [Op.not]: collection.id }, type: { [Op.not]: 'collection' } },
            },
            required: false,
            as: 'original',
            attributes: ['id', 'uuid', 'isFile', 'type', 'preview', 'name'],
          },
          {
            model: node,
            where: {
              [Op.and]: { id: { [Op.not]: collection.id }, type: { [Op.not]: 'collection' } },
            },
            required: false,
            as: 'associated',
            attributes: ['id', 'uuid', 'isFile', 'type', 'preview', 'name'],
          },
        ],
      });
      var collectionPreview = [];
      var nodePreview = null;
      console.log('\n' + '=================================');
      console.log(collection.name);
      console.log('=================================');
      for (value of result) {
        if (value.original) {
          console.log(value.original.name);
          // store instance url in the collection preview if it is a file
          if (value.original.isFile) {
            nodePreview = value.original.preview
              ? req.protocol + '://' + req.get('host') + '/file/load/' + value.original.uuid
              : null;
          } else {
            nodePreview = value.original.preview;
          }
          // push the preview for this particular node onto the collection preview
          collectionPreview.push({ type: value.original.type, preview: nodePreview });
        }
        if (value.associated) {
          console.log(value.associated.name);
          // store instance url in the collection preview if it is a file
          if (value.associated.isFile) {
            nodePreview = value.associated.preview
              ? req.protocol + '://' + req.get('host') + '/file/load/' + value.associated.uuid
              : null;
          } else {
            nodePreview = value.associated.preview;
          }
          // push the preview for this particular node onto the collection preview
          collectionPreview.push({
            type: value.associated.type,
            preview: nodePreview,
          });
        }
      }
      // update the preview
      await node.update(
        {
          preview: JSON.stringify(collectionPreview),
        },
        {
          where: {
            id: collection.id,
            creator: userId,
          },
          silent: true,
        }
      );
    }
    console.log('\n' + '=================================');
    console.log('marking package as imported');
    // mark the import package as successfully expanded
    node.update(
      {
        metadata: { expanded: true, success: true },
      },
      {
        where: {
          uuid: packageUUID,
        },
        silent: true,
      }
    );
    const bulkUtil = require('../util/bulkUtil');
    await bulkUtil.countBrokenAssociations();
    console.log('\n');
    console.log('=================================');
    console.log('import successfully completed');
    console.log('=================================');
    // send response
    res.sendStatus(200);
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
      const error = new Error('Validation Failed');
      error.statusCode = 422;
      error.data = errors.array();
      throw error;
    }
    // this comes from the is-auth middleware
    const uid = req.user.uid;
    // uuid of the import package node
    const packageUUID = req.body.uuid;
    // get a list of nodes which are files so the associated files can be removed
    const nodelist = await node.findAll({
      where: {
        [Op.and]: [
          { importId: packageUUID },
          { creator: uid },
          { isFile: true },
          { [Op.not]: { type: 'user' } },
        ],
      },
    });
    // remove all the files
    for (fileNode of nodelist) {
      var filePath = path.join(__coreDataDir, fileNode.preview);
      // remove the file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        // clean up any empty folders created by this deletion
        fsUtil.cleanupDataDirectoryFromFilePath(filePath);
      }
    }
    // remove all the nodes and associations created by this package
    await node.destroy({
      where: {
        [Op.and]: [{ importId: packageUUID }, { creator: uid }],
      },
    });
    await association.destroy({
      where: { [Op.and]: [{ importId: packageUUID }, { creator: uid }] },
    });
    await node.update(
      {
        metadata: null,
      },
      {
        where: { [Op.and]: [{ uuid: packageUUID }, { creator: uid }] },
      }
    );
    // send response
    res.sendStatus(200);
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};
