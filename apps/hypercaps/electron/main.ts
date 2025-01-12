import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import path from "path";
import { KeyboardService } from "./services/keyboard";
import { Store } from "./services/store";

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
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const createTray = async () => {
  // Create tray icon
  const icon = nativeImage
    .createFromPath(path.join(__dirname, "../src/assets/tray-icon.png"))
    .resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip("HyperCaps");

  // Get initial state from store
  const store = Store.getInstance();
  const isEnabled = await store.getIsEnabled();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show HyperCaps",
      click: () => {
        mainWindow?.show();
      },
    },
    {
      label: "Enable",
      type: "checkbox",
      checked: isEnabled,
      click: (menuItem) => {
        if (menuItem.checked) {
          keyboardService?.startListening();
        } else {
          keyboardService?.stopListening();
        }
        // Notify renderer about state change
        mainWindow?.webContents.send(
          "keyboard-service-state",
          menuItem.checked
        );
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double click shows the window
  tray.on("double-click", () => {
    mainWindow?.show();
  });
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Hide window instead of closing when user clicks X
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
  });

  // Initialize keyboard service
  try {
    keyboardService = new KeyboardService();
    keyboardService.setMainWindow(mainWindow);
    keyboardService.init(); // Initialize and load state

    // Setup IPC handlers
    ipcMain.on("start-listening", () => {
      keyboardService.startListening();
    });

    ipcMain.on("stop-listening", () => {
      keyboardService.stopListening();
    });

    // Mapping handlers
    ipcMain.handle("get-mappings", () => {
      return keyboardService.getMappings();
    });

    ipcMain.handle("add-mapping", (event, mapping) => {
      return keyboardService.addMapping(mapping);
    });

    ipcMain.handle("update-mapping", (event, id, updates) => {
      return keyboardService.updateMapping(id, updates);
    });

    ipcMain.handle("delete-mapping", (event, id) => {
      return keyboardService.deleteMapping(id);
    });
  } catch (error) {
    dialog.showErrorBox(
      "Keyboard Service Error",
      "Failed to initialize keyboard service. The application may not work as expected."
    );
  }

  // In development, load the Vite dev server URL
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html file
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  await Store.getInstance().load(); // Load state before creating window
  createWindow();
  createTray();
});

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (keyboardService) {
      keyboardService.dispose();
    }
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
