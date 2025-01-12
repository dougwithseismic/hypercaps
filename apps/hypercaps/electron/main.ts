import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from "electron";
import path from "path";
import { KeyboardService } from "./services/keyboard";
import { Store } from "./services/store";
import { TrayFeature } from "./features/tray";

// Immediate environment logging
console.log("=== Environment Debug ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isDev:", process.env.NODE_ENV === "development");
console.log("======================");

// Check platform - exit if not Windows
if (process.platform !== "win32") {
  dialog.showErrorBox(
    "Unsupported Platform",
    "HyperCaps is only supported on Windows. The application will now exit."
  );
  app.quit();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let keyboardService: KeyboardService;
let trayFeature: TrayFeature | null = null;
let mainWindow: BrowserWindow | null = null;

const createWindow = async () => {
  console.log("Environment:", process.env.NODE_ENV);

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/preload.js"),
    },
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    // Round corners on Windows 11
    roundedCorners: true,
    backgroundMaterial: "acrylic",
    darkTheme: true,
    backgroundColor: "#00000000",
  });

  // Setup IPC handlers
  ipcMain.on("start-listening", () => {
    keyboardService?.startListening();
  });

  ipcMain.on("stop-listening", () => {
    keyboardService?.stopListening();
  });

  // Mapping handlers
  ipcMain.handle("get-mappings", () => {
    return keyboardService?.getMappings();
  });

  ipcMain.handle("add-mapping", (event, mapping) => {
    return keyboardService?.addMapping(mapping);
  });

  ipcMain.handle("update-mapping", (event, id, updates) => {
    return keyboardService?.updateMapping(id, updates);
  });

  ipcMain.handle("delete-mapping", (event, id) => {
    return keyboardService?.deleteMapping(id);
  });

  // Load appropriate content based on environment
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // In production, load the built index.html file
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Hide window instead of closing when user clicks X
  mainWindow.on("close", (event) => {
    if (!(mainWindow as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
  });
};

// Add window control handlers
ipcMain.on("minimize-window", () => {
  mainWindow?.minimize();
});

ipcMain.on("close-window", () => {
  mainWindow?.hide();
});

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  const store = Store.getInstance();
  await store.load(); // Load state before creating window

  // Initialize keyboard service first
  keyboardService = new KeyboardService();
  await keyboardService.init(); // This will auto-start if enabled in settings

  // Then create window
  await createWindow();
  if (mainWindow) {
    keyboardService.setMainWindow(mainWindow);
  }

  // Initialize tray feature after window is created
  if (mainWindow && keyboardService) {
    trayFeature = new TrayFeature(mainWindow, keyboardService);
    await trayFeature.initialize();
  }

  // Setup startup settings IPC handlers
  ipcMain.handle("get-startup-settings", async () => {
    return {
      startupOnBoot: await store.getStartupOnBoot(),
      enableOnStartup: await store.getEnableOnStartup(),
    };
  });

  ipcMain.handle("set-startup-on-boot", async (event, enabled: boolean) => {
    await store.setStartupOnBoot(enabled);
  });

  ipcMain.handle("set-enable-on-startup", async (event, enabled: boolean) => {
    await store.setEnableOnStartup(enabled);
  });
});

// Add proper cleanup
app.on("before-quit", () => {
  if (keyboardService) {
    keyboardService.dispose();
  }
  if (trayFeature) {
    trayFeature.dispose();
  }
  globalShortcut.unregisterAll();
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
