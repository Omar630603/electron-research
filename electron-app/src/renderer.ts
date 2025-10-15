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
      executeCommand: (command: { action: 'open_exe' | 'close_app'; path?: string; name?: string }) => void;
      onAppStatus: (callback: (status: string) => void) => void;
      onCommandReceived: (callback: (message: string) => void) => void;
      onCommandResponse: (callback: (response: { status: string; message: string }) => void) => void;
    };
  }
}

const statusElement = document.createElement('div');
statusElement.id = 'status';
statusElement.style.padding = '10px';
statusElement.style.background = '#f0f0f0';
statusElement.style.marginBottom = '10px';
document.body.appendChild(statusElement);

const logElement = document.createElement('div');
logElement.id = 'log';
logElement.style.height = '200px';
logElement.style.overflow = 'auto';
logElement.style.border = '1px solid #ddd';
logElement.style.padding = '10px';
logElement.style.marginBottom = '10px';
document.body.appendChild(logElement);

// Create iframe to load external web app
const iframe = document.createElement('iframe');
iframe.id = 'webApp';
iframe.style.width = '100%';
iframe.style.height = '500px';
iframe.style.border = '1px solid #ccc';

// IMPORTANT: Change this URL to your actual hosted web app URL
// For local development, use: http://localhost:YOUR_PORT/index.html
// For production, use your actual hosted URL
iframe.src = 'http://127.0.0.1:5500/web-app/index.html'; // Change this to your actual URL

document.body.appendChild(iframe);

function addLogEntry(message: string) {
  const entry = document.createElement('div');
  entry.textContent = `${new Date().toISOString()} - ${message}`;
  logElement.insertBefore(entry, logElement.firstChild);
}

window.electron.onAppStatus((status) => {
  statusElement.textContent = `Status: ${status}`;
  addLogEntry(status);
});

window.electron.onCommandReceived((message) => {
  addLogEntry(message);
});

window.electron.onCommandResponse((response) => {
  addLogEntry(`${response.status} - ${response.message}`);
  
  // Send response back to iframe
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'commandResponse',
      response: response
    }, '*'); // In production, replace '*' with specific origin
  }
});

// Listen for messages from the iframe
window.addEventListener('message', (event) => {
  // SECURITY: In production, check the event.origin
  // if (event.origin !== 'http://your-expected-origin.com') return;
  
  if (event.data && event.data.type === 'command') {
    addLogEntry(`Received command from web app: ${JSON.stringify(event.data.command)}`);
    window.electron.executeCommand(event.data.command);
  }
});

// Notify iframe when Electron app is ready
iframe.addEventListener('load', () => {
  addLogEntry('External web app loaded successfully');
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage({
      type: 'electronReady',
      message: 'Electron app is ready'
    }, '*');
  }
});
