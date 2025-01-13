import { contextBridge, ipcRenderer } from "electron";
import { AppState } from "./services/store/types/app-state";
import { HyperKeyFeatureConfig } from "./features/hyperkeys/types/hyperkey-feature";
import type { IPCCommand } from "./services/ipc/types";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  // Window controls
  minimizeWindow: () => {
    ipcRenderer.send("minimize-window");
  },
  closeWindow: () => {
    ipcRenderer.send("close-window");
  },

  // Custom IPC Bridge
  ipc: {
    // Command handling
    run: async <TParams = unknown, TResult = unknown>(
      command: IPCCommand<TParams>
    ): Promise<TResult> => {
      console.log("[Preload] Running command:", command);
      const result = await ipcRenderer.invoke("ipc:command", command);
      console.log("[Preload] Command result:", result);
      return result as TResult;
    },

    // Event handling
    on: <TData = unknown>(
      service: string,
      event: string,
      callback: (data: TData) => void
    ) => {
      console.log("[Preload] Setting up event listener:", service, event);
      const handler = (
        _: unknown,
        ipcEvent: { service: string; event: string; data: TData }
      ) => {
        console.log("[Preload] Received event:", ipcEvent);
        if (ipcEvent.service === service && ipcEvent.event === event) {
          console.log("[Preload] Event matched, calling callback");
          callback(ipcEvent.data);
        }
      };
      ipcRenderer.on("ipc:event", handler);
      return () => {
        console.log("[Preload] Removing event listener:", service, event);
        ipcRenderer.removeListener("ipc:event", handler);
      };
    },
  },

  // HyperKey feature
  getHyperKeyConfig: async () => {
    return ipcRenderer.invoke("get-hyperkey-config");
  },
  setHyperKeyConfig: async (config: HyperKeyFeatureConfig) => {
    return ipcRenderer.invoke("set-hyperkey-config", config);
  },

  // App settings
  getStartupSettings: async () => {
    return ipcRenderer.invoke("get-startup-settings");
  },
  setStartupOnBoot: async (enabled: boolean) => {
    return ipcRenderer.invoke("set-startup-on-boot", enabled);
  },
  setStartMinimized: async (enabled: boolean) => {
    return ipcRenderer.invoke("set-start-minimized", enabled);
  },

  // Store state
  getFullState: async () => {
    return ipcRenderer.invoke("get-full-state") as Promise<AppState>;
  },
});
