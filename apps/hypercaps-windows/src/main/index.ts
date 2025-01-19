// Set N-API uncaught exceptions policy before any requires
process.env.NODE_OPTIONS = '--force-node-api-uncaught-exceptions-policy=true'

import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain } from 'electron'
import { mainWindow } from './features/main-window'
import trayFeature from './features/tray'
import { keyboardService } from './service/keyboard/keyboard-service'
import { sequenceManager } from './features/sequence-manager'

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

  // Initialize sequence manager
  sequenceManager.initialize()

  // Add some example moves
  sequenceManager.addMove({
    name: 'Ctrl+Space 3s',
    steps: [
      {
        type: 'hold',
        keys: ['Control', 'Space'],
        minHoldMs: 3000,
        maxHoldMs: 5000,
        completeOnReleaseAfterMinHold: true
      }
    ],
    onComplete: () => console.log('Held ctrl+space for 3s => success!'),
    onFail: () => console.log('ctrl+space 3s => fail or release too soon')
  })

  sequenceManager.addMove({
    name: 'Ctrl+Space 1s',
    steps: [
      {
        type: 'hold',
        keys: ['Control', 'Space'],
        minHoldMs: 1000,
        maxHoldMs: 2000,
        completeOnReleaseAfterMinHold: true
      }
    ],
    onComplete: () => console.log('Held ctrl+space for 1s => success!'),
    onFail: () => console.log('ctrl+space 1s => fail or release too soon')
  })

  sequenceManager.addMove({
    name: 'Double Shift',
    steps: [
      {
        type: 'press',
        keys: ['Shift'],
        maxGapMs: 1000
      },
      {
        type: 'press',
        keys: ['Shift'],
        maxGapMs: 1000
      }
    ],
    onComplete: () => console.log('Double shift pressed!'),
    onFail: () => console.log('Double shift failed.')
  })

  sequenceManager.addMove({
    name: 'Hold G + Triple H',
    steps: [
      {
        type: 'hold',
        keys: ['G'],
        minHoldMs: 0, // Start holding G
        completeOnReleaseAfterMinHold: false // Don't complete until all H presses are done
      },
      {
        type: 'press',
        keys: ['H'],
        maxGapMs: 500 // First H press within 500ms
      },
      {
        type: 'press',
        keys: ['H'],
        maxGapMs: 500 // Second H press within 500ms
      },
      {
        type: 'press',
        keys: ['H'],
        maxGapMs: 500 // Third H press within 500ms
      }
    ],
    onComplete: () => console.log('G held + H tapped three times!'),
    onFail: () => console.log('G+H combo failed.')
  })

  // Listen for move events
  sequenceManager.on('move:complete', ({ name }) => {
    console.log(`Move completed: ${name}`)
  })

  sequenceManager.on('move:fail', ({ name, reason, step }) => {
    console.log(`Move failed: ${name} (step ${step}, reason: ${reason})`)
  })

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
