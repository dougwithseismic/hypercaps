"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  startListening: () => electron.ipcRenderer.send("start-listening"),
  stopListening: () => electron.ipcRenderer.send("stop-listening"),
  onKeyboardEvent: (callback) => {
    electron.ipcRenderer.on("keyboard-event", (_, data) => callback(data));
  },
  onKeyboardServiceState: (callback) => {
    electron.ipcRenderer.on("keyboard-service-state", (_, enabled) => callback(enabled));
  },
  onKeyboardServiceLoading: (callback) => {
    electron.ipcRenderer.on(
      "keyboard-service-loading",
      (_, loading) => callback(loading)
    );
  },
  getMappings: () => electron.ipcRenderer.invoke("get-mappings"),
  addMapping: (mapping) => electron.ipcRenderer.invoke("add-mapping", mapping),
  updateMapping: (id, updates) => electron.ipcRenderer.invoke("update-mapping", id, updates),
  deleteMapping: (id) => electron.ipcRenderer.invoke("delete-mapping", id),
  // HyperKey config
  getHyperKeyConfig: () => electron.ipcRenderer.invoke("get-hyperkey-config"),
  setHyperKeyConfig: (config) => electron.ipcRenderer.invoke("set-hyperkey-config", config),
  // Startup settings
  getStartupSettings: () => electron.ipcRenderer.invoke("get-startup-settings"),
  setStartupOnBoot: (enabled) => electron.ipcRenderer.invoke("set-startup-on-boot", enabled),
  setEnableOnStartup: (enabled) => electron.ipcRenderer.invoke("set-enable-on-startup", enabled)
});
electron.contextBridge.exposeInMainWorld("electron", {
  minimize: () => electron.ipcRenderer.send("minimize-window"),
  close: () => electron.ipcRenderer.send("close-window")
});
//# sourceMappingURL=preload.js.map
