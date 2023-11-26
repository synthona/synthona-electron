const path = require('path');
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = (knex) => {
	/* 
   1. find all file paths WHOSE root is 'data' directory from old versions of synthona/yarnpoint...ignore all the paths which are already full paths
   2. update those in the database with the updated versions
   3. do the same thing with the users table
  */
	console.log('running shortcuts update migration');
	return new Promise(async (resolve, reject) => {
		try {
			// update nodes table
			let homeDir = require('os').homedir();
			let nodes = await knex('node').where('isFile', true).orWhere({ type: 'user' });
			// loop through all the retrieved nodes
			for (let node of nodes) {
				// create our result variables
				let resultPreview = node.preview;
				let resultPath = node.path;
				// extract the root directories so we might use them to determine if changes are needed
				const previewRoot = node.preview ? node.preview.split(path.sep)[0] : null;
				const pathRoot = node.path ? node.path.split(path.sep)[0] : null;
				// update preview if needed
				if (previewRoot === 'data' && !previewRoot.includes(homeDir)) {
					resultPreview = node.preview ? path.join(__coreDataDir, node.preview) : null;
				}
				// update path if needed
				if (pathRoot === 'data' && !pathRoot.includes(homeDir)) {
					resultPath = node.path ? path.join(__coreDataDir, node.path) : null;
				}
				// store our changes into the database
				await knex('node')
					.where({ id: node.id })
					.update({ path: resultPath, preview: resultPreview });
			}
			// update users table
			let users = await knex.select().table('user');
			for (let user of users) {
				const avatarRootPath = user.avatar ? user.avatar.split(path.sep)[0] : null;
				const headerRootPath = user.header ? user.header.split(path.sep)[0] : null;
				// update the paths if needed
				if (avatarRootPath === 'data' && !avatarRootPath.includes(homeDir)) {
					const newAvatar = user.avatar ? path.join(__coreDataDir, user.avatar) : null;
					// store in the database
					await knex('user').where({ id: user.id }).update({ avatar: newAvatar });
				}
				if (headerRootPath === 'data' && !headerRootPath.includes(homeDir)) {
					const newHeader = user.header ? path.join(__coreDataDir, user.header) : null;
					// store in the database
					await knex('user').where({ id: user.id }).update({ header: newHeader });
				}
			}
			console.log('shortcuts migration completed');
			resolve('shortcuts migration completed');
		} catch (err) {
			reject(err);
		}
	});
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = (knex) => {
	// we're going to do the same thing, but...in reverse :)
	console.log('reversing shortcuts update migration');
	return new Promise(async (resolve, reject) => {
		try {
			// update nodes table
			let nodes = await knex('node').where('isFile', true).orWhere({ type: 'user' });
			// loop through our node results
			for (let node of nodes) {
				// create our result variables
				let resultPreview = node.preview;
				let resultPath = node.path;
				// variables to check whether or not we should update anything
				let pathShouldUpdate = node.path && node.path.includes(path.join(__coreDataDir, 'data'));
				let previewShouldUpdate =
					node.preview && node.preview.includes(path.join(__coreDataDir, 'data'));
				// update preview if needed
				if (previewShouldUpdate) {
					resultPreview = node.preview
						? node.preview.substring(node.preview.lastIndexOf('data'))
						: null;
				}
				// update path if needed
				if (pathShouldUpdate) {
					resultPath = node.path ? node.path.substring(node.path.lastIndexOf('data')) : null;
				}
				// go ahead and update the node in the DB with our results
				await knex('node')
					.where({ id: node.id })
					.update({ path: resultPath, preview: resultPreview });
			}
			// update users table
			let users = await knex.select().table('user');
			for (let user of users) {
				// console.log(user);
				if (user.avatar && user.avatar.includes(path.join(__coreDataDir, 'data'))) {
					const reversedAvatar = user.avatar
						? user.avatar.substring(user.avatar.lastIndexOf('data'))
						: null;
					// store our changes in the DB
					await knex('user').where({ id: user.id }).update({ avatar: reversedAvatar });
				}
				if (user.header && user.header.includes(path.join(__coreDataDir, 'data'))) {
					const reversedHeader = user.header
						? user.header.substring(user.avatar.lastIndexOf('data'))
						: null;
					// store our changes in the DB
					await knex('user').where({ id: user.id }).update({ header: reversedHeader });
				}
			}
			console.log('shortcuts migration reversed');
			resolve('shortcuts migration reversed');
		} catch (err) {
			reject(err);
		}
	});
};
