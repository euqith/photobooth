import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import { startServer } from '../server/index';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV !== 'production';

async function createWindow() {
  // Start embedded Express + Socket.io server on port 4000
  await startServer(4000);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: !isDev,
    kiosk: !isDev, // Locked Kiosk in production
    autoHideMenuBar: true,
    backgroundColor: '#0F1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Touchscreen optimizations: disable pinch-to-zoom in kiosk mode
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

  if (isDev) {
    // In dev mode, load Vite dev server
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, load built static file via backend
    mainWindow.loadURL('http://localhost:4000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom media:// protocol to safely stream local captured files without CSP errors
app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    const filePath = request.url.replace('media://', '');
    return net.fetch(`file://${path.resolve(filePath)}`);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
