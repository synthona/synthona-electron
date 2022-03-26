const path = require('path');
const fs = require('fs');
const crytpo = require('crypto');
const {
	app,
	session,
	shell,
	globalShortcut,
	BrowserWindow,
	Menu,
	clipboard,
	ipcMain,
} = require('electron');
const contextMenu = require('electron-context-menu');

// load configuration data
let packageJson = require('./package.json');
const APP_VERSION = packageJson.version;
let config;
let configDirPath = app.getPath('userData');
let configPath = path.join(configDirPath, 'config.json');
let databasePath = path.join(configDirPath, 'database.sqlite3');
let dataFolderPath = path.join(configDirPath, 'data');
// check if config already exists and if it does load it
if (fs.existsSync(configPath) && fs.existsSync(configPath)) {
	config = require(configPath);
} else {
	// if there's no config file yet, make sure to generate one
	console.log('✔ generating configuration file');
	const configJSON = JSON.stringify({
		'FULLSCREEN': true,
		'OPEN_URLS_IN_BROWSER': true,
		'GRAPH_RENDER_LIMIT': 100,
		'HTTP_CACHE': false,
		'CLEAR_CACHE_ON_START': false,
		'ENABLE_HARDWARE_ACCELERATION': false,
		'DEBUG': false,
		'SERVER_PORT': 3077,
		'CLIENT_PORT': 3077,
		'CLIENT_BASE': 'localhost',
		'JWT_SECRET': crytpo.randomBytes(100).toString('base64'),
		'REFRESH_TOKEN_SECRET': crytpo.randomBytes(100).toString('base64'),
		'APP_NAME': 'synthona',
	});
	if (!fs.existsSync(configDirPath)) {
		fs.mkdirSync(configDirPath);
	}
	fs.writeFileSync(configPath, configJSON);
	config = require(configPath);
}
console.log('✔ loaded configuration data');

if (!config.HTTP_CACHE) {
	console.log('✔ disabled http cache');
	// http cache is disabled by default since it interferes with the import/export system
	// but still allow "power-users" to edit the config file to make it "always on" until it breaks
	// for them. eventually i'll allow editing the config in-app and this will not be an issue hopefully
	// TODO: allow in-app config editing and allow setting a flag to disable cache on next restart only
	app.commandLine.appendSwitch('disable-http-cache');
} else {
	console.log('✔ starting with HTTP caching enabled');
}

// prevent squirrel installer bug on windows that makes app start during installation
// prevent squirrel installer bug on windows that makes app start during installation
(() => {
	if (require('electron-squirrel-startup')) return app.quit();
})();

let serverReady = false;
let electronReady = false;
let mainWindowCreated = false;
let windowList = [];

console.log('✔ creating server process');
const { fork } = require('child_process');
const serverProcess = fork(path.join(__dirname, './src/server/app.js'), ['args'], {
	env: {
		'ELECTRON_RUN_AS_NODE': '1',
		'PORT': config.SERVER_PORT,
		'APP_NAME': config.APP_NAME,
		'CLIENT_URL': 'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT,
		'FRONTEND_DEV_MODE': config.CLIENT_PORT === config.SERVER_PORT,
		'JWT_SECRET': config.JWT_SECRET,
		'REFRESH_TOKEN_SECRET': config.REFRESH_TOKEN_SECRET,
		'VERSION': APP_VERSION,
		'CORE_DATA_DIRECTORY': app.getPath('userData'),
		'GRAPH_RENDER_LIMIT': config.GRAPH_RENDER_LIMIT,
	},
});

serverProcess.on('message', (message) => {
	// test
	// serverProcess.send({ test: 'hello' });
	// existing
	if (message === 'server-started') {
		serverReady = true;
		if (serverReady && electronReady && mainWindowCreated) {
			windowList[0].reload();
		}
		// check for updates
		checkForUpdates();
	} else {
		// HERE
		// this is where we recieve messages from the server, ANY message!
		// this is how we can take a string command from the server to, say, spawn a file-picker
		// and we can send messages back??? somehow
		// console.log(message);
	}
});

serverProcess.on('exit', (code, sig) => {
	// finishing`
	console.log('✔ goodnight!');
});

serverProcess.on('error', (error) => {
	console.log(error);
});

