import { contextBridge, ipcRenderer } from "electron";
import { AppState } from "./services/store/types/app-state";
import { HyperKeyFeatureConfig } from "./features/hyperkeys/types/hyperkey-feature";

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

  // Keyboard service
  startListening: () => {
    ipcRenderer.send("start-listening");
  },
  stopListening: () => {
    ipcRenderer.send("stop-listening");
  },
  isListening: async () => {
    return ipcRenderer.invoke("get-keyboard-service-state");
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

  // Event listeners
  onKeyboardEvent: (callback: (event: any) => void) => {
    ipcRenderer.on("keyboard-event", (_, data) => callback(data));
  },
  onKeyboardServiceState: (callback: (event: any) => void) => {
    ipcRenderer.on("keyboard-service-state", (_, data) => callback(data));
  },
  onHyperKeyState: (callback: (event: any) => void) => {
    ipcRenderer.on("hyperkey-state", (_, data) => callback(data));
  },
});
