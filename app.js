const path = require('path');
const fs = require('fs');
const crytpo = require('crypto');
const { app, session, shell, globalShortcut, BrowserWindow, Menu, clipboard } = require('electron');
const contextMenu = require('electron-context-menu');

// load configuration data
let config;
let configDirPath = app.getPath('userData');
let configPath = path.join(configDirPath, 'config.json');
let databasePath = path.join(configDirPath, 'database.sqlite3');
// let dataFolderPath = path.join(configDirPath, 'data');
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
    'VERSION': 1,
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
if (require('electron-squirrel-startup')) return app.quit();

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
    'VERSION': config.VERSION,
    'CORE_DATA_DIRECTORY': app.getPath('userData'),
    'GRAPH_RENDER_LIMIT': config.GRAPH_RENDER_LIMIT,
  },
});

serverProcess.on('message', (message) => {
  if (message === 'server-started') {
    serverReady = true;
    if (serverReady && electronReady && mainWindowCreated) {
      windowList[0].reload();
    }
  } else {
    console.log(message);
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
    },
    show: false,
  });
  // add it to the window list
  windowList.push(newWindow);
  // add the context menu
  contextMenu({
    prepend: (defaultActions, params, browserWindow) => [
      {
        label: 'emoji',
        visible: params.mediaType !== 'image',
        click: () => {
          app.showEmojiPanel();
        },
      },
      {
        label: 'open in new window',
        visible: validUrl(params.linkURL),
        click: () => {
          createNewWindowAtURL(params.linkURL);
        },
      },
    ],
    labels: {
      // copyImage: 'copy image',
      paste: 'paste',
      copy: 'copy',
      cut: 'cut',
      inspect: 'inspect',
      copyImageAddress: 'copy image address',
    },
    showSearchWithGoogle: false,
    showInspectElement: false,
    showCopyImageAddress: true,
    showCopyImage: false,
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
  // register the quickmen system
  registerQuickMenu();
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
    key1 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 2 key
  let key2 = null;
  globalShortcut.register('CommandOrControl+2', () => {
    if (key2 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key2);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+2', () => {
    key2 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 3 key
  let key3 = null;
  globalShortcut.register('CommandOrControl+3', () => {
    if (key3 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key3);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+3', () => {
    key3 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 4 key
  let key4 = null;
  globalShortcut.register('CommandOrControl+4', () => {
    if (key4 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key4);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+4', () => {
    key4 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 5 key
  let key5 = null;
  globalShortcut.register('CommandOrControl+5', () => {
    if (key5 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key5);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+5', () => {
    key5 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 6 key
  let key6 = null;
  globalShortcut.register('CommandOrControl+6', () => {
    if (key6 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key6);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+6', () => {
    key6 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 7 key
  let key7 = null;
  globalShortcut.register('CommandOrControl+7', () => {
    if (key7 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key7);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+7', () => {
    key7 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 8 key
  let key8 = null;
  globalShortcut.register('CommandOrControl+8', () => {
    if (key8 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key8);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+8', () => {
    key8 = BrowserWindow.getFocusedWindow().webContents.getURL();
  });
  // 9 key
  let key9 = null;
  globalShortcut.register('CommandOrControl+9', () => {
    if (key9 !== null && BrowserWindow.getFocusedWindow()) {
      BrowserWindow.getFocusedWindow().loadURL(key9);
    }
  });
  globalShortcut.register('CommandOrControl+ALT+9', () => {
    key9 = BrowserWindow.getFocusedWindow().webContents.getURL();
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
            await shell.openExternal('https://www.github.com/synthona');
          },
        },
        {
          label: 'Twitter',
          click: async () => {
            await shell.openExternal('https://www.twitter.com/synthona');
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
          label: 'Check For Updates',
          click: async () => {
            await shell.openExternal('https://synthona.itch.io/synthona');
          },
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
