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
  onKeyboardServiceLoading: (callback: (loading: boolean) => void) => {
    ipcRenderer.on("keyboard-service-loading", (_, loading) =>
      callback(loading)
    );
  },
  getMappings: () => ipcRenderer.invoke("get-mappings"),
  addMapping: (mapping: any) => ipcRenderer.invoke("add-mapping", mapping),
  updateMapping: (id: string, updates: any) =>
    ipcRenderer.invoke("update-mapping", id, updates),
  deleteMapping: (id: string) => ipcRenderer.invoke("delete-mapping", id),

  // HyperKey config
  getHyperKeyConfig: () => ipcRenderer.invoke("get-hyperkey-config"),
  setHyperKeyConfig: (config: any) =>
    ipcRenderer.invoke("set-hyperkey-config", config),

  // Startup settings
  getStartupSettings: () => ipcRenderer.invoke("get-startup-settings"),
  setStartupOnBoot: (enabled: boolean) =>
    ipcRenderer.invoke("set-startup-on-boot", enabled),
  setEnableOnStartup: (enabled: boolean) =>
    ipcRenderer.invoke("set-enable-on-startup", enabled),
});

// Expose window control methods
contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.send("minimize-window"),
  close: () => ipcRenderer.send("close-window"),
});
