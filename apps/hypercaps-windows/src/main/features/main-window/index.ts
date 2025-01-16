import { optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import icon from '../../../../resources/icon.png?asset'
import { window, windowStore } from './store'

interface MainWindowConfig {
  readonly preloadPath: string
  readonly icon?: string
}

export class MainWindow {
  private static instance: MainWindow | null = null
  private window: BrowserWindow | null = null
  private readonly config: MainWindowConfig
  private storeConfig = windowStore.get()

  private constructor(
    config: MainWindowConfig = {
      preloadPath: join(__dirname, '../preload/index.js'),
      icon: process.platform === 'linux' ? icon : undefined
    }
  ) {
    this.config = config

    // Subscribe to store changes
    windowStore.on({
      event: 'store:changed',
      handler: ({ config }) => {
        this.storeConfig = config
        this.syncWindowWithStore()
      }
    })
  }

  public static getInstance(config?: MainWindowConfig): MainWindow {
    if (!MainWindow.instance) {
      MainWindow.instance = new MainWindow(config)
    }
    return MainWindow.instance
  }

  private syncWindowWithStore(): void {
    if (!this.window) return

    // Sync window bounds
    if (this.storeConfig.behavior.rememberPosition || this.storeConfig.behavior.rememberSize) {
      this.window.setBounds(this.storeConfig.bounds)
    }

    // Sync window state
    if (this.storeConfig.state.isMaximized && !this.window.isMaximized()) {
      this.window.maximize()
    } else if (!this.storeConfig.state.isMaximized && this.window.isMaximized()) {
      this.window.unmaximize()
    }

    if (this.storeConfig.state.isMinimized && !this.window.isMinimized()) {
      this.window.minimize()
    } else if (!this.storeConfig.state.isMinimized && this.window.isMinimized()) {
      this.window.restore()
    }

    // Sync visibility
    if (this.storeConfig.state.isVisible && !this.window.isVisible()) {
      this.window.show()
    } else if (!this.storeConfig.state.isVisible && this.window.isVisible()) {
      this.window.hide()
    }

    // Sync always on top
    this.window.setAlwaysOnTop(this.storeConfig.state.isAlwaysOnTop)

    // Sync appearance
    if (this.storeConfig.appearance.backgroundColor) {
      this.window.setBackgroundColor(this.storeConfig.appearance.backgroundColor)
    }
    if (this.storeConfig.appearance.opacity) {
      this.window.setOpacity(this.storeConfig.appearance.opacity)
    }
    if (this.storeConfig.appearance.vibrancy && this.storeConfig.appearance.vibrancy !== 'none') {
      this.window.setVibrancy(this.storeConfig.appearance.vibrancy)
    }
  }

  public initialize(): void {
    if (this.window) return // Prevent multiple windows

    this.window = new BrowserWindow({
      ...this.storeConfig.bounds,
      show: !this.storeConfig.behavior.startMinimized,
      autoHideMenuBar: this.storeConfig.behavior.hideMenuBar,
      ...(this.config.icon ? { icon: this.config.icon } : {}),
      webPreferences: {
        preload: this.config.preloadPath,
        sandbox: false
      }
    })

    this.setupEventListeners()
    this.loadContent()
    this.syncWindowWithStore()
  }

  private setupEventListeners(): void {
    if (!this.window) return

    // Window state events
    this.window.on('maximize', () => window.setState({ isMaximized: true }))
    this.window.on('unmaximize', () => window.setState({ isMaximized: false }))
    this.window.on('minimize', () => window.setState({ isMinimized: true }))
    this.window.on('restore', () => window.setState({ isMinimized: false }))
    this.window.on('show', () => window.setState({ isVisible: true }))
    this.window.on('hide', () => window.setState({ isVisible: false }))
    this.window.on('focus', () => window.setState({ isFocused: true }))
    this.window.on('blur', () => window.setState({ isFocused: false }))

    // Window bounds events
    this.window.on('move', () => {
      const bounds = this.window?.getBounds()
      if (bounds) window.setBounds(bounds)
    })

    this.window.on('resize', () => {
      const bounds = this.window?.getBounds()
      if (bounds) window.setBounds(bounds)
    })

    // Window ready event
    this.window.on('ready-to-show', () => {
      if (!this.storeConfig.behavior.startMinimized) {
        this.window?.show()
        window.setState({ isVisible: true })
      }
    })

    // External links
    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // Window shortcuts
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Window close handling
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
      MainWindow.instance = null // Reset singleton on window close
    })

    // Window reactivation
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

    // Load the local URL for development or the local html file for production
    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
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
