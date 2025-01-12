"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs/promises");
const _Store = class _Store {
  constructor() {
    __publicField(this, "state");
    __publicField(this, "filePath");
    this.filePath = path.join(electron.app.getPath("userData"), "state.json");
    this.state = {
      mappings: [],
      isEnabled: true
    };
  }
  static getInstance() {
    if (!_Store.instance) {
      _Store.instance = new _Store();
    }
    return _Store.instance;
  }
  async load() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.state = JSON.parse(data);
    } catch (error) {
      await this.save();
    }
  }
  async save() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error("Failed to save state:", error);
    }
  }
  // Mapping methods
  async getMappings() {
    return this.state.mappings;
  }
  async addMapping(mapping) {
    const newMapping = {
      ...mapping,
      id: Date.now().toString()
    };
    this.state.mappings.push(newMapping);
    await this.save();
    return newMapping;
  }
  async updateMapping(id, updates) {
    const index = this.state.mappings.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error("Mapping not found");
    }
    const updatedMapping = {
      ...this.state.mappings[index],
      ...updates
    };
    this.state.mappings[index] = updatedMapping;
    await this.save();
    return updatedMapping;
  }
  async deleteMapping(id) {
    this.state.mappings = this.state.mappings.filter((m) => m.id !== id);
    await this.save();
  }
  // Service state methods
  async getIsEnabled() {
    return this.state.isEnabled;
  }
  async setIsEnabled(enabled) {
    this.state.isEnabled = enabled;
    await this.save();
  }
};
__publicField(_Store, "instance");
let Store = _Store;
class KeyboardService {
  constructor() {
    __publicField(this, "mainWindow", null);
    __publicField(this, "keyboardProcess", null);
    __publicField(this, "store");
    __publicField(this, "handleKeyboardOutput", (data) => {
      var _a;
      try {
        const state = JSON.parse(data.toString());
        (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-event", {
          ctrlKey: Boolean(state.ctrl),
          altKey: Boolean(state.alt),
          shiftKey: Boolean(state.shift),
          metaKey: Boolean(state.win),
          capsLock: Boolean(state.caps),
          pressedKeys: Array.isArray(state.pressedKeys) ? state.pressedKeys : [],
          timestamp: Date.now()
        });
      } catch (error) {
        console.error("Error parsing keyboard state:", error);
      }
    });
    this.store = Store.getInstance();
  }
  async init() {
    await this.store.load();
    const isEnabled = await this.store.getIsEnabled();
    if (isEnabled) {
      this.startListening();
    }
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  startListening() {
    var _a, _b;
    if (this.keyboardProcess) {
      return;
    }
    const scriptPath = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "electron/scripts/keyboard-monitor.ps1") : path.resolve(__dirname, "../scripts/keyboard-monitor.ps1");
    console.log("Starting keyboard monitor with script:", scriptPath);
    try {
      this.keyboardProcess = child_process.spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath
      ]);
      (_a = this.keyboardProcess.stdout) == null ? void 0 : _a.on("data", this.handleKeyboardOutput);
      (_b = this.keyboardProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        console.error("Keyboard monitor error:", data.toString());
      });
      this.keyboardProcess.on("close", (code) => {
        console.log("Keyboard monitor process exited with code", code);
        this.keyboardProcess = null;
      });
      this.store.setIsEnabled(true);
    } catch (error) {
      electron.dialog.showErrorBox(
        "Keyboard Monitor Error",
        "Failed to start keyboard monitor. Please check if PowerShell is available."
      );
    }
  }
  stopListening() {
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    this.store.setIsEnabled(false);
  }
  async getMappings() {
    return this.store.getMappings();
  }
  async addMapping(mapping) {
    return this.store.addMapping(mapping);
  }
  async updateMapping(id, updates) {
    return this.store.updateMapping(id, updates);
  }
  async deleteMapping(id) {
    return this.store.deleteMapping(id);
  }
  dispose() {
    this.stopListening();
  }
}
if (process.platform !== "win32") {
  electron.dialog.showErrorBox(
    "Unsupported Platform",
    "HyperCaps is only supported on Windows. The application will now exit."
  );
  electron.app.quit();
}
if (require("electron-squirrel-startup")) {
  electron.app.quit();
}
let keyboardService;
let tray = null;
let mainWindow = null;
let isQuitting = false;
const createTray = async () => {
  const icon = electron.nativeImage.createFromPath(path.join(__dirname, "../src/assets/tray-icon.png")).resize({ width: 16, height: 16 });
  tray = new electron.Tray(icon);
  tray.setToolTip("HyperCaps - Keyboard Remapping Tool");
  const store = Store.getInstance();
  const isEnabled = await store.getIsEnabled();
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "HyperCaps",
      enabled: false,
      icon: electron.nativeImage.createFromPath(path.join(__dirname, "../src/assets/tray-icon.png")).resize({ width: 16, height: 16 })
    },
    { type: "separator" },
    {
      label: "Enable Keyboard Remapping",
      type: "checkbox",
      checked: isEnabled,
      accelerator: "CommandOrControl+Shift+E",
      click: (menuItem) => {
        if (menuItem.checked) {
          keyboardService == null ? void 0 : keyboardService.startListening();
        } else {
          keyboardService == null ? void 0 : keyboardService.stopListening();
        }
        mainWindow == null ? void 0 : mainWindow.webContents.send(
          "keyboard-service-state",
          menuItem.checked
        );
      }
    },
    { type: "separator" },
    {
      label: "Open Shortcut Manager",
      accelerator: "CommandOrControl+Shift+S",
      click: () => {
        mainWindow == null ? void 0 : mainWindow.show();
        mainWindow == null ? void 0 : mainWindow.focus();
      }
    },
    { type: "separator" },
    {
      label: "About HyperCaps",
      click: () => {
        electron.dialog.showMessageBox({
          type: "info",
          title: "About HyperCaps",
          message: "HyperCaps - Advanced Keyboard Remapping Tool",
          detail: "Version 0.0.1\nCreated for Windows power users."
        });
      }
    },
    { type: "separator" },
    {
      label: "Quit HyperCaps",
      accelerator: "CommandOrControl+Q",
      click: () => {
        isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  const ret = electron.globalShortcut.register("CommandOrControl+Shift+S", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  });
  if (!ret) {
    console.error("Failed to register global shortcut");
  }
  tray.on("double-click", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  });
};
const createWindow = () => {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow == null ? void 0 : mainWindow.hide();
      return false;
    }
  });
  try {
    keyboardService = new KeyboardService();
    keyboardService.setMainWindow(mainWindow);
    keyboardService.init();
    electron.ipcMain.on("start-listening", () => {
      keyboardService.startListening();
    });
    electron.ipcMain.on("stop-listening", () => {
      keyboardService.stopListening();
    });
    electron.ipcMain.handle("get-mappings", () => {
      return keyboardService.getMappings();
    });
    electron.ipcMain.handle("add-mapping", (event, mapping) => {
      return keyboardService.addMapping(mapping);
    });
    electron.ipcMain.handle("update-mapping", (event, id, updates) => {
      return keyboardService.updateMapping(id, updates);
    });
    electron.ipcMain.handle("delete-mapping", (event, id) => {
      return keyboardService.deleteMapping(id);
    });
  } catch (error) {
    electron.dialog.showErrorBox(
      "Keyboard Service Error",
      "Failed to initialize keyboard service. The application may not work as expected."
    );
  }
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};
electron.app.whenReady().then(async () => {
  await Store.getInstance().load();
  createWindow();
  createTray();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (keyboardService) {
      keyboardService.dispose();
    }
    electron.globalShortcut.unregisterAll();
    electron.app.quit();
  }
});
electron.app.on("will-quit", () => {
  electron.globalShortcut.unregisterAll();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
