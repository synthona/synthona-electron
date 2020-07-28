const { app, BrowserWindow, Menu, MenuItem } = require('electron');

// const server = require('./server/app');
let serverProcess = require('child_process').fork(require.resolve('./server/app.js'));
serverProcess.on('exit', (code, sig) => {
  // finishing`
  console.log('goodbye');
});

serverProcess.on('message', (message) => {
  if (message === 'server-started') {
    createWindow();
  }
});

serverProcess.on('error', (error) => {
  console.log(error);
});

function createWindow() {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      spellcheck: true,
    },
  });
  // win.webContents.session.clearStorageData();
  win.setBackgroundColor('#272727');
  win.loadURL('http://localhost:9000');

  // and load the index.html of the app.
  // win.loadFile('index.html');

  // win.webContents.on('did-finish-load', () => {
  //   win.show();
  // });
  // add the spellcheck context-menu
  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Add each spelling suggestion
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion),
        })
      );
    }
    // Allow users to add the misspelled word to the dictionary
    if (params.misspelledWord) {
      menu.append(
        new MenuItem({
          label: 'Add to dictionary',
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        })
      );
    }

    menu.popup();
  });
  // match the background color to the app theme

  // Open the DevTools.
  // win.webContents.openDevTools();
}
// disable hardware acceleration to prevent rendering bug
app.disableHardwareAcceleration();
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// app.on('ready', createWindow);

app.on('before-quit', () => {
  serverProcess.kill('SIGINT');
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
