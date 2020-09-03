const path = require('path');
const { app, shell, session, globalShortcut, BrowserWindow } = require('electron');
const contextMenu = require('electron-context-menu');
// import config
const config = require('./config');

let serverReady = false;
let electronReady = false;
let mainWindowCreated = false;
let window;

console.log('creating child process');
const { fork } = require('child_process');
const serverProcess = fork(path.join(__dirname, './server/app.js'), ['args'], {
  env: {
    'ELECTRON_RUN_AS_NODE': '1',
    'PORT': config.PORT,
    'APP_NAME': config.APP_NAME,
    'CLIENT_URL': config.CLIENT_URL,
    'JWT_SECRET': config.JWT_SECRET,
    'REFRESH_TOKEN_SECRET': config.REFRESH_TOKEN_SECRET,
    'PRODUCTION': 'false',
    'VERSION': '1',
  },
});

serverProcess.on('message', (message) => {
  if (message === 'server-started') {
    console.log('server started');
    serverReady = true;
    if (serverReady && electronReady && !mainWindowCreated) {
      mainWindowCreated = true;
      window.reload();
    }
  } else {
    console.log(message);
  }
});

serverProcess.on('exit', (code, sig) => {
  // finishing`
  console.log('goodbye');
});

serverProcess.on('error', (error) => {
  console.log(error);
});

const mainWindow = () => {
  console.log('creating window');
  // Create the browser window.
  window = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      spellcheck: true,
      enableRemoteModule: false,
    },
    show: false,
  });

  // add the context menu
  contextMenu({
    prepend: (defaultActions, params, browserWindow) => [
      {
        label: 'emoji',
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
    },
    showSearchWithGoogle: false,
    showInspectElement: false,
  });
  // clear storage data
  window.webContents.session.clearStorageData();
  // match the background color to the app theme
  window.setBackgroundColor('#272727');
  window.loadURL('http://localhost:' + config.PORT);

  window.webContents.on('new-window', function (e, url) {
    e.preventDefault();
    require('electron').shell.openExternal(url);
  });

  electronReady = true;
  if (serverReady && electronReady && !mainWindowCreated) {
    mainWindowCreated = true;
    window.show();
  }

  // Open the DevTools.
  // window.webContents.openDevTools();
};
// disable hardware acceleration to prevent rendering bug
app.disableHardwareAcceleration();
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
  console.log('app is ready');
  globalShortcut.register('CommandOrControl+E', () => {
    app.showEmojiPanel();
  });
  globalShortcut.register('CommandOrControl+H', () => {
    window.loadURL('http://localhost:' + config.PORT);
  });
  globalShortcut.register('CommandOrControl+1', () => {
    window.loadURL('http://localhost:' + config.PORT);
  });
  // userKeyMaps();
  // session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  //   callback({
  //     responseHeaders: {
  //       ...details.responseHeaders,
  //       'Content-Security-Policy': ["default-src 'self'; img-src *; object-src 'none';"],
  //     },
  //   });
  // });
});

app.on('before-quit', () => {
  console.log('before quit');
  serverProcess.kill('SIGINT');
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0 && serverReady && electronReady) {
    mainWindow();
    window.show();
  }
});

// let key1Url;
// let key2Url;
// let key3Url;
// let key4Url;
// let key5Url;
// let key6Url;
// let key7Url;
// let key8Url;
// let key9Url;
// let key0Url;

// const userKeyMaps = () => {
//   console.log('userkeymaps');
//   // key 2 mappings
//   globalShortcut.register('CommandOrControl+Option+2', () => {
//     let newUrl = window.webContents.getURL();
//     if (key2Url !== newUrl) {
//       key2Url = newUrl;
//     }
//   });
//   globalShortcut.register('CommandOrControl+2', () => {
//     if (key2Url) {
//       window.loadURL(key2Url);
//     }
//   });
//   // // key 3 mappings
//   globalShortcut.register('CommandOrControl+Option+3', () => {
//     let newUrl = window.webContents.getURL();
//     if (key3Url !== newUrl) {
//       key3Url = newUrl;
//     }
//   });
//   globalShortcut.register('CommandOrControl+3', () => {
//     if (key3Url) {
//       window.loadURL(key3Url);
//     }
//   });
//   // // key 4 mappings
//   globalShortcut.register('CommandOrControl+Option+4', () => {
//     let newUrl = window.webContents.getURL();
//     if (key4Url !== newUrl) {
//       key4Url = newUrl;
//     }
//   });
//   globalShortcut.register('CommandOrControl+4', () => {
//     if (key4Url) {
//       window.loadURL(key4Url);
//     }
//   });
//   // // key 5 mappings
//   // globalShortcut.register('CommandOrControl+Shift+5', () => {
//   //   key5Url = window.webContents.getURL();
//   //   console.log(key5Url);
//   // });
//   // globalShortcut.register('CommandOrControl+5', () => {
//   //   if (key5Url) {
//   //     window.loadURL(key5Url);
//   //   }
//   // });
// };
