import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import { KeyboardService } from "./services/keyboard";

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

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Initialize keyboard service
  try {
    keyboardService = new KeyboardService();
    keyboardService.setMainWindow(mainWindow);

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

    const handleKeyboardOutput = (data: string) => {
      try {
        const state = JSON.parse(data);
        mainWindow?.webContents.send("keyboard-event", {
          ctrlKey: state.ctrl,
          altKey: state.alt,
          shiftKey: state.shift,
          metaKey: state.win,
          capsLock: state.caps,
          pressedKeys: state.pressedKeys || [],
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("Error parsing keyboard state:", error);
      }
    };
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

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
