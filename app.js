const path = require('path');
const fs = require('fs');
const {
	app,
	session,
	shell,
	globalShortcut,
	BrowserWindow,
	ipcMain,
	Menu,
	clipboard,
} = require('electron');
const contextMenu = require('electron-context-menu');
// import helper functions
const {
	checkForUpdates,
	loadConfig,
	registerQuickMenu,
	getConfigValues,
} = require('./electron/setup');
// load config
let packageJson = require('./package.json');
const APP_VERSION = packageJson.version;
const config = loadConfig();

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
if (require('electron-squirrel-startup')) return app.quit();

// config vars
let configDirPath = app.getPath('userData');
let legacyConfigDirPath = configDirPath.replace('synthona', 'yarnpoint');
if (fs.existsSync(legacyConfigDirPath)) {
	// if the user has an existing yarnpoint directory we'll use that
	configDirPath = legacyConfigDirPath;
}
let configPath = path.join(configDirPath, 'config.json');
let databasePath = path.join(configDirPath, 'database.sqlite3');
let dataFolderPath = path.join(configDirPath, 'data');
let configJson = getConfigValues();
// app state
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
		'CORE_DATA_DIRECTORY': configDirPath,
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
		console.log(message);
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
	// if (!config.DEBUG) {
	// 	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
	// 		callback({
	// 			responseHeaders: {
	// 				...details.responseHeaders,
	// 				'Content-Security-Policy': ["default-src 'self'; img-src *; object-src 'none';"],
	// 			},
	// 		});
	// 	});
	// }
});

// set up ipc event
ipcMain.on('toMain', (event, args) => {
	// TODO: this whole findInPage thing...the findNext feature doesn't work
	// i think there's actually an issue with the electron implementation
	// in the meantime, at least the basic functionality works now
	if (args.action && typeof args.action === 'string' && BrowserWindow.getFocusedWindow() !== null) {
		switch (args.action) {
			case 'search':
				if (args.query && typeof args.query === 'string') {
					BrowserWindow.getFocusedWindow().webContents.findInPage(args.query, { forward: true });
				}
				return;
			case 'hide-search':
				BrowserWindow.getFocusedWindow().webContents.stopFindInPage('clearSelection');
				return;
			case 'get-backend-config':
				BrowserWindow.getFocusedWindow().webContents.send('fromMain', {
					config: configJson,
					message: 'load-backend-config',
				});
				return;
			case 'update-backend-config':
				let newValues = args.updates;
				let newConfig = JSON.stringify(newValues);
				fs.writeFileSync(configPath, newConfig);
				return;
			case 'restart-app':
				console.log('restarting...');
				serverProcess.kill('SIGINT');
				app.relaunch();
				app.exit(0);
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

const validUrl = (value) => {
	try {
		new URL(value);
	} catch (_) {
		return false;
	}
	return true;
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
				{
					label: 'Favorites',
					accelerator: 'CommandOrControl+J',
					click: async () => {
						if (BrowserWindow.getFocusedWindow()) {
							BrowserWindow.getFocusedWindow().loadURL(
								'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/pins/'
							);
						}
					},
				},
				{
					label: 'Options',
					accelerator: 'CommandOrControl+O',
					click: async () => {
						BrowserWindow.getFocusedWindow().loadURL(
							'http://' + config.CLIENT_BASE + ':' + config.CLIENT_PORT + '/edit/profile/'
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
				{
					label: 'Show Config',
					click: async () => {
						shell.showItemInFolder(configPath);
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
						await shell.openExternal(
							'https://github.com/synthona/synthona-help/blob/main/README.md'
						);
					},
				},
				{
					label: 'Github',
					click: async () => {
						await shell.openExternal('https://www.github.com/synthona');
					},
				},
				{
					label: 'Patreon',
					click: async () => {
						await shell.openExternal('https://www.patreon.com/synthona');
					},
				},
				{
					label: 'Email',
					click: async () => {
						await shell.openExternal('mailto:synthona@gmail.com');
					},
				},
				{
					label: 'Synthona',
					click: async () => {
						await shell.openExternal('http://www.synthona.net');
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
