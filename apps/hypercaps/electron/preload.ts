import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
    getMappings: () => ipcRenderer.invoke("get-mappings"),
    addMapping: (mapping: any) => ipcRenderer.invoke("add-mapping", mapping),
    updateMapping: (id: string, updates: any) =>
      ipcRenderer.invoke("update-mapping", id, updates),
    deleteMapping: (id: string) => ipcRenderer.invoke("delete-mapping", id),
  },
});
