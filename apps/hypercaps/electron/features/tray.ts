import {
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  globalShortcut,
} from 'electron';
import { KeyboardService } from './hyperkeys/keyboard-service';
import { Store } from '@electron/services/store';

export class TrayFeature {
  private tray: Tray | null = null;
  private store: Store;

  constructor(
    private mainWindow: BrowserWindow,
    private keyboardService: KeyboardService
  ) {
    this.store = Store.getInstance();
  }

  private async getStateIndicator() {
    const state = await this.keyboardService?.getState();
    if (!state) return { tooltip: 'HyperCaps ⭘' };

    if (state.error) return { tooltip: `HyperCaps ⚠️ Error: ${state.error}` };
    if (state.isLoading) return { tooltip: 'HyperCaps ⏳ Loading...' };
    if (state.isStarting) return { tooltip: 'HyperCaps ⏳ Starting...' };
    if (!state.isListening) return { tooltip: 'HyperCaps ❌ Stopped' };
    return { tooltip: 'HyperCaps ✅ Running' };
  }

  private async updateTrayState() {
    if (!this.tray) return;
    const { tooltip } = await this.getStateIndicator();
    this.tray.setToolTip(tooltip);
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

    // Register global shortcut
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    // Initial menu setup
    await this.updateContextMenu();

    // Listen for keyboard service state changes
    this.keyboardService.on('state-change', async () => {
      await this.updateTrayState();
      await this.updateContextMenu();
    });
  }

  private async updateContextMenu() {
    if (!this.tray) return;

    const state = await this.keyboardService?.getState();
    const { settings } = this.store.getState();
    const hyperKey = await this.store.getFeature('hyperKey');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'HyperCaps',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Enable HyperKey',
        type: 'checkbox',
        checked: hyperKey?.config.isHyperKeyEnabled || false,
        accelerator: 'CommandOrControl+Shift+H',
        click: async (menuItem) => {
          // Update store
          await this.store.update((draft) => {
            const feature = draft.features.find((f) => f.name === 'hyperKey');
            if (feature) {
              feature.config.isHyperKeyEnabled = menuItem.checked;
            }
          });

          // Get updated config and restart service
          const updatedHyperKey = await this.store.getFeature('hyperKey');
          if (updatedHyperKey) {
            await this.keyboardService?.restartWithConfig(
              updatedHyperKey.config
            );
          }
        },
      },
      {
        label: 'Start HyperKey with App',
        type: 'checkbox',
        checked: hyperKey?.enableFeatureOnStartup || false,
        click: async (menuItem) => {
          await this.store.update((draft) => {
            const feature = draft.features.find((f) => f.name === 'hyperKey');
            if (feature) {
              feature.enableFeatureOnStartup = menuItem.checked;
            }
          });
        },
      },
      {
        label: 'Block CapsLock Toggle',
        type: 'checkbox',
        checked: hyperKey?.config.capsLockBehavior === 'BlockToggle',
        click: async (menuItem) => {
          // Update store
          await this.store.update((draft) => {
            const feature = draft.features.find((f) => f.name === 'hyperKey');
            if (feature) {
              feature.config.capsLockBehavior = menuItem.checked
                ? 'BlockToggle'
                : 'AllowToggle';
            }
          });

          // Get updated config and restart service
          const updatedHyperKey = await this.store.getFeature('hyperKey');
          if (updatedHyperKey) {
            await this.keyboardService?.restartWithConfig(
              updatedHyperKey.config
            );
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Settings',
        submenu: [
          {
            label: 'Start with Windows',
            type: 'checkbox',
            checked: settings?.startupOnBoot || false,
            click: async (menuItem) => {
              await this.store.update((draft) => {
                if (!draft.settings) draft.settings = {};
                draft.settings.startupOnBoot = menuItem.checked;
              });
            },
          },
          {
            label: 'Start Minimized',
            type: 'checkbox',
            checked: settings?.startMinimized || false,
            click: async (menuItem) => {
              await this.store.update((draft) => {
                if (!draft.settings) draft.settings = {};
                draft.settings.startMinimized = menuItem.checked;
              });
            },
          },
        ],
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        accelerator: 'CommandOrControl+Shift+S',
        click: () => {
          this.mainWindow.show();
          this.mainWindow.focus();
        },
      },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => {
          // Set the quitting flag to prevent the window from being hidden
          this.mainWindow.webContents.send('app-quitting');
          (this.mainWindow as any).isQuitting = true;
          this.dispose();
          // Force quit the application
          require('electron').app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public dispose() {
    globalShortcut.unregister('CommandOrControl+Shift+S');
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
