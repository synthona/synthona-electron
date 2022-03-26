// https://httptoolkit.tech/blog/notarizing-electron-apps-with-electron-forge/
const { notarize } = require('electron-notarize');
require('dotenv').config();

// Path from here to your build app executable:
const buildOutput = require('path').resolve('out', 'synthona-darwin-x64', 'synthona.app');

module.exports = async (forgeConfig, options) => {
	if (process.platform !== 'darwin') {
		console.log('\n✔ Not a mac, skipping apple notarization');
		return;
	}

	console.log('\n✔ Starting Notarization Process');

	await notarize({
		appBundleId: process.env.APPLE_BUNDLE_ID,
		appPath: buildOutput,
		appleId: process.env.APPLE_ID,
		appleIdPassword: process.env.APPLE_ID_PASSWORD,
	}).catch((e) => {
		console.error(e);
		throw e;
	});
	return;
};
