# Electron Research

## Overview
- **Electron app (`electron-app/`)**: Built with Electron Forge and Vite (TypeScript). The renderer loads an external web page in an iframe and relays commands to the main process.
- **Web app (`web-app/`)**: A static HTML page that sends JSON commands (e.g., open or close an application) to the Electron renderer using `postMessage`.
- **Supported actions**: Open a known executable by name or open/close a process by path/name on Windows.

This project targets Windows and uses `tasklist`/`taskkill` for process management.

## Getting started
1. Install dependencies:
   ```bash
   cd electron-app
   npm install
   ```
2. Start the Electron app (development):
   ```bash
   npm start
   ```

## Running the embedded web app
By default, `electron-app/src/renderer.ts` points the iframe to `http://127.0.0.1:5500/web-app/index.html`. You can serve the `web-app/` folder using any static file server (e.g., VS Code Live Server or similar):

```bash
# From the repo root
# Example using npm's http-server (install if needed):
npx http-server -p 5500 .
```

Alternatively, change the iframe `src` in `electron-app/src/renderer.ts` to your actual hosted URL.

## Building distributables
From `electron-app/`:
```bash
# Package the app (unpacked build)
npm run package

# Create platform installers (e.g., Squirrel/ZIP/DEB/RPM per config)
npm run make
```

## How it works (brief)
- The web page posts commands like `{ action: 'open_exe', name: 'steam.exe' }` to the Electron renderer.
- The renderer forwards commands to the main process via IPC.
- The main process validates input and uses `spawn` to launch executables, and `tasklist`/`taskkill` to close processes.
- Responses are sent back to the web page to update status.

## Security notes
- The preload script exposes a minimal, typed API; `contextIsolation` is enabled.
- In production, restrict `postMessage` origins and validate inputs before executing actions.
