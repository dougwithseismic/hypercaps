import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  startListening: () => ipcRenderer.send("start-listening"),
  stopListening: () => ipcRenderer.send("stop-listening"),
  onKeyboardEvent: (callback: (event: any) => void) => {
    ipcRenderer.on("keyboard-event", (_, data) => callback(data));
  },
  onKeyboardServiceState: (callback: (enabled: boolean) => void) => {
    ipcRenderer.on("keyboard-service-state", (_, enabled) => callback(enabled));
  },
  getMappings: () => ipcRenderer.invoke("get-mappings"),
  addMapping: (mapping: any) => ipcRenderer.invoke("add-mapping", mapping),
  updateMapping: (id: string, updates: any) =>
    ipcRenderer.invoke("update-mapping", id, updates),
  deleteMapping: (id: string) => ipcRenderer.invoke("delete-mapping", id),

  // Startup settings
  getStartupSettings: () => ipcRenderer.invoke("get-startup-settings"),
  setStartupOnBoot: (enabled: boolean) =>
    ipcRenderer.invoke("set-startup-on-boot", enabled),
  setEnableOnStartup: (enabled: boolean) =>
    ipcRenderer.invoke("set-enable-on-startup", enabled),
});
