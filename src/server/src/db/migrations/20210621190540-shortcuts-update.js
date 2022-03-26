'use strict';
const path = require('path');
// import the DB models so we can run updates on them
const { node, user } = require('../../db/models');
const { Op } = require('sequelize');

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// THIS IS NOT A TRADITIONAL MIGRATION
			// for this one we are updating existing data, and so will have to make queries
			// against the existing database to update the PATH and PREVIEW values for
			// all isFile === true nodes, to store the full path instead of a partial one
			const results = await node.findAll({
				where: { [Op.or]: [{ isFile: true }, { type: 'user' }] },
			});
			// iterate through the results and update the values
			for (let node of results) {
				// get the root of the path, so we can make sure we only update
				// the partial paths stored in older versions of yarnpoint
				const pathRoot = node.preview ? node.preview.split(path.sep)[0] : null;
				// make sure we are only updating nodes which have partial paths from the data folder
				if (pathRoot === 'data') {
					console.log(node.name);
					const newPreview = node.preview ? path.join(__coreDataDir, node.preview) : null;
					// const newPath = node.path ? path.join(__coreDataDir, node.path) : newPreview;
					console.log('new path: ' + newPreview + '\n');
					if (node.type === 'user') {
						// for user nodes we only update the preview
						await node.update(
							{
								preview: newPreview,
							},
							{ where: { id: node.id }, silent: true }
						);
					} else if (node.type === 'image') {
						// update the node with the new full path
						await node.update(
							{
								preview: newPreview,
								path: newPreview,
							},
							{ where: { id: node.id }, silent: true }
						);
					} else {
						// for all non image & non-user files leave the preview blank
						await node.update(
							{
								preview: null,
								path: newPreview,
							},
							{ where: { id: node.id }, silent: true }
						);
					}
				}
			}
			// do the same thing for all user DB entries in the user table
			const users = await user.findAll();
			// iterate through the results and update the values
			for (let user of users) {
				//   get the root of the path for avatar & header images, so we can make sure we only update
				//  the partial paths stored in older versions of yarnpoint
				const userData = user.dataValues;
				const avatarRootPath = userData.avatar ? userData.avatar.split(path.sep)[0] : null;
				const headerRootPath = userData.header ? userData.header.split(path.sep)[0] : null;
				// make sure we are only updating nodes which need to be updated
				if (avatarRootPath === 'data') {
					const newAvatar = userData.avatar ? path.join(__coreDataDir, userData.avatar) : null;
					console.log('new avatar: ' + newAvatar);
					// update the user avatar with the new file path
					await user.update(
						{
							avatar: newAvatar,
						},
						{ where: { id: node.id }, silent: true }
					);
				}
				if (headerRootPath === 'data') {
					const newHeader = userData.header ? path.join(__coreDataDir, userData.header) : null;
					console.log('new header: ' + newHeader + '\n');
					// update the user header with the new file path
					await user.update(
						{
							header: newHeader,
						},
						{ where: { id: node.id }, silent: true }
					);
				}
			}
			console.log('SHORTCUTS-UPDATE MIGRATION COMPLETED');
		} catch (err) {
			console.log(err);
			const error = new Error('there was a problem running the shortcuts-update migration');
			error.statusCode = 404;
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log('UNDOING SHORTCUTS UPDATE MIGRATION');
			// THIS IS NOT A TRADITIONAL MIGRATION
			// in order to revert it, we are simply taking full file paths and turning them back into
			// paths which start at the data/ folder again. probably this will never be run
			// except for testing purposes, but it's probably better to have it in here anyways
			const results = await node.findAll({
				where: { [Op.or]: [{ isFile: true }, { type: 'user' }] },
			});
			// loop through the results
			for (let node of results) {
				// const pathRoot = node.path ? node.path.split(path.sep)[0] : null;
				// make sure we are only reverting nodes which need to be reverted
				if (
					node.path &&
					node.path.includes(path.join(__coreDataDir, 'data')) &&
					!node.path.includes('database.sqlite3')
				) {
					// console.log(node.name);
					const currentPath = node.path;
					let revertedPath;
					if (currentPath) {
						revertedPath = currentPath.substring(currentPath.lastIndexOf('data'));
					} else {
						revertedPath = null;
					}
					// console.log(revertedPath + '\n');
					await node.update(
						{
							preview: revertedPath,
							path: revertedPath,
						},
						{ where: { id: node.id }, silent: true }
					);
				} else if (node.type === 'user') {
					let newUserNodePreview = node.preview.substring(node.preview.lastIndexOf('data'));
					console.log('new user node preview: ' + newUserNodePreview);
					await node.update(
						{
							preview: newUserNodePreview,
						},
						{ where: { id: node.id }, silent: true }
					);
				}
			}
			// do the same thing for all user DB entries in the user table
			const users = await user.findAll();
			// iterate through the results and update the values
			for (let user of users) {
				//   get the root of the path for avatar & header images, so we can make sure we only update
				//  the partial paths stored in older versions of yarnpoint
				const userData = user.dataValues;
				// const avatarRootPath = userData.avatar ? userData.avatar.split(path.sep)[0] : null;
				// const headerRootPath = userData.header ? userData.header.split(path.sep)[0] : null;
				// make sure we are only updating nodes which need to be updated
				if (userData.avatar && userData.avatar.includes(path.join(__coreDataDir, 'data'))) {
					let revertedAvatar;
					if (userData.avatar) {
						revertedAvatar = userData.avatar.substring(userData.avatar.lastIndexOf('data'));
					} else {
						revertedAvatar = null;
					}
					console.log(revertedAvatar + '\n');
					// update the user avatar with the reverted file path
					await user.update(
						{
							avatar: revertedAvatar,
						},
						{ where: { id: node.id }, silent: true }
					);
				}
				if (userData.header && userData.header.includes(path.join(__coreDataDir, 'data'))) {
					let revertedHeader;
					if (userData.header) {
						revertedHeader = userData.header.substring(userData.header.lastIndexOf('data'));
					} else {
						revertedHeader = null;
					}
					console.log(revertedHeader + '\n');
					// update the user avatar with the reverted file path
					await user.update(
						{
							header: revertedHeader,
						},
						{ where: { id: node.id }, silent: true }
					);
				}
			}
		} catch (err) {
			console.log(err);
			const error = new Error('there was a problem undoing the shortcuts-update migration');
			error.statusCode = 404;
			throw error;
		}
	},
};
