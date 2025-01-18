// Set N-API uncaught exceptions policy before any requires
process.env.NODE_OPTIONS = '--force-node-api-uncaught-exceptions-policy=true'

import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain } from 'electron'
import { mainWindow } from './features/main-window'
import trayFeature from './features/tray'
import { keyboardService } from './service/keyboard/keyboard-service'
import { sequenceManagerFeature } from './features/sequence-manager'

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  await keyboardService.initialize()
  await trayFeature.initialize()
  await sequenceManagerFeature.initialize()

  sequenceManagerFeature.on('sequence-detected', (sequence) => {
    console.log('sequence-detected', sequence)
  })

  await sequenceManagerFeature.initialize()

  mainWindow.initialize()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) mainWindow.initialize()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
