const { app, BrowserWindow } = require('electron');
const { exec } = require('child_process');
const path = require('path');

let mainWindow;

app.whenReady().then(() => {

  const rootDir = path.join(__dirname, '..');

  console.log("Starting backend...");
  exec('npm run dev', {
    cwd: path.join(rootDir, 'backend')
  });

  console.log("Starting frontend...");
  exec('npm run dev', {
    cwd: path.join(rootDir, 'frontend')
  });

  setTimeout(() => {
    console.log("Opening app...");

    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800
    });

    mainWindow.loadURL('http://localhost:5173');
  }, 5000);
});