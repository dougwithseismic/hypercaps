import { BrowserWindow } from 'electron';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * Events that can be emitted by the MainWindow
 * @example
 * ```ts
 * type MainWindowEvents = {
 *   windowClose: () => void;    // Emitted when window is closed
 *   windowMinimize: () => void; // Emitted when window is minimized
 * }
 * ```
 */
type MainWindowEvents = {
  windowClose: () => void;
  windowMinimize: () => void;
};

/**
 * Configuration options for the main window
 */
export interface MainWindowConfig {
  width?: number;
  height?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  fullscreenable?: boolean;
  darkTheme?: boolean;
}

/**
 * Singleton class that manages the main application window
 * @example
 * ```ts
 * const window = MainWindow.getInstance();
 * await window.initialize();
 *
 * // Listen for window events
 * window.on('windowClose', () => {
 *   console.log('Window closed');
 * });
 *
 * // Get the underlying Electron window
 * const browserWindow = window.getWindow();
 * ```
 */
export class MainWindow {
  private static instance: MainWindow;
  private window: BrowserWindow | null = null;
  private eventEmitter: EventEmitter;
  private isQuitting = false;

  private constructor() {
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Gets the singleton instance of MainWindow
   * @returns The MainWindow instance
   * @example
   * ```ts
   * const window = MainWindow.getInstance();
   * ```
   */
  public static getInstance(): MainWindow {
    if (!MainWindow.instance) {
      MainWindow.instance = new MainWindow();
    }
    return MainWindow.instance;
  }

  /**
   * Initializes the main window with default settings
   * @example
   * ```ts
   * const window = MainWindow.getInstance();
   * await window.initialize();
   * ```
   */
  public async initialize(): Promise<void> {
    this.window = new BrowserWindow({
      width: 300,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/preload.js'),
        disableHtmlFullscreenWindowResize: true,
        enableWebSQL: false,
      },
      resizable: true,
      minimizable: true,
      maximizable: false,
      fullscreenable: false,
      roundedCorners: true,
      backgroundMaterial: 'acrylic',
      darkTheme: true,
      backgroundColor: '#00000000',
    });

    this.window.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.window?.hide();
      }
      this.eventEmitter.emit('windowClose');
    });

    this.window.on('minimize', () => {
      this.eventEmitter.emit('windowMinimize');
    });
  }

  /**
   * Gets the underlying Electron BrowserWindow instance
   * @returns The BrowserWindow instance or null if not initialized
   * @example
   * ```ts
   * const window = MainWindow.getInstance();
   * const browserWindow = window.getWindow();
   * if (browserWindow) {
   *   browserWindow.show();
   * }
   * ```
   */
  public getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Updates the window configuration
   * @param config The new window configuration options
   * @example
   * ```ts
   * window.updateConfig({
   *   width: 400,
   *   height: 500,
   *   resizable: false
   * });
   * ```
   */
  public updateConfig(config: MainWindowConfig): void {
    if (!this.window) return;
    if (config.width)
      this.window.setSize(config.width, this.window.getSize()[1]);
    if (config.height)
      this.window.setSize(this.window.getSize()[0], config.height);
    if (config.resizable !== undefined)
      this.window.setResizable(config.resizable);
    if (config.minimizable !== undefined)
      this.window.setMinimizable(config.minimizable);
    if (config.maximizable !== undefined)
      this.window.setMaximizable(config.maximizable);
    if (config.fullscreenable !== undefined)
      this.window.setFullScreenable(config.fullscreenable);
  }

  /**
   * Gracefully closes the window and cleans up resources
   * @example
   * ```ts
   * await window.close();
   * ```
   */
  public async close(): Promise<void> {
    if (!this.window) return;
    this.isQuitting = true;
    this.window.close();
    this.window = null;
    this.eventEmitter.removeAllListeners();
  }

  /**
   * Registers an event listener
   * @param event The event to listen for
   * @param listener The callback function
   * @example
   * ```ts
   * const window = MainWindow.getInstance();
   * window.on('windowClose', () => {
   *   console.log('Window closed');
   * });
   * ```
   */
  public on<K extends keyof MainWindowEvents>(
    event: K,
    listener: MainWindowEvents[K]
  ): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Removes an event listener
   * @param event The event to stop listening to
   * @param listener The callback function to remove
   * @example
   * ```ts
   * const window = MainWindow.getInstance();
   * const listener = () => console.log('Window closed');
   *
   * window.on('windowClose', listener);
   * // Later...
   * window.off('windowClose', listener);
   * ```
   */
  public off<K extends keyof MainWindowEvents>(
    event: K,
    listener: MainWindowEvents[K]
  ): void {
    this.eventEmitter.off(event, listener);
  }
}

export const mainWindow = MainWindow.getInstance();
