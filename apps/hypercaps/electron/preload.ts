import { IPCCommand } from '@hypercaps/ipc';
import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface PreloadAPI {
  minimizeWindow: () => void;
  closeWindow: () => void;
  ipc: {
    run: <TParams = unknown, TResult = unknown>(
      command: IPCCommand<TParams>
    ) => Promise<TResult>;
    on: <TData = unknown>(
      service: string,
      event: string,
      callback: (data: TData) => void
    ) => () => void;
  };
}

// Create the API implementation
const api: PreloadAPI = {
  // Window controls - keeping these simple operations direct
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window');
  },
  closeWindow: () => {
    ipcRenderer.send('close-window');
  },

  // Custom IPC Bridge
  ipc: {
    // Command handling
    run: async <TParams = unknown, TResult = unknown>(
      command: IPCCommand<TParams>
    ): Promise<TResult> => {
      console.log('[Preload] Running command:', command);
      const result = await ipcRenderer.invoke('ipc:command', command);
      console.log('[Preload] Command result:', result);
      return result as TResult;
    },

    // Event handling
    on: <TData = unknown>(
      service: string,
      event: string,
      callback: (data: TData) => void
    ) => {
      console.log('[Preload] Setting up event listener:', service, event);
      const handler = (
        _: unknown,
        ipcEvent: { service: string; event: string; data: TData }
      ) => {
        console.log('[Preload] Received event:', ipcEvent);
        if (ipcEvent.service === service && ipcEvent.event === event) {
          console.log('[Preload] Event matched, calling callback');
          callback(ipcEvent.data);
        }
      };
      ipcRenderer.on('ipc:event', handler);
      return () => {
        console.log('[Preload] Removing event listener:', service, event);
        ipcRenderer.removeListener('ipc:event', handler);
      };
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api);
