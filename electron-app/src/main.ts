import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { spawn, exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import started from 'electron-squirrel-startup';

type CommandRequest = {
  action: 'open_exe' | 'close_exe' | 'exe_close' | 'exe_maximize' | 'exe_minimize';
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
  'chrome.exe': 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  // Add more applications here as needed
};

let mainWindow: BrowserWindow | null = null;
let lastOpenedProcessName: string | null = null;

function checkProcessRunning(processName: string, cb: (running: boolean) => void) {
  const name = processName.toLowerCase().endsWith('.exe') ? processName : `${processName}.exe`;
  exec(`tasklist /FI "IMAGENAME eq ${name}" /NH`, (error, stdout) => {
    const running = !error && typeof stdout === 'string' && stdout.toLowerCase().includes(name.toLowerCase());
    cb(running);
  });
}

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
  } else if (command.action === 'close_exe') {
    handleCloseExe(command);
  } else if (command.action === 'exe_close') {
    handleWindowAction('close', command.name ?? lastOpenedProcessName ?? undefined);
  } else if (command.action === 'exe_maximize') {
    handleWindowAction('maximize', command.name ?? lastOpenedProcessName ?? undefined);
  } else if (command.action === 'exe_minimize') {
    handleWindowAction('minimize', command.name ?? lastOpenedProcessName ?? undefined);
  } else {
    sendResponse({ 
      status: 'error', 
      message: `Unknown action: ${command.action}` 
    });
  }
});

function handleOpenExe(command: CommandRequest) {
  let exePath = command.path;
  
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

  const processNameToCheck = path.basename(exePath);
  
  checkProcessRunning(processNameToCheck, (running) => {
    if (running) {
      lastOpenedProcessName = processNameToCheck.toLowerCase();
      sendResponse({ status: 'success', message: `Application already running: ${processNameToCheck}` });
      return;
    }

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

      lastOpenedProcessName = path.basename(exePath).toLowerCase();

      child.on('error', (err) => {
        sendResponse({ 
          status: 'error', 
          message: `Failed to launch: ${exePath} - ${err.message}` 
        });
      });

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
  });
}

function handleCloseExe(command: CommandRequest) {
  let processName = command.name;
  
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

  if (!processName.toLowerCase().endsWith('.exe')) {
    processName += '.exe';
  }

  exec(`taskkill /F /IM "${processName}"`, (killError, killStdout, killStderr) => {
    if (killError) {
      if (killStderr.includes('not found') || killStdout.includes('not found')) {
        sendResponse({ 
          status: 'success', 
          message: `Application already closed: ${processName}` 
        });
      } else {
        sendResponse({ 
          status: 'error', 
          message: `Failed to close: ${processName} - ${killError.message}` 
        });
      }
    } else {
      sendResponse({ status: 'success', message: `Application closed: ${processName}` });
      if (lastOpenedProcessName && lastOpenedProcessName.toLowerCase() === processName.toLowerCase()) {
        lastOpenedProcessName = null;
      }
    }
  });
}

function runPowerShell(script: string, cb: (error: Error | null, stdout: string, stderr: string) => void) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (error, stdout, stderr) => cb(error, stdout, stderr));
}

function buildWindowActionScript(targetProcessWithExt: string, action: 'maximize' | 'minimize' | 'close'): string {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
}
"@;

$target = "${targetProcessWithExt}".ToLower().Replace('.exe','');
$allProcs = Get-Process | Where-Object { $_.ProcessName.ToLower() -eq $target };
if ($allProcs.Count -eq 0) { Write-Output 'ERR:Process not found'; exit 1 }

$SW_RESTORE = 9
$SW_MAXIMIZE = 3
$SW_MINIMIZE = 6
$WM_CLOSE = 0x0010

function Get-AllVisibleWindows([array]$processes) {
  $list = New-Object System.Collections.ArrayList
  $pids = $processes | ForEach-Object { $_.Id }
  [Win]::EnumWindows({ param($h,$p)
    [uint32]$out = 0
    [Win]::GetWindowThreadProcessId($h, [ref]$out) | Out-Null
    if ($pids -contains $out) {
      if ([Win]::IsWindowVisible($h)) {
        $len = [Win]::GetWindowTextLength($h)
        if ($len -gt 0) {
          $list.Add($h) | Out-Null
        }
      }
    }
    return $true
  }, [IntPtr]::Zero) | Out-Null
  return $list
}

$attempts = 0
$maxAttempts = 25
while ($attempts -lt $maxAttempts) {
  $attempts++
  
  $allWindows = Get-AllVisibleWindows -processes $allProcs
  
  if ($allWindows.Count -gt 0) {
    foreach ($h in $allWindows) {
      if ('${action}' -eq 'maximize') {
        [Win]::ShowWindowAsync($h, $SW_RESTORE) | Out-Null
        Start-Sleep -Milliseconds 50
        [Win]::ShowWindowAsync($h, $SW_MAXIMIZE) | Out-Null
      } elseif ('${action}' -eq 'minimize') {
        [Win]::ShowWindowAsync($h, $SW_MINIMIZE) | Out-Null
      } else {
        [Win]::PostMessage($h, $WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
      }
    }
    Write-Output 'OK'
    exit 0
  }

  Start-Sleep -Milliseconds 200
  try { 
    $allProcs = Get-Process | Where-Object { $_.ProcessName.ToLower() -eq $target }
    if ($allProcs.Count -eq 0) { break }
  } catch { break }
}

Write-Output 'ERR:No windows'
`;
}

function handleWindowAction(action: 'maximize' | 'minimize' | 'close', nameOrProcess?: string) {
  if (!nameOrProcess) {
    sendResponse({ status: 'error', message: 'No process specified and none remembered' });
    return;
  }

  let processName = nameOrProcess.toLowerCase().endsWith('.exe') ? nameOrProcess : `${nameOrProcess}.exe`;
  const psScript = buildWindowActionScript(processName, action);
  runPowerShell(psScript, (error, stdout) => {
    const ok = (stdout || '').toString().includes('OK');
    if (error || !ok) {
      sendResponse({ status: 'error', message: `Failed to ${action}: ${processName}` });
    } else {
      const verb = action === 'close' ? 'closed' : `${action}d`;
      sendResponse({ status: 'success', message: `Window ${verb}: ${processName}` });
    }
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
