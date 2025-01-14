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
  // Custom IPC Bridge
  ipc: {
    // Command handling
    run: async (command) => {
      console.log("[Preload] Running command:", command);
      const result = await electron.ipcRenderer.invoke("ipc:command", command);
      console.log("[Preload] Command result:", result);
      return result;
    },
    // Event handling
    on: (service, event, callback) => {
      console.log("[Preload] Setting up event listener:", service, event);
      const handler = (_, ipcEvent) => {
        console.log("[Preload] Received event:", ipcEvent);
        if (ipcEvent.service === service && ipcEvent.event === event) {
          console.log("[Preload] Event matched, calling callback");
          callback(ipcEvent.data);
        }
      };
      electron.ipcRenderer.on("ipc:event", handler);
      return () => {
        console.log("[Preload] Removing event listener:", service, event);
        electron.ipcRenderer.removeListener("ipc:event", handler);
      };
    }
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
  // Shortcut manager
  getShortcutConfig: async () => {
    return electron.ipcRenderer.invoke("get-shortcut-config");
  },
  getShortcuts: async () => {
    return electron.ipcRenderer.invoke("get-shortcuts");
  },
  addShortcut: async (shortcut) => {
    return electron.ipcRenderer.invoke("add-shortcut", shortcut);
  },
  removeShortcut: async (id) => {
    return electron.ipcRenderer.invoke("remove-shortcut", id);
  },
  updateShortcut: async (id, shortcut) => {
    return electron.ipcRenderer.invoke("update-shortcut", shortcut);
  },
  toggleShortcut: async (id) => {
    return electron.ipcRenderer.invoke("toggle-shortcut", id);
  }
});
//# sourceMappingURL=preload.js.map
