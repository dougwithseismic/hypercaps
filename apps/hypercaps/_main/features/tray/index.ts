import { Menu, Tray, nativeImage, globalShortcut } from 'electron';

export class TrayFeature {
  private tray: Tray | null = null;

  constructor() {}

  private async updateTrayState() {
    if (!this.tray) return;
    this.tray.setToolTip('HyperCaps');
  }

  public async initialize() {
    // Create a transparent 16x16 image for the tray
    const icon = nativeImage.createEmpty();
    icon.addRepresentation({
      width: 16,
      height: 16,
      scaleFactor: 1.0,
      buffer: Buffer.alloc(16 * 16 * 4), // Transparent RGBA buffer
    });

    this.tray = new Tray(icon);
    this.updateTrayState();

    // Initial menu setup
    await this.updateContextMenu();
  }

  private async updateContextMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'HyperCaps',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => {
          this.dispose();
          // Force quit the application
          require('electron').app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public dispose() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

const trayFeature = new TrayFeature();
export default trayFeature;
