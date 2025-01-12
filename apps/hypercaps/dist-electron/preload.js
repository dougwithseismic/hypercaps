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
  getMappings: () => electron.ipcRenderer.invoke("get-mappings"),
  addMapping: (mapping) => electron.ipcRenderer.invoke("add-mapping", mapping),
  updateMapping: (id, updates) => electron.ipcRenderer.invoke("update-mapping", id, updates),
  deleteMapping: (id) => electron.ipcRenderer.invoke("delete-mapping", id)
});
