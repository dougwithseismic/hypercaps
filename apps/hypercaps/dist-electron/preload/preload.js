"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  startListening: async () => {
    console.debug("[Preload] Checking service state before starting");
    const state = await electron.ipcRenderer.invoke("get-keyboard-service-state");
    if (state) {
      console.debug("[Preload] Service already running, skipping start");
      return;
    }
    console.debug("[Preload] Sending start-listening");
    electron.ipcRenderer.send("start-listening");
  },
  stopListening: () => {
    console.debug("[Preload] Sending stop-listening");
    electron.ipcRenderer.send("stop-listening");
  },
  onKeyboardEvent: (callback) => {
    console.debug("[Preload] Registering keyboard-event handler");
    electron.ipcRenderer.on("keyboard-event", (_, data) => {
      console.debug("[Preload] Received keyboard-event", data);
      callback(data);
    });
  },
  onKeyboardServiceState: (callback) => {
    console.debug("[Preload] Registering keyboard-service-state handler");
    electron.ipcRenderer.on("keyboard-service-state", (_, enabled) => {
      console.debug("[Preload] Received keyboard-service-state", enabled);
      callback(enabled);
    });
  },
  onKeyboardServiceLoading: (callback) => {
    console.debug("[Preload] Registering keyboard-service-loading handler");
    electron.ipcRenderer.on("keyboard-service-loading", (_, loading) => {
      console.debug("[Preload] Received keyboard-service-loading", loading);
      callback(loading);
    });
  },
  getMappings: async () => {
    console.debug("[Preload] Getting mappings");
    const mappings = await electron.ipcRenderer.invoke("get-mappings");
    console.debug("[Preload] Retrieved mappings", mappings);
    return mappings;
  },
  addMapping: async (mapping) => {
    console.debug("[Preload] Adding mapping", mapping);
    const result = await electron.ipcRenderer.invoke("add-mapping", mapping);
    console.debug("[Preload] Added mapping result", result);
    return result;
  },
  updateMapping: async (id, updates) => {
    console.debug("[Preload] Updating mapping", { id, updates });
    const result = await electron.ipcRenderer.invoke("update-mapping", id, updates);
    console.debug("[Preload] Updated mapping result", result);
    return result;
  },
  deleteMapping: async (id) => {
    console.debug("[Preload] Deleting mapping", id);
    const result = await electron.ipcRenderer.invoke("delete-mapping", id);
    console.debug("[Preload] Deleted mapping result", result);
    return result;
  },
  // HyperKey config
  getHyperKeyConfig: async () => {
    console.debug("[Preload] Getting hyperkey config");
    const config = await electron.ipcRenderer.invoke("get-hyperkey-config");
    console.debug("[Preload] Retrieved hyperkey config", config);
    return config;
  },
  setHyperKeyConfig: async (config) => {
    console.debug("[Preload] Setting hyperkey config", config);
    const result = await electron.ipcRenderer.invoke("set-hyperkey-config", config);
    console.debug("[Preload] Set hyperkey config result", result);
    return result;
  },
  restartWithConfig: async (config) => {
    console.debug("[Preload] Restarting with config", config);
    const result = await electron.ipcRenderer.invoke("restart-with-config", config);
    console.debug("[Preload] Restart with config result", result);
    return result;
  },
  onHyperKeyState: (callback) => {
    console.debug("[Preload] Registering hyperkey-state handler");
    electron.ipcRenderer.on("hyperkey-state", (_, config) => {
      console.debug("[Preload] Received hyperkey-state", config);
      callback(config);
    });
  },
  // Startup settings
  getStartupSettings: async () => {
    console.debug("[Preload] Getting startup settings");
    const settings = await electron.ipcRenderer.invoke("get-startup-settings");
    console.debug("[Preload] Retrieved startup settings", settings);
    return settings;
  },
  setStartupOnBoot: async (enabled) => {
    console.debug("[Preload] Setting startup on boot", enabled);
    const result = await electron.ipcRenderer.invoke("set-startup-on-boot", enabled);
    console.debug("[Preload] Set startup on boot result", result);
    return result;
  },
  setEnableOnStartup: async (enabled) => {
    console.debug("[Preload] Setting enable on startup", enabled);
    const result = await electron.ipcRenderer.invoke("set-enable-on-startup", enabled);
    console.debug("[Preload] Set enable on startup result", result);
    return result;
  },
  // Store state
  getFullState: async () => {
    console.debug("[Preload] Getting full state");
    const state = await electron.ipcRenderer.invoke("get-full-state");
    console.debug("[Preload] Retrieved full state", state);
    return state;
  },
  onStoreStateUpdate: (callback) => {
    console.debug("[Preload] Registering store-state-update handler");
    electron.ipcRenderer.on("store-state-update", (_, state) => {
      console.debug("[Preload] Received store-state-update", state);
      callback(state);
    });
  }
});
electron.contextBridge.exposeInMainWorld("electron", {
  minimize: () => {
    console.debug("[Preload] Minimizing window");
    electron.ipcRenderer.send("minimize-window");
  },
  close: () => {
    console.debug("[Preload] Closing window");
    electron.ipcRenderer.send("close-window");
  }
});
//# sourceMappingURL=preload.js.map
