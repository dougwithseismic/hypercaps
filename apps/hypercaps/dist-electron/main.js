"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
class KeyboardService {
  constructor() {
    __publicField(this, "mainWindow", null);
    __publicField(this, "keyboardProcess", null);
    __publicField(this, "mappings", []);
    __publicField(this, "nextId", 1);
  }
  generateId() {
    return `mapping-${Date.now()}-${this.nextId++}`;
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  startListening() {
    if (this.keyboardProcess) {
      return;
    }
    const isDev = process.env.NODE_ENV === "development";
    const scriptPath = isDev ? path.resolve(process.cwd(), "electron/scripts/keyboard-monitor.ps1") : path.resolve(__dirname, "../scripts/keyboard-monitor.ps1");
    console.log("Starting keyboard monitor with script:", scriptPath);
    this.keyboardProcess = child_process.spawn("powershell.exe", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath
    ]);
    this.keyboardProcess.stdout.on("data", (data) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line) => {
        var _a;
        try {
          const state = JSON.parse(line);
          (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-event", {
            ctrlKey: state.ctrl,
            altKey: state.alt,
            shiftKey: state.shift,
            metaKey: state.win,
            capsLock: state.caps,
            pressedKeys: state.pressedKeys || [],
            timestamp: Date.now()
          });
        } catch (error) {
          console.error("Error parsing keyboard state:", error);
        }
      });
    });
    this.keyboardProcess.stderr.on("data", (data) => {
      console.error("Keyboard monitor error:", data.toString());
    });
    this.keyboardProcess.on("close", (code) => {
      console.log("Keyboard monitor process exited with code:", code);
      this.keyboardProcess = null;
    });
  }
  stopListening() {
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
  }
  getMappings() {
    return this.mappings;
  }
  addMapping(mapping) {
    const newMapping = { ...mapping, id: this.generateId() };
    this.mappings.push(newMapping);
    return newMapping;
  }
  updateMapping(id, updates) {
    const index = this.mappings.findIndex((m) => m.id === id);
    if (index === -1) return null;
    this.mappings[index] = { ...this.mappings[index], ...updates };
    return this.mappings[index];
  }
  deleteMapping(id) {
    const index = this.mappings.findIndex((m) => m.id === id);
    if (index === -1) return false;
    this.mappings.splice(index, 1);
    return true;
  }
  dispose() {
    this.stopListening();
  }
}
if (require("electron-squirrel-startup")) {
  electron.app.quit();
}
let keyboardService;
const createWindow = () => {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  try {
    keyboardService = new KeyboardService();
    keyboardService.setMainWindow(mainWindow);
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
    const handleKeyboardOutput = (data) => {
      try {
        const state = JSON.parse(data);
        mainWindow == null ? void 0 : mainWindow.webContents.send("keyboard-event", {
          ctrlKey: state.ctrl,
          altKey: state.alt,
          shiftKey: state.shift,
          metaKey: state.win,
          capsLock: state.caps,
          pressedKeys: state.pressedKeys || [],
          timestamp: Date.now()
        });
      } catch (error) {
        console.error("Error parsing keyboard state:", error);
      }
    };
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
electron.app.whenReady().then(createWindow);
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (keyboardService) {
      keyboardService.dispose();
    }
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
