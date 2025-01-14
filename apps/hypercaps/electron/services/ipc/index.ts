import { ipcMain, BrowserWindow } from 'electron';
import { ipc as ipcService } from '@hypercaps/ipc';

export const ipc = ipcService;

// Set up event forwarding to renderer processes
ipc.onEvent((event) => {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    console.log('[IPCService] Sending event to window:', window.id);
    window.webContents.send('ipc:event', event);
  });
});
