const path = require('path');
// handle case for sequelize CLI
require('dotenv').config();
global.__coreDataDir = process.env.CORE_DATA_DIRECTORY;
// set dbPath
const dbPath = path.join(__coreDataDir, 'database.sqlite3');

module.exports = {
  development: {
    storage: dbPath,
    dialect: 'sqlite',
    logging: false,
  },
  test: {
    storage: dbPath,
    dialect: 'sqlite',
    logging: false,
  },
  production: {
    storage: dbPath,
    dialect: 'sqlite',
    logging: false,
    dialectOptions: {
      ssl: {
        // ca: fs.readFileSync(__dirname + '/mysql-ca-master.crt')
      },
    },
  },
};
