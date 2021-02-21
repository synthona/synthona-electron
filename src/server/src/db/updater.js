const { SequelizeStorage, Umzug } = require('umzug');

exports.checkForDatabaseUpdates = async (db) => {
  await new Promise((resolve, reject) => {
    try {
      const sequelize = db.sequelize;
      // configure umzug
      const umzug = new Umzug({
        migrations: { glob: './migrations/*.js' },
        context: sequelize.getQueryInterface(),
        storage: new SequelizeStorage({ sequelize }),
        logger: console,
      });
      // run any pending migrations through umzug
      console.log('✔ running migrations');
      umzug.up();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};
