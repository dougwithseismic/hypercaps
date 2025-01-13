"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  // Window controls
  minimizeWindow: () => {
    electron.ipcRenderer.send("minimize-window");
  },
  closeWindow: () => {
    electron.ipcRenderer.send("close-window");
  },
  // Keyboard service
  startListening: () => {
    electron.ipcRenderer.send("start-listening");
  },
  stopListening: () => {
    electron.ipcRenderer.send("stop-listening");
  },
  isListening: async () => {
    return electron.ipcRenderer.invoke("get-keyboard-service-state");
  },
  // HyperKey feature
  getHyperKeyConfig: async () => {
    return electron.ipcRenderer.invoke("get-hyperkey-config");
  },
  setHyperKeyConfig: async (config) => {
    return electron.ipcRenderer.invoke("set-hyperkey-config", config);
  },
  // App settings
  getStartupSettings: async () => {
    return electron.ipcRenderer.invoke("get-startup-settings");
  },
  setStartupOnBoot: async (enabled) => {
    return electron.ipcRenderer.invoke("set-startup-on-boot", enabled);
  },
  setStartMinimized: async (enabled) => {
    return electron.ipcRenderer.invoke("set-start-minimized", enabled);
  },
  // Store state
  getFullState: async () => {
    return electron.ipcRenderer.invoke("get-full-state");
  },
  // Event listeners
  onKeyboardEvent: (callback) => {
    electron.ipcRenderer.on("keyboard-event", (_, data) => callback(data));
  },
  onKeyboardServiceState: (callback) => {
    electron.ipcRenderer.on("keyboard-service-state", (_, data) => callback(data));
  },
  onHyperKeyState: (callback) => {
    electron.ipcRenderer.on("hyperkey-state", (_, data) => callback(data));
  }
});
//# sourceMappingURL=preload.js.map
