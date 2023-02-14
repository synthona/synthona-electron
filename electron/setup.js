const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, globalShortcut } = require('electron');
// load configuration data
let packageJson = require('../package.json');
const APP_VERSION = packageJson.version;
let config;
let configDirPath = app.getPath('userData');
let configPath = path.join(configDirPath, 'config.json');

exports.loadConfig = () => {
	// check if config already exists and if it does load it
	if (fs.existsSync(configDirPath) && fs.existsSync(configPath)) {
		config = require(configPath);
		// spin off a process to double check that we have the latest config version.
		// if not, the process will automatically update the file and restart the app
		this.upgradeConfigVersion();
	} else {
		// if there's no config file yet, make sure to generate one to the latest specs
		console.log('✔ generating configuration file');
		const configJSON = JSON.stringify({
			'FULLSCREEN': true,
			'OPEN_URLS_IN_BROWSER': true,
			'HTTP_CACHE': false,
			'CLEAR_CACHE_ON_START': false,
			'ENABLE_HARDWARE_ACCELERATION': false,
			'DEBUG': false,
			'SERVER_PORT': 3077,
			'CLIENT_PORT': 3077,
			'CLIENT_BASE': 'localhost',
			'JWT_SECRET': crypto.randomBytes(100).toString('base64'),
			'REFRESH_TOKEN_SECRET': crypto.randomBytes(100).toString('base64'),
			'APP_NAME': 'synthona',
		});
		if (!fs.existsSync(configDirPath)) {
			fs.mkdirSync(configDirPath);
		}
		fs.writeFileSync(configPath, configJSON);
		config = require(configPath);
	}
	console.log('✔ loaded configuration data');
	return config;
};

exports.getConfigValues = () => {
	// console.log(config);
	return config;
};

// if i ever change how config works in the future
// np we will use versioning here to do it
exports.upgradeConfigVersion = () => {
	// we are introducing config versions, only update config if it's not added yet
	if (config.CONFIG_VERSION !== 1.0 && !(config.CONFIG_VERSION >= 1.1)) {
		// config v1.0 changes
		config.CONFIG_VERSION = 1.0;
		delete config.GRAPH_RENDER_LIMIT;
		// update the config file
		let newConfig = JSON.stringify(config);
		fs.writeFileSync(configPath, newConfig);
		console.log('config updated...');
	}
};

// need to update this to be smart enough to try to look at synthonas, if it finds nothing it looks at synthona, if nothing it looks at aetherpoints
// a little late for the folks already out there though. i'd like to anage all this from one github account honestly
// exhausing isn't it
exports.checkForUpdates = (reportNegative) => {
	const { net } = require('electron');
	const request = net.request(
		'https://raw.githubusercontent.com/synthona/synthona-electron/master/package.json'
	);
	request.on('response', (response) => {
		if (response) {
			response.on('data', (chunk) => {
				// parse the json data from the github package.json route
				let jsonData = JSON.parse(chunk);
				let githubVersion = jsonData ? jsonData.version : null;
				// check for a version match
				if (githubVersion && githubVersion === APP_VERSION) {
					console.log('✔ ' + config.APP_NAME + ' is up to date');
					if (reportNegative) {
						BrowserWindow.getFocusedWindow().webContents.send('fromMain', {
							message: 'latest-version',
						});
					}
				} else {
					console.log('a NEW version is available :)');
					BrowserWindow.getFocusedWindow().webContents.send('fromMain', {
						message: 'update-available',
					});
				}
			});
		}
	});
	request.end();
};

exports.registerQuickMenu = () => {
	// ===============================
	// bindings for quick menu
	// ===============================
	// 1 key
	let key1 = null;
	globalShortcut.register('CommandOrControl+1', () => {
		if (key1 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key1);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+1', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key1 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 2 key
	let key2 = null;
	globalShortcut.register('CommandOrControl+2', () => {
		if (key2 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key2);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+2', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key2 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 3 key
	let key3 = null;
	globalShortcut.register('CommandOrControl+3', () => {
		if (key3 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key3);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+3', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key3 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 4 key
	let key4 = null;
	globalShortcut.register('CommandOrControl+4', () => {
		if (key4 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key4);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+4', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key4 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 5 key
	let key5 = null;
	globalShortcut.register('CommandOrControl+5', () => {
		if (key5 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key5);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+5', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key5 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 6 key
	let key6 = null;
	globalShortcut.register('CommandOrControl+6', () => {
		if (key6 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key6);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+6', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key6 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 7 key
	let key7 = null;
	globalShortcut.register('CommandOrControl+7', () => {
		if (key7 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key7);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+7', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key7 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 8 key
	let key8 = null;
	globalShortcut.register('CommandOrControl+8', () => {
		if (key8 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key8);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+8', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key8 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
	// 9 key
	let key9 = null;
	globalShortcut.register('CommandOrControl+9', () => {
		if (key9 !== null && BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(key9);
		}
	});
	globalShortcut.register('CommandOrControl+ALT+9', () => {
		if (BrowserWindow.getFocusedWindow()) {
			key9 = BrowserWindow.getFocusedWindow().webContents.getURL();
		}
	});
};
