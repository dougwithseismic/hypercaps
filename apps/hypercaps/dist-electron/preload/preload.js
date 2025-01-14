"use strict";
const electron = require("electron");
const api = {
  // Window controls - keeping these simple operations direct
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
  }
};
electron.contextBridge.exposeInMainWorld("api", api);
//# sourceMappingURL=preload.js.map
