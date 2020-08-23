const path = require('path');
var fs = require('fs');
// bring in libraries for file and directory name generation
const crypto = require('crypto');

// function to delete empty directories in the data folder from a file
// NOTE: use caution editing this one

// TODO - refactor this to come in from the top level of the data directory and clear out empty directories
// just prefer this to recursion probably since this can possibly be called on files stored outside the app
exports.cleanupDataDirectoryFromFilePath = async (filePath) => {
  var parentDirectory = filePath.substring(0, filePath.lastIndexOf('/'));
  var dataDirectory = __basedir + '/data/';
  // if the filepath does not include the data directory path
  // it should not recursively delete anything
  if (!filePath.includes(dataDirectory)) {
    return;
  }
  // if the parentDirectory is also the dataDirectory, stop recursion
  if (parentDirectory === dataDirectory) {
    return;
  }
  // make sure the parent directory...exists
  if (fs.existsSync(parentDirectory)) {
    fs.readdir(parentDirectory, (err, files) => {
      if (err) {
        return next(err);
      } else {
        // if there are no files in the directory
        if (!files.length) {
          // directory appears to be empty, remove it
          fs.rmdirSync(parentDirectory);
          // recursively check to see if the directory above it is also empty
          this.cleanupDataDirectoryFromFilePath(parentDirectory);
        } else {
          // if there are still files stop recursion
          return;
        }
      }
    });
  }
};

exports.generateFileLocation = async (userId, fileName) => {
  // create a hash of the filename
  const nameHash = crypto.createHash('md5').update(fileName).digest('hex');
  // generate directories
  const directoryLayer1 = __basedir + '/data/' + userId + '/' + nameHash.substring(0, 3);
  const fileLocation =
    __basedir + '/data/' + userId + '/' + nameHash.substring(0, 3) + '/' + nameHash.substring(3, 6);
  // if new directories are needed generate them
  if (!fs.existsSync(fileLocation)) {
    if (!fs.existsSync(directoryLayer1)) {
      fs.mkdirSync(directoryLayer1);
    }
    fs.mkdirSync(fileLocation);
  }
  return fileLocation;
};
