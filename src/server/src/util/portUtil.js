const knex = require('../db/knex/knex');

exports.transferImportedUserData = async (packageUUID, loggedInUserNode) => {
	console.log('\n' + 'associating imported user data to logged in user');
	//update the anchorNodes
	await knex('association')
		.where({ importId: packageUUID })
		.andWhere({ nodeType: 'user' })
		.update({ nodeUUID: loggedInUserNode.uuid, nodeId: loggedInUserNode.id });
	// update the linkedNodes
	await knex('association')
		.where({ importId: packageUUID })
		.andWhere({ linkedNodeType: 'user' })
		.update({ linkedNodeUUID: loggedInUserNode.uuid, linkedNode: loggedInUserNode.id });
	// 3) delete all user nodes from nodes table with the importId
	await knex('node').where({ type: 'user' }).andWhere({ importId: packageUUID }).delete();
};