const mainWindow = (initUrl) => {
	console.log('✔ creating window');
	// Create the browser window.
	let newWindow = new BrowserWindow({
		width: 1920,
		height: 1080,
		fullscreen: config.FULLSCREEN,
		webPreferences: {
			nodeIntegration: false,
			spellcheck: true,
			enableRemoteModule: false,
			worldSafeExecuteJavaScript: true,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'), // use a preload script
		},
		show: false,
	});
	// add it to the window list
	windowList.push(newWindow);
	// add the context menu
	contextMenu({
		prepend: (defaultActions, params, browserWindow) => [
			{
				label: 'open as new window',
				visible: validUrl(params.linkURL),
				click: () => {
					createNewWindowAtURL(params.linkURL);
				},
			},
			{
				label: 'emoji',
				visible: params.mediaType !== 'image',
				click: () => {
					app.showEmojiPanel();
				},
			},
		],
		labels: {
			copyImage: 'copy image',
			paste: 'paste',
			copy: 'copy',
			cut: 'cut',
			inspect: 'inspect',
			copyImageAddress: 'copy image address',
		},
		showSearchWithGoogle: false,
		showInspectElement: false,
		showCopyImageAddress: true,
		showCopyImage: true,
	});
	// register the main app menu
	registerAppMenu();
	// match the background color to the app theme
	newWindow.setBackgroundColor('#272727');
	// set the localhost URL for the app to load
	newWindow.loadURL('http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT);
	// set behaviour for opening a link in new tab
	newWindow.webContents.on('new-window', function (e, url) {
		if (config.OPEN_URLS_IN_BROWSER) {
			e.preventDefault();
			// open url in user's default browser
			shell.openExternal(url);
		}
	});
	// mark window as created and electron as ready
	electronReady = true;
	mainWindowCreated = true;
	// clear the webcontents
	if (config.CLEAR_CACHE_ON_START) {
		newWindow.webContents.session.clearStorageData();
	}
	// show the window
	newWindow.show();
};

// disable hardware acceleration to prevent rendering bug
if (!config.ENABLE_HARDWARE_ACCELERATION) {
	app.disableHardwareAcceleration();
} else {
	console.log('✔ starting with hardware acceleration enabled');
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', mainWindow);
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('ready', () => {
	// register window shortcuts
	globalShortcut.register('CommandOrControl+E', () => {
		app.showEmojiPanel();
	});
	globalShortcut.register('CommandOrControl+H', () => {
		if (BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(
				'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/'
			);
		}
	});
	globalShortcut.register('CommandOrControl+G', () => {
		if (BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(
				'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/graph/'
			);
		}
	});
	globalShortcut.register('CommandOrControl+J', () => {
		if (BrowserWindow.getFocusedWindow()) {
			BrowserWindow.getFocusedWindow().loadURL(
				'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/pins/'
			);
		}
	});
	// register the quickmenu system
	registerQuickMenu();
	// if we're not in debug mode, enable security policies
	if (!config.DEBUG) {
		session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					'Content-Security-Policy': ["default-src 'self'; img-src *; object-src 'none';"],
				},
			});
		});
	}
});

// set up ipc event
ipcMain.on('toMain', (event, args) => {
	// TODO: this whole findInPage thing...the findNext feature doesn't work
	// i think there's actually an issue with the electron implementation
	// in the meantime, at least the basic functionality works now
	if (args.action && typeof args.action === 'string') {
		switch (args.action) {
			case 'search':
				if (args.query && typeof args.query === 'string') {
					BrowserWindow.getFocusedWindow().webContents.findInPage(args.query, { forward: true });
				}
				return;
			case 'hide-search':
				BrowserWindow.getFocusedWindow().webContents.stopFindInPage('clearSelection');
				return;
			default:
				return;
		}
	}
});

app.on('before-quit', () => {
	console.log('✔ winding down');
	serverProcess.kill('SIGINT');
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0 && serverReady && electronReady) {
		mainWindow();
	}
});

const createNewWindowAtURL = (initUrl) => {
	console.log('✔ creating window at ' + initUrl);
	// Create the browser window.
	let newWindow = new BrowserWindow({
		width: 1920,
		height: 1080,
		fullscreen: config.FULLSCREEN,
		webPreferences: {
			nodeIntegration: false,
			spellcheck: true,
			enableRemoteModule: false,
			worldSafeExecuteJavaScript: true,
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'), // use a preload script
		},
		show: false,
	});
	// add it to the window list
	windowList.push(newWindow);
	// match the background color to the app theme
	newWindow.setBackgroundColor('#272727');
	// set the localhost URL for the app to load
	newWindow.loadURL(initUrl);
	// set behaviour for opening a link in new tab
	newWindow.webContents.on('new-window', function (e, url) {
		if (config.OPEN_URLS_IN_BROWSER) {
			e.preventDefault();
			// open url in user's default browser
			shell.openExternal(url);
		}
	});
	// clear the webcontents
	if (config.CLEAR_CACHE_ON_START) {
		newWindow.webContents.session.clearStorageData();
	}
	// show the window
	newWindow.show();
};

