import { contextBridge, ipcRenderer } from 'electron';

type CommandResponse = {
  status: 'success' | 'error';
  message: string;
}

contextBridge.exposeInMainWorld('electron', {
  onServerStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('serverStatus', (_event, status) => callback(status));
  },
  onServerMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('serverMessage', (_event, message) => callback(message));
  },
  onServerResponse: (callback: (response: CommandResponse) => void) => {
    ipcRenderer.on('serverResponse', (_event, response) => callback(response));
  }
});
