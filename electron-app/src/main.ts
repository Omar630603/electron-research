import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { spawn, exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import started from 'electron-squirrel-startup';

type CommandRequest = {
  action: 'open_exe' | 'close_app';
  path?: string;
  name?: string;
}

type CommandResponse = {
  status: 'success' | 'error';
  message: string;
}

// Known application paths
const knownApps: { [key: string]: string } = {
  'steam.exe': 'C:\\Program Files (x86)\\Steam\\steam.exe',
  'notepad.exe': 'C:\\Windows\\System32\\notepad.exe',
  // Add more applications here as needed
};

let mainWindow: BrowserWindow | null = null;

if (started) {
  app.quit();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      mainWindow.webContents.send('appStatus', 'Application ready');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

function sendResponse(response: CommandResponse) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('commandResponse', response);
  }
}

function logCommand(message: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('commandReceived', message);
  }
}

ipcMain.on('executeCommand', (event, command: CommandRequest) => {
  if (!mainWindow) {
    console.error('Main window is not available');
    return;
  }

  logCommand(`Received command: ${command.action} ${command.path || command.name || ''}`);

  if (command.action === 'open_exe') {
    handleOpenExe(command);
  } else if (command.action === 'close_app') {
    handleCloseApp(command);
  } else {
    sendResponse({ 
      status: 'error', 
      message: `Unknown action: ${command.action}` 
    });
  }
});

function handleOpenExe(command: CommandRequest) {
  let exePath = command.path;
  
  // If name is provided, look up the path from known apps
  if (command.name && knownApps[command.name]) {
    exePath = knownApps[command.name];
  }
  
  if (!exePath) {
    sendResponse({ 
      status: 'error', 
      message: 'No path provided or application not found in known apps' 
    });
    return;
  }
  console.log(exePath);
  
  // Check if file exists
  if (!existsSync(exePath)) {
    sendResponse({ 
      status: 'error', 
      message: `Application not found at path: ${exePath}` 
    });
    return;
  }

  try {
    const child = spawn(exePath, [], { 
      detached: true,
      stdio: 'ignore',
      shell: false
    });

    child.unref();

    child.on('error', (err) => {
      sendResponse({ 
        status: 'error', 
        message: `Failed to launch: ${exePath} - ${err.message}` 
      });
    });

    // Give it a moment to check if spawn was successful
    setTimeout(() => {
      if (child.exitCode === null || child.exitCode === 0) {
        sendResponse({ 
          status: 'success', 
          message: `Application launched: ${path.basename(exePath)}` 
        });
      }
    }, 100);

  } catch (err) {
    sendResponse({ 
      status: 'error', 
      message: `Failed to launch: ${exePath} - ${err instanceof Error ? err.message : String(err)}` 
    });
  }
}

function handleCloseApp(command: CommandRequest) {
  let processName = command.name;
  
  // If path is provided, extract the process name from it
  if (command.path && !processName) {
    processName = path.basename(command.path);
  }
  
  if (!processName) {
    sendResponse({ 
      status: 'error', 
      message: 'No process name or path provided' 
    });
    return;
  }

  // Ensure processName ends with .exe
  if (!processName.toLowerCase().endsWith('.exe')) {
    processName += '.exe';
  }

  // First check if process is running
  exec(`tasklist /FI "IMAGENAME eq ${processName}" /NH`, (error, stdout, stderr) => {
    if (error || !stdout.includes(processName)) {
      sendResponse({ 
        status: 'error', 
        message: `Process not running: ${processName}` 
      });
      return;
    }

    // Process is running, now kill it
    exec(`taskkill /F /IM "${processName}"`, (killError, killStdout, killStderr) => {
      if (killError) {
        sendResponse({ 
          status: 'error', 
          message: `Failed to close: ${processName} - ${killError.message}` 
        });
      } else {
        sendResponse({ 
          status: 'success', 
          message: `Application closed: ${processName}` 
        });
      }
    });
  });
}

app.on('ready', () => {
  createWindow();
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
