import { ipc as ipcService } from '@hypercaps/ipc';
import { BrowserWindow } from 'electron';

export const ipc = ipcService;

// Set up event forwarding to renderer processes
ipc.onEvent((event) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    console.log('[IPCService] Sending event to window:', window.id);
    console.dir(event, { depth: null });
    window.webContents.send('ipc:event', event);
  });
});
