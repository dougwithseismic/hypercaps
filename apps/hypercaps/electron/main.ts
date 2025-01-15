import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron';
import path from 'path';
import { KeyboardService } from './features/hyperkeys/keyboard-service';
import { ShortcutService } from './features/shortcut-manager/shortcut-service';
import { Store } from '@electron/services/store';
import { TrayFeature } from './features/tray';
import { AppState } from '@electron/services/store/types/app-state';
import electronSquirrelStartup from 'electron-squirrel-startup';

// Immediate environment logging
console.log('=== Environment Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('isDev:', process.env.NODE_ENV === 'development');
console.log('======================');

// Check platform - exit if not Windows
if (process.platform !== 'win32') {
  dialog.showErrorBox(
    'Unsupported Platform',
    'HyperCaps is only supported on Windows. The application will now exit.'
  );
  app.quit();
}
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

let keyboardService: KeyboardService;
let shortcutService: ShortcutService;
let trayFeature: TrayFeature | null = null;
let mainWindow: BrowserWindow | null = null;

const initializeServices = async (window: BrowserWindow) => {
  console.log('[Main] Initializing services');
  const store = Store.getInstance();
  await store.load();

  // Initialize keyboard service if not already initialized
  if (!keyboardService) {
    console.log('[Main] Creating new keyboard service');
    keyboardService = new KeyboardService();
    await keyboardService.init();
  }

  // Initialize shortcut service if not already initialized
  if (!shortcutService) {
    console.log('[Main] Creating new shortcut service');
    shortcutService = new ShortcutService();
    await shortcutService.initialize();
  }

  // Set the window and re-register handlers
  keyboardService.setMainWindow(window);

  // Initialize tray feature if needed
  if (!trayFeature) {
    console.log('[Main] Creating new tray feature');
    trayFeature = new TrayFeature(window, keyboardService);
    await trayFeature.initialize();
  }
};

const createWindow = async () => {
  console.log('Environment:', process.env.NODE_ENV);

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      // Add GPU-related options
      disableHtmlFullscreenWindowResize: true,
      enableWebSQL: false,
    },
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    roundedCorners: true,
    backgroundMaterial: 'acrylic',
    darkTheme: true,
    backgroundColor: '#00000000',
  });

  // Handle renderer process crashes gracefully
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.log('Renderer process crashed:', details.reason);
    mainWindow?.reload();
  });

  // Handle GPU process crashes gracefully
  app.on('child-process-gone', (event, details) => {
    if (details.type === 'GPU') {
      console.log('GPU process crashed:', details.reason);
      mainWindow?.reload();
    }
  });

  // Setup IPC handlers
  ipcMain.on('start-listening', () => {
    keyboardService?.startListening();
  });

  ipcMain.on('stop-listening', () => {
    keyboardService?.stopListening();
  });

  // Add handler for getting keyboard service state
  ipcMain.handle('get-keyboard-service-state', () => {
    return keyboardService?.isRunning() || false;
  });

  // HyperKey config handlers
  ipcMain.handle('get-hyperkey-config', async () => {
    const store = Store.getInstance();
    const hyperKey = await store.getFeature('hyperKey');
    return hyperKey?.config;
  });

  ipcMain.handle('set-hyperkey-config', async (event, config) => {
    const store = Store.getInstance();
    await store.update((draft) => {
      const hyperkeyFeature = draft.features.find((f) => f.name === 'hyperKey');
      if (hyperkeyFeature) {
        hyperkeyFeature.config = config;
      }
    });

    // Emit config change event
    mainWindow?.webContents.send('ipc:event', {
      service: 'hyperKey',
      event: 'configChanged',
      data: config,
    });

    await keyboardService?.restartWithConfig(config);
  });

  // Load appropriate content based on environment
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // In production, load the built index.html file
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    mainWindow.loadFile(indexPath);

    // Handle page refresh in production
    mainWindow.webContents.on(
      'did-fail-load',
      (event, errorCode, errorDescription) => {
        console.log('Failed to load:', errorCode, errorDescription);
        mainWindow?.loadFile(indexPath);
      }
    );
  }

  // Handle window reload
  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('[Main] Window finished loading, initializing services');
    if (mainWindow) {
      await initializeServices(mainWindow);
    }
  });

  // Hide window instead of closing when user clicks X, unless we're quitting
  mainWindow.on('close', (event) => {
    if (!(mainWindow as unknown as { isQuitting: boolean }).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
};

// Add window control handlers
ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('close-window', () => {
  mainWindow?.hide();
});

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Create window first
  await createWindow();
  if (mainWindow) {
    // Initialize services after window is created
    await initializeServices(mainWindow);
  }

  // Startup settings
  ipcMain.handle('get-startup-settings', async () => {
    const store = Store.getInstance();
    const state = store.getState();
    return {
      startupOnBoot: state.settings?.startupOnBoot || false,
      startMinimized: state.settings?.startMinimized || false,
    };
  });

  ipcMain.handle('set-startup-on-boot', async (_, enabled: boolean) => {
    const store = Store.getInstance();
    await store.update((draft) => {
      if (!draft.settings) draft.settings = {};
      draft.settings.startupOnBoot = enabled;
    });
  });

  ipcMain.handle('set-start-minimized', async (_, enabled: boolean) => {
    const store = Store.getInstance();
    await store.update((draft) => {
      if (!draft.settings) draft.settings = {};
      draft.settings.startMinimized = enabled;
    });
  });

  // Store state
  ipcMain.handle('get-full-state', async () => {
    const store = Store.getInstance();
    return store.getState();
  });

  // Window controls
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });
});

// Add proper cleanup
app.on('before-quit', () => {
  if (keyboardService) {
    keyboardService.dispose();
  }
  if (trayFeature) {
    trayFeature.dispose();
  }
  globalShortcut.unregisterAll();
});

// Quit when all windows are closed, except on macOS
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

// Listen for store changes and emit events
Store.getInstance().on('stateChanged', (state: AppState) => {
  mainWindow?.webContents.send('ipc:event', {
    service: 'store',
    event: 'stateChanged',
    data: state,
  });
});
