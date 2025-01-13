import {
  Tray,
  Menu,
  nativeImage,
  BrowserWindow,
  dialog,
  globalShortcut,
} from "electron";
import path from "path";
import { Store } from "../services/store";
import { KeyboardService } from "./hyperkeys/keyboard-service";

export class TrayFeature {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private keyboardService: KeyboardService | null = null;

  constructor(mainWindow: BrowserWindow, keyboardService: KeyboardService) {
    this.mainWindow = mainWindow;
    this.keyboardService = keyboardService;
  }

  async initialize(): Promise<void> {
    const icon = nativeImage
      .createFromPath(path.join(__dirname, "../../src/assets/tray-icon.png"))
      .resize({ width: 16, height: 16 });

    this.tray = new Tray(icon);
    this.tray.setToolTip("HyperCaps - Keyboard Remapping Tool");

    await this.setupTrayMenu();
    this.registerGlobalShortcuts();
    this.setupEventListeners();
  }

  private async setupTrayMenu(): Promise<void> {
    if (!this.tray) return;

    const store = Store.getInstance();
    const isEnabled = (await store.getFeature("hyperKey")).isFeatureEnabled;
    const { startupOnBoot, enableOnStartup } = store.getState();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "HyperCaps",
        enabled: false,
        icon: nativeImage
          .createFromPath(
            path.join(__dirname, "../../src/assets/tray-icon.png")
          )
          .resize({ width: 16, height: 16 }),
      },
      { type: "separator" },
      {
        label: "Enable HyperCaps",
        type: "checkbox",
        checked: isEnabled,
        accelerator: "CommandOrControl+Shift+E",
        click: async (menuItem) => {
          console.log("[Tray] Toggle HyperCaps:", menuItem.checked);

          const prevState = this.keyboardService?.getState();
          console.log("[Tray] Previous state:", prevState);

          try {
            if (menuItem.checked) {
              await this.keyboardService?.startListening();
            } else {
              await this.keyboardService?.stopListening();
            }

            const newState = this.keyboardService?.getState();
            console.log("[Tray] New state:", newState);

            // Update store to persist the state
            await store.update((draft) => {
              const feature = draft.features.find((f) => f.name === "hyperKey");
              if (feature) {
                feature.isFeatureEnabled = menuItem.checked;
              }
            });

            // Double check our state is in sync
            const finalState = this.keyboardService?.getState();
            console.log("[Tray] Final state check:", {
              menuChecked: menuItem.checked,
              serviceState: finalState,
              processRunning: this.keyboardService?.isRunning(),
            });
          } catch (error) {
            console.error("[Tray] Error toggling service:", error);
            // Revert checkbox if operation failed
            menuItem.checked = !menuItem.checked;
            dialog.showErrorBox(
              "HyperCaps Error",
              `Failed to ${menuItem.checked ? "enable" : "disable"} HyperCaps: ${error.message}`
            );
          }
        },
      },
      { type: "separator" },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: startupOnBoot,
        click: async (menuItem) => {
          await store.setStartupOnBoot(menuItem.checked);
        },
      },
      {
        label: "Enable on Startup",
        type: "checkbox",
        checked: enableOnStartup,
        click: async (menuItem) => {
          await store.update((draft) => {
            const hyperkeyFeature = draft.features.find(
              (f) => f.name == "hyperKey"
            );
            if (hyperkeyFeature) {
              hyperkeyFeature.isFeatureEnabled = menuItem.checked;
            }
          });
        },
      },
      { type: "separator" },
      {
        label: "Open Shortcut Manager",
        accelerator: "CommandOrControl+Shift+S",
        click: () => {
          this.showWindow();
        },
      },
      { type: "separator" },
      {
        label: "About HyperCaps",
        click: () => {
          dialog.showMessageBox({
            type: "info",
            title: "About HyperCaps",
            message: "HyperCaps - Advanced Keyboard Remapping Tool",
            detail: "Version 0.0.1\nCreated for Windows power users.",
          });
        },
      },
      { type: "separator" },
      {
        label: "Quit HyperCaps",
        accelerator: "CommandOrControl+Q",
        click: () => {
          this.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private registerGlobalShortcuts(): void {
    const ret = globalShortcut.register("CommandOrControl+Shift+S", () => {
      this.showWindow();
    });

    if (!ret) {
      console.error("Failed to register global shortcut");
    }
  }

  private setupEventListeners(): void {
    if (!this.tray) return;

    this.tray.on("double-click", () => {
      this.showWindow();
    });
  }

  private showWindow(): void {
    this.mainWindow?.show();
    this.mainWindow?.focus();
  }

  private quit(): void {
    if (this.mainWindow) {
      (this.mainWindow as any).isQuitting = true;
    }
    require("electron").app.quit();
  }

  dispose(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
