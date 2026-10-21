const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

function checkUrlAvailable(url, timeout = 1000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode < 400 || res.statusCode === 404);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeout, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function waitForServer(url, retries = 30) {
  for (let i = 0; i < retries; i++) {
    const available = await checkUrlAvailable(url);
    if (available) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'InstaAssist Local - Automação e Atendimento Instagram',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Abrir links externos no navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = 'http://localhost:5173';
  const prodUrl = 'http://localhost:3001';

  const isDevRunning = await checkUrlAvailable(devUrl);
  if (isDevRunning) {
    mainWindow.loadURL(devUrl);
  } else {
    // Aguarda servidor backend
    await waitForServer(prodUrl, 10);
    mainWindow.loadURL(prodUrl);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
