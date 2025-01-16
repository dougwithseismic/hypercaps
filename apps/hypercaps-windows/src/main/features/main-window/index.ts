import { is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import icon from '../../../../resources/icon.png?asset'

interface MainWindowConfig {
  readonly width: number
  readonly height: number
  readonly preloadPath: string
  readonly icon?: string
}

export class MainWindow {
  private static instance: MainWindow | null = null
  private window: BrowserWindow | null = null
  private readonly config: MainWindowConfig

  private constructor(
    config: MainWindowConfig = {
      width: 900,
      height: 670,
      preloadPath: join(__dirname, '../preload/index.js'),
      icon: process.platform === 'linux' ? icon : undefined
    }
  ) {
    this.config = config
  }

  public static getInstance(config?: MainWindowConfig): MainWindow {
    if (!MainWindow.instance) {
      MainWindow.instance = new MainWindow(config)
    }
    return MainWindow.instance
  }

  public initialize(): void {
    if (this.window) return // Prevent multiple windows

    this.window = new BrowserWindow({
      width: this.config.width,
      height: this.config.height,
      show: false,
      autoHideMenuBar: true,
      ...(this.config.icon ? { icon: this.config.icon } : {}),
      webPreferences: {
        preload: this.config.preloadPath,
        sandbox: false
      }
    })

    this.setupEventListeners()
    this.loadContent()
  }

  private setupEventListeners(): void {
    if (!this.window) return

    this.window.on('ready-to-show', () => {
      this.window?.show()
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
      MainWindow.instance = null // Reset singleton on window close
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.initialize()
      }
    })

    // IPC test handler
    ipcMain.on('ping', () => console.log('pong'))
  }

  private loadContent(): void {
    if (!this.window) return

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.window.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  public getWindow(): BrowserWindow | null {
    return this.window
  }

  public static destroyInstance(): void {
    if (MainWindow.instance) {
      MainWindow.instance.window?.destroy()
      MainWindow.instance = null
    }
  }
}

export const mainWindow = MainWindow.getInstance()
