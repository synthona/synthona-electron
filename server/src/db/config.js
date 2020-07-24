module.exports = {
  development: {
    storage: './src/db/database.sqlite3',
    dialect: 'sqlite',
    logging: false,
  },
  test: {
    storage: './src/db/database.sqlite3',
    dialect: 'sqlite',
    logging: false,
  },
  production: {
    storage: './src/db/database.sqlite3',
    dialect: 'sqlite',
    logging: false,
    dialectOptions: {
      ssl: {
        // ca: fs.readFileSync(__dirname + '/mysql-ca-master.crt')
      },
    },
  },
};
