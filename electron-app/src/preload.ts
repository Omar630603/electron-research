import { contextBridge, ipcRenderer } from 'electron';

type CommandRequest = {
  action: 'open_exe' | 'close_exe' | 'exe_close' | 'exe_maximize' | 'exe_minimize';
  path?: string;
  name?: string;
}

type CommandResponse = {
  status: 'success' | 'error';
  message: string;
}

contextBridge.exposeInMainWorld('electron', {
  executeCommand: (command: CommandRequest) => {
    ipcRenderer.send('executeCommand', command);
  },
  onAppStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('appStatus', (_event, status) => callback(status));
  },
  onCommandReceived: (callback: (message: string) => void) => {
    ipcRenderer.on('commandReceived', (_event, message) => callback(message));
  },
  onCommandResponse: (callback: (response: CommandResponse) => void) => {
    ipcRenderer.on('commandResponse', (_event, response) => callback(response));
  }
});