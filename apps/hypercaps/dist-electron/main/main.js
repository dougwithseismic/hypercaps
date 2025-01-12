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
      isEnabled: true,
      startupOnBoot: false,
      enableOnStartup: true
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
  // Startup settings methods
  async getStartupOnBoot() {
    return this.state.startupOnBoot;
  }
  async setStartupOnBoot(enabled) {
    this.state.startupOnBoot = enabled;
    if (enabled) {
      electron.app.setLoginItemSettings({
        openAtLogin: true,
        path: electron.app.getPath("exe")
      });
    } else {
      electron.app.setLoginItemSettings({
        openAtLogin: false
      });
    }
    await this.save();
  }
  async getEnableOnStartup() {
    return this.state.enableOnStartup;
  }
  async setEnableOnStartup(enabled) {
    this.state.enableOnStartup = enabled;
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
    __publicField(this, "startupTimeout", null);
    __publicField(this, "isStarting", false);
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
    var _a;
    await this.store.load();
    const isEnabled = await this.store.getIsEnabled();
    (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-service-state", isEnabled);
    if (isEnabled) {
      await this.startListening();
    }
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  async startListening() {
    var _a, _b, _c, _d;
    if (this.keyboardProcess || this.isStarting) {
      return;
    }
    this.isStarting = true;
    (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-service-loading", true);
    const scriptPath = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "electron/scripts/keyboard-monitor.ps1") : path.resolve(__dirname, "../scripts/keyboard-monitor.ps1");
    console.log("Starting keyboard monitor with script:", scriptPath);
    try {
      this.keyboardProcess = child_process.spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath
      ]);
      this.startupTimeout = setTimeout(() => {
        if (this.isStarting) {
          this.handleStartupFailure(
            "Keyboard monitor failed to start within timeout"
          );
        }
      }, 5e3);
      const startupPromise = new Promise((resolve, reject) => {
        var _a2, _b2, _c2, _d2, _e;
        const onFirstData = (data) => {
          this.clearStartupState();
          this.handleKeyboardOutput(data);
          resolve();
        };
        const onStartupError = (error) => {
          this.clearStartupState();
          reject(new Error(error.toString()));
        };
        (_b2 = (_a2 = this.keyboardProcess) == null ? void 0 : _a2.stdout) == null ? void 0 : _b2.once("data", onFirstData);
        (_d2 = (_c2 = this.keyboardProcess) == null ? void 0 : _c2.stderr) == null ? void 0 : _d2.once("data", onStartupError);
        (_e = this.keyboardProcess) == null ? void 0 : _e.once("close", (code) => {
          var _a3, _b3, _c3, _d3;
          (_b3 = (_a3 = this.keyboardProcess) == null ? void 0 : _a3.stdout) == null ? void 0 : _b3.removeListener("data", onFirstData);
          (_d3 = (_c3 = this.keyboardProcess) == null ? void 0 : _c3.stderr) == null ? void 0 : _d3.removeListener("data", onStartupError);
          if (this.isStarting) {
            reject(
              new Error(`Process exited with code ${code} during startup`)
            );
          }
        });
      });
      await startupPromise;
      (_b = this.keyboardProcess.stdout) == null ? void 0 : _b.on("data", this.handleKeyboardOutput);
      (_c = this.keyboardProcess.stderr) == null ? void 0 : _c.on("data", (data) => {
        console.error("Keyboard monitor error:", data.toString());
      });
      this.keyboardProcess.on("close", (code) => {
        var _a2;
        console.log("Keyboard monitor process exited with code", code);
        this.clearStartupState();
        this.keyboardProcess = null;
        (_a2 = this.mainWindow) == null ? void 0 : _a2.webContents.send("keyboard-service-state", false);
      });
      await this.store.setIsEnabled(true);
      (_d = this.mainWindow) == null ? void 0 : _d.webContents.send("keyboard-service-state", true);
    } catch (error) {
      this.handleStartupFailure(
        error instanceof Error ? error.message : "Unknown error during startup"
      );
    }
  }
  clearStartupState() {
    var _a;
    this.isStarting = false;
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }
    (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-service-loading", false);
  }
  handleStartupFailure(message) {
    var _a;
    this.clearStartupState();
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    electron.dialog.showErrorBox(
      "Keyboard Monitor Error",
      `Failed to start keyboard monitor: ${message}`
    );
    (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-service-state", false);
  }
  async stopListening() {
    var _a, _b, _c;
    if (this.keyboardProcess) {
      (_a = this.keyboardProcess.stdout) == null ? void 0 : _a.removeAllListeners();
      (_b = this.keyboardProcess.stderr) == null ? void 0 : _b.removeAllListeners();
      this.keyboardProcess.removeAllListeners();
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    await this.store.setIsEnabled(false);
    (_c = this.mainWindow) == null ? void 0 : _c.webContents.send("keyboard-service-state", false);
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
    this.mainWindow = null;
  }
}
class TrayFeature {
  constructor(mainWindow2, keyboardService2) {
    __publicField(this, "tray", null);
    __publicField(this, "mainWindow", null);
    __publicField(this, "keyboardService", null);
    this.mainWindow = mainWindow2;
    this.keyboardService = keyboardService2;
  }
  async initialize() {
    const icon = electron.nativeImage.createFromPath(path.join(__dirname, "../../src/assets/tray-icon.png")).resize({ width: 16, height: 16 });
    this.tray = new electron.Tray(icon);
    this.tray.setToolTip("HyperCaps - Keyboard Remapping Tool");
    await this.setupTrayMenu();
    this.registerGlobalShortcuts();
    this.setupEventListeners();
  }
  async setupTrayMenu() {
    if (!this.tray) return;
    const store = Store.getInstance();
    const isEnabled = await store.getIsEnabled();
    const startupOnBoot = await store.getStartupOnBoot();
    const enableOnStartup = await store.getEnableOnStartup();
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "HyperCaps",
        enabled: false,
        icon: electron.nativeImage.createFromPath(
          path.join(__dirname, "../../src/assets/tray-icon.png")
        ).resize({ width: 16, height: 16 })
      },
      { type: "separator" },
      {
        label: "Enable HyperCaps",
        type: "checkbox",
        checked: isEnabled,
        accelerator: "CommandOrControl+Shift+E",
        click: (menuItem) => {
          var _a, _b, _c;
          if (menuItem.checked) {
            (_a = this.keyboardService) == null ? void 0 : _a.startListening();
          } else {
            (_b = this.keyboardService) == null ? void 0 : _b.stopListening();
          }
          (_c = this.mainWindow) == null ? void 0 : _c.webContents.send(
            "keyboard-service-state",
            menuItem.checked
          );
        }
      },
      { type: "separator" },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: startupOnBoot,
        click: async (menuItem) => {
          await store.setStartupOnBoot(menuItem.checked);
        }
      },
      {
        label: "Enable on Startup",
        type: "checkbox",
        checked: enableOnStartup,
        click: async (menuItem) => {
          await store.setEnableOnStartup(menuItem.checked);
        }
      },
      { type: "separator" },
      {
        label: "Open Shortcut Manager",
        accelerator: "CommandOrControl+Shift+S",
        click: () => {
          this.showWindow();
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
          this.quit();
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
  registerGlobalShortcuts() {
    const ret = electron.globalShortcut.register("CommandOrControl+Shift+S", () => {
      this.showWindow();
    });
    if (!ret) {
      console.error("Failed to register global shortcut");
    }
  }
  setupEventListeners() {
    if (!this.tray) return;
    this.tray.on("double-click", () => {
      this.showWindow();
    });
  }
  showWindow() {
    var _a, _b;
    (_a = this.mainWindow) == null ? void 0 : _a.show();
    (_b = this.mainWindow) == null ? void 0 : _b.focus();
  }
  quit() {
    if (this.mainWindow) {
      this.mainWindow.isQuitting = true;
    }
    require("electron").app.quit();
  }
  dispose() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
console.log("=== Environment Debug ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isDev:", process.env.NODE_ENV === "development");
console.log("======================");
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
let trayFeature = null;
let mainWindow = null;
const createWindow = () => {
  console.log("Environment:", process.env.NODE_ENV);
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/preload.js")
    },
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    // Round corners on Windows 11
    roundedCorners: true,
    backgroundMaterial: "acrylic",
    darkTheme: true,
    backgroundColor: "#00000000"
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("close", (event) => {
    if (!mainWindow.isQuitting) {
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
};
electron.ipcMain.on("minimize-window", () => {
  mainWindow == null ? void 0 : mainWindow.minimize();
});
electron.ipcMain.on("close-window", () => {
  mainWindow == null ? void 0 : mainWindow.hide();
});
electron.app.whenReady().then(async () => {
  const store = Store.getInstance();
  await store.load();
  const enableOnStartup = await store.getEnableOnStartup();
  if (enableOnStartup) {
    keyboardService == null ? void 0 : keyboardService.startListening();
  }
  createWindow();
  if (mainWindow && keyboardService) {
    trayFeature = new TrayFeature(mainWindow, keyboardService);
    await trayFeature.initialize();
  }
  electron.ipcMain.handle("get-startup-settings", async () => {
    return {
      startupOnBoot: await store.getStartupOnBoot(),
      enableOnStartup: await store.getEnableOnStartup()
    };
  });
  electron.ipcMain.handle("set-startup-on-boot", async (event, enabled) => {
    await store.setStartupOnBoot(enabled);
  });
  electron.ipcMain.handle("set-enable-on-startup", async (event, enabled) => {
    await store.setEnableOnStartup(enabled);
  });
});
electron.app.on("before-quit", () => {
  if (keyboardService) {
    keyboardService.dispose();
  }
  if (trayFeature) {
    trayFeature.dispose();
  }
  electron.globalShortcut.unregisterAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//# sourceMappingURL=main.js.map
