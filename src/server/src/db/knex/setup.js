const knex = require('./knex');

exports.initializeKnex = async () => {
	console.log('running initialize knex function');
	// run any pending migrations & set up database if it hasn't been yet
	knex.migrate.latest().then((result) => {
		// there were migrations and they are now finished
		// lets log a message to the console
		if (result[1] && result[1].length > 0) {
			console.log('✔ migrations are done! :)');
		} else {
			console.log('✔ database is up to date');
		}
	});
};
