import { Menu, Tray, nativeImage, app } from 'electron'
import { trayStore } from './store'

export class TrayFeature {
  private tray: Tray | null = null
  private config = trayStore.get()

  constructor() {
    // Subscribe to store changes
    trayStore.on({
      event: 'store:changed',
      handler: ({ config }) => {
        this.config = config
        this.updateTrayState()
      }
    })
  }

  private async updateTrayState() {
    if (!this.tray) return

    // Update tray visibility
    if (!this.config.enabled) {
      this.dispose()
      return
    }

    this.tray.setToolTip('HyperCaps')
    await this.updateContextMenu()
  }

  public async initialize() {
    if (!this.config.enabled) return

    // Create a transparent 16x16 image for the tray
    const icon = nativeImage.createEmpty()
    icon.addRepresentation({
      width: 16,
      height: 16,
      scaleFactor: 1.0,
      buffer: Buffer.alloc(16 * 16 * 4) // Transparent RGBA buffer
    })

    this.tray = new Tray(icon)
    await this.updateTrayState()
  }

  private async updateContextMenu() {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'HyperCaps',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Notifications',
        type: 'checkbox',
        checked: this.config.showNotifications,
        click: () => {
          trayStore.update({
            update: (config) => {
              config.showNotifications = !config.showNotifications
            }
          })
        }
      },
      { type: 'separator' },
      {
        label: 'Minimize to Tray',
        type: 'checkbox',
        checked: this.config.minimizeToTray,
        click: () => {
          trayStore.update({
            update: (config) => {
              config.minimizeToTray = !config.minimizeToTray
            }
          })
        }
      },
      {
        label: 'Close to Tray',
        type: 'checkbox',
        checked: this.config.closeToTray,
        click: () => {
          trayStore.update({
            update: (config) => {
              config.closeToTray = !config.closeToTray
            }
          })
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => {
          this.dispose()
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public dispose() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

const trayFeature = new TrayFeature()
export default trayFeature
