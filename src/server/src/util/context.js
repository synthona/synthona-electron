const knex = require('../db/knex/knex');
const day = require('dayjs');

// util function to delete associations for a node
exports.deleteAssociations = async (id) => {
	try {
		await knex('association').where({ nodeId: id }).orWhere({ linkedNode: id }).delete();
	} catch (err) {
		err.statusCode = 500;
		err.message = 'Failed to delete associations';
	}
};

// util function to mark a node as viewed
exports.markNodeView = async (uuid) => {
	// mark the node as updated
	try {
		// update in the database
		await knex('node')
			.where({ uuid })
			.update({ updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`) });
		return;
	} catch (err) {
		err.statusCode = 500;
		err.message = 'Failed to mark view in context system';
	}
};

exports.createNewAssociation = async (anchorNode, linkedNode, userId, importId) => {
	try {
		// create association
		let newAssociation = {
			nodeId: anchorNode.id,
			nodeUUID: anchorNode.uuid,
			nodeType: anchorNode.type,
			linkedNode: linkedNode.id,
			linkedNodeUUID: linkedNode.uuid,
			linkedNodeType: linkedNode.type,
			importId: importId.uuid || null,
			linkStrength: 1,
			creator: userId,
			createdAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
			updatedAt: day().add(5, 'hour').format(`YYYY-MM-DD HH:mm:ss.SSS +00:00`),
		};
		await knex('association').insert(newAssociation);
		// return the value
		return newAssociation;
	} catch (err) {
		err.statusCode = 500;
		err.message = 'Failed to mark view in context system';
	}
};

exports.regenerateCollectionPreviews = async (uid, req) => {
	return new Promise(async (resolve, reject) => {
		try {
			// fetch all the collection nodes so we can process them...
			let nodeData = await knex('node').select().where({ type: 'collection', creator: uid });
			// loop through the collections so we can updat ethem :)
			for (let collection of nodeData) {
				const collectionUUID = collection.uuid;
				// fetch the top 4 associated nodes with the collection so we can use them for the preview
				const associationResult = await knex('association')
					.select()
					.where('association.nodeUUID', collectionUUID)
					.andWhere('association.creator', uid)
					.whereIn('node.type', ['image', 'text', 'url'])
					.orWhere('association.linkedNodeUUID', collectionUUID)
					.where('association.creator', uid)
					.whereIn('node.type', ['image', 'text', 'url'])
					.leftJoin('node', function () {
						this.onNotIn('node.uuid', collectionUUID)
							.on('association.nodeId', '=', 'node.id')
							.orOn('association.linkedNode', '=', 'node.id')
							.onNotIn('node.uuid', collectionUUID);
					})
					.orderBy('association.linkStrength', 'desc')
					.limit(4);
				// create the new preview array
				let updatedPreview = [];
				// loop through the associations to create the new preview array
				for (let association of associationResult) {
					let newPreviewPath = association.preview ? association.preview : '';
					// make sure we set the url correctly for files
					if (association.isFile) {
						newPreviewPath =
							req.protocol + '://' + req.get('host') + '/file/load/' + association.uuid;
					}
					updatedPreview.push({ type: association.type, preview: newPreviewPath });
				}
				// go ahead and set the updated preview for this particular collectionUUID
				await knex('node')
					.where({ uuid: collectionUUID })
					.update({ preview: JSON.stringify(updatedPreview) });
			}
			resolve();
		} catch (err) {
			reject();
			err.statusCode = 500;
			err.message = 'Failed to regenerate user previews';
		}
	});
};
