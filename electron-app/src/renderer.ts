/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

declare global {
  interface Window {
    electron: {
      onServerStatus: (callback: (status: string) => void) => void;
      onServerMessage: (callback: (message: string) => void) => void;
      onServerResponse: (callback: (response: { status: string; message: string }) => void) => void;
    };
  }
}

const statusElement = document.createElement('div');
statusElement.id = 'status';
document.body.appendChild(statusElement);

const logElement = document.createElement('div');
logElement.id = 'log';
document.body.appendChild(logElement);

function addLogEntry(message: string) {
  const entry = document.createElement('div');
  entry.textContent = `${new Date().toISOString()} - ${message}`;
  logElement.insertBefore(entry, logElement.firstChild);
}

window.electron.onServerStatus((status) => {
  statusElement.textContent = `Status: ${status}`;
  addLogEntry(status);
});

window.electron.onServerMessage((message) => {
  addLogEntry(message);
});

window.electron.onServerResponse((response) => {
  addLogEntry(`Response: ${response.status} - ${response.message}`);
});
