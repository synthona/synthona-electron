const fs = require('fs');
// custom code
const { validationResult } = require('express-validator/check');
// bring in data models.
const { node, association, user } = require('../db/models');
const { Op } = require('sequelize');
// bring in libraries for file and directory name generation
const crypto = require('crypto');
// set up archiver and unzip library
const archiver = require('archiver');
var admZip = require('adm-zip');

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
    // generate export directory if it does not exist
    if (!fs.existsSync(__basedir + '/data/' + userId + '/exports/')) {
      fs.mkdirSync(__basedir + '/data/' + userId + '/exports/');
    }
    // set export name and extension
    const exportName = new Date().toDateString() + '.synth';
    const exportDest = __basedir + '/data/' + userId + '/exports/' + exportName;
    // create a file to stream archive data to.
    var output = fs.createWriteStream(exportDest);
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
        preview: 'data/' + userId + '/exports/' + exportName,
        path: 'data/' + userId + '/exports/' + exportName,
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
          where: { creator: userId },
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
    // loop through all nodes
    await nodeData.forEach((node) => {
      // add associated files to the export
      if (node.isFile) {
        let extension = node.preview.substr(node.preview.lastIndexOf('.'));
        if (fs.existsSync(node.preview)) {
          try {
            // append the associated file to the export
            archive.append(fs.createReadStream(node.preview), { name: node.uuid + extension });
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
    // generate export directory if it does not exist
    if (!fs.existsSync(__basedir + '/data/' + userId + '/exports/')) {
      fs.mkdirSync(__basedir + '/data/' + userId + '/exports/');
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
    let anchorNodeId = null;
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
      anchorNodeId = node.id;
    }
    // set export name and extension
    const exportName = anchorNodeName + '.synth';
    const exportDest = __basedir + '/data/' + userId + '/exports/' + exportName;
    // create a file to stream archive data to.
    var output = fs.createWriteStream(exportDest);
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
        preview: 'data/' + userId + '/exports/' + exportName,
        path: 'data/' + userId + '/exports/' + exportName,
        content: exportName,
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
                  { nodeId: { [Op.in]: exportIdList } },
                  { linkedNode: { [Op.in]: exportIdList } },
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
            let extension = leftNode.preview.substr(leftNode.preview.lastIndexOf('.'));
            // see if the file exists
            if (fs.existsSync(leftNode.preview)) {
              try {
                // append the associated file to the export
                archive.append(fs.createReadStream(leftNode.preview), {
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
            let extension = rightNode.preview.substr(rightNode.preview.lastIndexOf('.'));
            // see if the file exists
            if (fs.existsSync(rightNode.preview)) {
              try {
                // append the associated file to the export
                archive.append(fs.createReadStream(rightNode.preview), {
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
          let extension = anchorNode.preview.substr(anchorNode.preview.lastIndexOf('.'));
          // see if the file exists
          if (fs.existsSync(anchorNode.preview)) {
            try {
              // append the associated file to the export
              archive.append(fs.createReadStream(anchorNode.preview), {
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
    node.update(
      {
        metadata: { expanded: true },
      },
      {
        where: {
          uuid: packageUUID,
        },
      }
    );
    // generate user data directory if it does not exist
    if (!fs.existsSync(__basedir + '/data/' + userId)) {
      fs.mkdirSync(__basedir + '/data/' + userId);
    }
    // fetch the package node from the DB
    const packageNode = await node.findOne({
      where: { [Op.and]: [{ uuid: packageUUID }, { creator: userId }] },
      raw: true,
    });
    // check that the node is not already expanded
    if (packageNode.metadata && packageNode.metadata.expanded) {
      err = new Error('package is already expanded');
      err.statusCode = 500;
      throw err;
    }
    // get the fileUrl
    const packageUrl = packageNode.preview;
    // check zip buffer size before unzipping
    var buffer = new admZip(packageUrl).toBuffer();
    const maxZipSize = 1000000000; // 1GB
    if (buffer.byteLength > maxZipSize) {
      err = new Error('zip buffer exceeds max allowed size');
      err.statusCode = 500;
      throw err;
    }
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
          // if it's not a file just generate the node
          if (!nodeImport.isFile) {
            // generate node
            newNode = await node.create(
              {
                isFile: nodeImport.isFile,
                hidden: nodeImport.hidden,
                searchable: nodeImport.searchable,
                type: nodeImport.type,
                name: nodeImport.name,
                preview: nodeImport.preview,
                content: nodeImport.content,
                creator: userId,
                createdAt: nodeImport.createdAt,
                updatedAt: nodeImport.updatedAt,
                importId: packageUUID,
              },
              { silent: true }
            );
          } else {
            // load the fileEntry
            let extension = nodeImport.preview.substr(nodeImport.preview.lastIndexOf('.'));
            // use the uuid to recognize the file
            const fileEntry = zip.getEntry(nodeImport.uuid + extension);
            // create a hash of the filename
            const nameHash = crypto.createHash('md5').update(fileEntry.name).digest('hex');
            // generate directories
            const directoryLayer1 = __basedir + '/data/' + userId + '/' + nameHash.substring(0, 3);
            const directoryLayer2 =
              __basedir +
              '/data/' +
              userId +
              '/' +
              nameHash.substring(0, 3) +
              '/' +
              nameHash.substring(3, 6);
            // if new directories are needed generate them
            if (!fs.existsSync(directoryLayer2)) {
              if (!fs.existsSync(directoryLayer1)) {
                fs.mkdirSync(directoryLayer1);
              }
              fs.mkdirSync(directoryLayer2);
            }
            //extract file to the generated directory
            zip.extractEntryTo(fileEntry, directoryLayer2, false, true);
            // generate node
            newNode = await node.create(
              {
                isFile: nodeImport.isFile,
                hidden: nodeImport.hidden,
                searchable: nodeImport.searchable,
                type: nodeImport.type,
                name: nodeImport.name,
                preview:
                  'data/' +
                  userId +
                  '/' +
                  nameHash.substring(0, 3) +
                  '/' +
                  nameHash.substring(3, 6) +
                  '/' +
                  fileEntry.name,
                content: nodeImport.content,
                creator: userId,
                createdAt: nodeImport.createdAt,
                updatedAt: nodeImport.updatedAt,
                importId: packageUUID,
              },
              { silent: true }
            );
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
        // process the linkedNode and linkedNodeUUID columns
        for (let value of newNodeIdList) {
          // replace the temporary values with the correct values
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
      } else if (entry.name === 'user.json') {
        // set up main variables for processing
        let jsonData = JSON.parse(entry.getData());
        let userImport = jsonData[0];
        const updatedUser = await user.update(
          {
            displayName: userImport.displayName,
            bio: userImport.bio,
            avatar: userImport.avatar,
            header: userImport.header,
          },
          {
            where: {
              id: userId,
            },
          }
        );
      }
    }
    // mark the import package as successfully expanded
    node.update(
      {
        metadata: { expanded: true, success: true },
      },
      {
        where: {
          uuid: packageUUID,
        },
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

exports.removeSynthonaImportsByPackage = async (req, res, next) => {
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