const registerQuickMenu = () => {
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

const registerAppMenu = () => {
	// set up the app menu
	const isMac = process.platform === 'darwin';
	const menu = Menu.buildFromTemplate([
		...(isMac
			? [
					{
						label: app.name,
						submenu: [
							{ role: 'about' },
							{ type: 'separator' },
							{ role: 'services' },
							{ type: 'separator' },
							{ role: 'hide' },
							{ role: 'hideothers' },
							{ role: 'unhide' },
							{ type: 'separator' },
							{ role: 'quit' },
						],
					},
			  ]
			: []),
		// { role: 'fileMenu' }
		{
			label: 'App',
			submenu: [
				{
					label: 'Home',
					accelerator: 'CommandOrControl+H',
					click: async () => {
						BrowserWindow.getFocusedWindow().loadURL(
							'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/'
						);
					},
				},
				{
					label: 'Graph',
					accelerator: 'CommandOrControl+G',
					click: async () => {
						BrowserWindow.getFocusedWindow().loadURL(
							'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/graph/'
						);
					},
				},
				{ type: 'separator' },
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ type: 'separator' },
				{
					label: 'New Window',
					accelerator: 'CommandOrControl+N',
					click: async () => {
						mainWindow();
					},
				},
				isMac ? { role: 'close' } : { role: 'quit' },
			],
		},
		// { role: 'editMenu' }
		{
			label: 'Edit',
			submenu: [
				{
					label: 'Find In Page',
					accelerator: 'CommandOrControl+F',
					click: async () => {
						// send message to main
						BrowserWindow.getFocusedWindow().webContents.send('fromMain', {
							message: 'search',
						});
					},
				},
				{
					label: 'Search All',
					accelerator: 'CommandOrControl+L',
					click: async () => {
						// send message to main
						BrowserWindow.getFocusedWindow().webContents.send('fromMain', {
							message: 'search-all',
						});
					},
				},
				{
					label: 'Copy Url',
					click: async () => {
						let currentUrl = BrowserWindow.getFocusedWindow().webContents.getURL();
						clipboard.writeText(currentUrl);
					},
				},
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				...(isMac
					? [
							{ role: 'pasteAndMatchStyle' },
							{ role: 'delete' },
							{ role: 'selectAll' },
							{ type: 'separator' },
							{
								label: 'Speech',
								submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }],
							},
					  ]
					: [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
			],
		},
		// { role: 'viewMenu' }
		{
			label: 'View',
			submenu: [
				{ role: 'togglefullscreen' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
			],
		},
		{
			label: 'Advanced',
			submenu: [
				{
					label: 'Show Config',
					click: async () => {
						shell.showItemInFolder(configPath);
					},
				},
				{
					label: 'Show Database',
					click: async () => {
						shell.showItemInFolder(databasePath);
					},
				},
				{
					label: 'Show Data',
					click: async () => {
						shell.showItemInFolder(dataFolderPath);
					},
				},
				{ role: 'toggledevtools', visible: false },
			],
		},
		{
			label: 'Info',
			submenu: [
				{
					label: 'Help',
					click: async () => {
						BrowserWindow.getFocusedWindow().loadURL(
							'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/help'
						);
					},
				},
				{
					label: 'Github',
					click: async () => {
						await shell.openExternal('https://www.github.com/yarnpoint');
					},
				},
				{
					label: 'Twitter',
					click: async () => {
						await shell.openExternal('https://www.twitter.com/yarnpoint');
					},
				},
				{
					label: 'Patreon',
					click: async () => {
						await shell.openExternal('https://www.patreon.com/yarnpoint');
					},
				},
				{
					label: 'Email',
					click: async () => {
						await shell.openExternal('mailto:synthona@gmail.com');
					},
				},
				{
					label: 'Yarnpoint',
					click: async () => {
						await shell.openExternal('http://www.yarnpoint.net');
					},
				},
				{
					label: 'Check For Updates',
					click: async () => {
						checkForUpdates(true);
					},
				},
				{ type: 'separator' },
				{
					label: 'v' + APP_VERSION,
				},
			],
		},
	]);
	Menu.setApplicationMenu(menu);
};

const validUrl = (value) => {
	try {
		new URL(value);
	} catch (_) {
		return false;
	}
	return true;
};

const checkForUpdates = (reportNegative) => {
	const { net } = require('electron');
	const request = net.request(
		'https://raw.githubusercontent.com/yarnpoint/synthona-electron/master/package.json'
	);
	request.on('response', (response) => {
		response.on('data', (chunk) => {
			// parse the json data from the github package.json route
			let jsonData = JSON.parse(chunk);
			let githubVersion = jsonData.version;
			// check for a version match
			if (githubVersion === APP_VERSION) {
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
	});
	request.end();
};
