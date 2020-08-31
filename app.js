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
  // window.webContents.session.clearStorageData();
  // match the background color to the app theme
  window.setBackgroundColor('#272727');
  window.loadURL('http://localhost:9000');

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
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; img-src *; object-src 'none';"],
      },
    });
  });
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
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
