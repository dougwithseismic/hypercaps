"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel, ...args) => {
      electron.ipcRenderer.send(channel, ...args);
    },
    on: (channel, func) => {
      electron.ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    removeListener: (channel, func) => {
      electron.ipcRenderer.removeListener(channel, func);
    },
    getMappings: () => electron.ipcRenderer.invoke("get-mappings"),
    addMapping: (mapping) => electron.ipcRenderer.invoke("add-mapping", mapping),
    updateMapping: (id, updates) => electron.ipcRenderer.invoke("update-mapping", id, updates),
    deleteMapping: (id) => electron.ipcRenderer.invoke("delete-mapping", id)
  }
});
