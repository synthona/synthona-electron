const path = require('path');
const Umzug = require('umzug');

exports.checkForDatabaseUpdates = async (db) => {
  const umzug = new Umzug({
    migrations: {
      // indicates the folder containing the migration .js files
      path: path.join(__dirname, 'migrations'),
      // inject sequelize's QueryInterface in the migrations
      params: [db.sequelize.getQueryInterface()],
    },
    // indicates that the migration data should be store in the database
    // itself through sequelize. The default configuration creates a table
    // named `SequelizeMeta`.
    storage: 'sequelize',
    storageOptions: {
      sequelize: db.sequelize,
    },
  });

  (async () => {
    // checks migrations and run them if they are not already applied
    const pending = await umzug.pending();
    if (pending.length > 0) {
      console.log('✔ running migrations');
      await umzug.up();
      console.log('✔ all migrations performed successfully');
    }
  })();
  return;
};
