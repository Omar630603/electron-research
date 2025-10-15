import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'node:child_process';
import started from 'electron-squirrel-startup';

type CommandRequest = {
  action: 'open' | 'close';
  app: string;
}

type CommandResponse = {
  status: 'success' | 'error';
  message: string;
}

let mainWindow: BrowserWindow;

if (started) {
  app.quit();
}

function startExpressServer() {
  const server = express();
  server.use(cors());
  server.use(express.json());

  server.post('/api/command', (req, res) => {
    const command: CommandRequest = req.body;
    mainWindow.webContents.send('serverMessage', `Received command: ${command.action} ${command.app}`);

    if (command.app !== 'steam') {
      const response: CommandResponse = { status: 'error', message: 'Unsupported application' };
      mainWindow.webContents.send('serverResponse', response);
      res.json(response);
      return;
    }

    if (command.action === 'open') {
      try {
        spawn('C:\\Program Files (x86)\\Steam\\steam.exe', [], { detached: true });
        const response: CommandResponse = { status: 'success', message: 'Steam launched successfully' };
        mainWindow.webContents.send('serverResponse', response);
        res.json(response);
      } catch (err) {
        const response: CommandResponse = { status: 'error', message: 'Failed to launch Steam' };
        mainWindow.webContents.send('serverResponse', response);
        res.json(response);
      }
    } else if (command.action === 'close') {
      exec('taskkill /F /IM steam.exe', (error) => {
        const response: CommandResponse = error
          ? { status: 'error', message: 'Failed to close Steam' }
          : { status: 'success', message: 'Steam closed successfully' };
        mainWindow.webContents.send('serverResponse', response);
        res.json(response);
      });
    }
  });

  server.listen(2000, () => {
    mainWindow.webContents.send('serverStatus', 'HTTP server listening on port 2000');
  });
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.on('ready', () => {
  createWindow();
  startExpressServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
