// imports
const multer = require('multer');
const fs = require('fs');
const shortId = require('shortid');

// set up multer config for file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = __basedir + '/data/' + req.user.uid + '/user/';
    // generate user data directory if it does not exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir);
    }
    // second param is storage location
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // load the fileEntry
    console.log(req);
    let extension = file.originalname.substr(file.originalname.lastIndexOf('.'));
    let name = file.originalname
      .substr(0, file.originalname.lastIndexOf('.'))
      .trim()
      .replace(/\s/g, '');
    // second param is file name
    cb(null, shortId.generate() + '-' + name + extension.toLowerCase());
  },
});

// determine which mimeTypes match with which nodeTypes
const imageMimetypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/gif'];

// set up allowed mimetype config and prepare nodeType for controller
const fileFilter = (req, file, cb) => {
  if (imageMimetypes.includes(file.mimetype)) {
    file.nodeType = 'image';
  }
  cb(null, true);
};

const limits = {
  files: 1, // allow only 1 file per request
  // fileSize: '500 * 1024 * 1024', // 500 MB (max file size)
};

module.exports = multer({ storage: fileStorage, limits: limits, fileFilter: fileFilter }).single(
  'image'
);
