module.exports = {
  development: {
    storage: './server/database.sqlite3',
    dialect: 'sqlite',
    logging: false,
  },
  test: {
    storage: './server/database.sqlite3',
    dialect: 'sqlite',
    logging: false,
  },
  production: {
    storage: './server/database.sqlite3',
    dialect: 'sqlite',
    logging: false,
    dialectOptions: {
      ssl: {
        // ca: fs.readFileSync(__dirname + '/mysql-ca-master.crt')
      },
    },
  },
};
