import { BrowserWindow, dialog } from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { Store } from "./store";

interface KeyMapping {
  id: string;
  sourceKey: string;
  targetModifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
  targetKey?: string;
  command?: string;
  enabled: boolean;
}

export class KeyboardService {
  private mainWindow: BrowserWindow | null = null;
  private keyboardProcess: ChildProcess | null = null;
  private store: Store;

  constructor() {
    this.store = Store.getInstance();
  }

  public async init(): Promise<void> {
    await this.store.load();
    const isEnabled = await this.store.getIsEnabled();
    if (isEnabled) {
      this.mainWindow?.webContents.send("keyboard-service-state", true);
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public startListening(): void {
    if (this.keyboardProcess) {
      return;
    }

    const scriptPath =
      process.env.NODE_ENV === "development"
        ? path.resolve(process.cwd(), "electron/scripts/keyboard-monitor.ps1")
        : path.resolve(__dirname, "../scripts/keyboard-monitor.ps1");

    console.log("Starting keyboard monitor with script:", scriptPath);

    try {
      this.keyboardProcess = spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ]);

      this.keyboardProcess.stdout?.on("data", this.handleKeyboardOutput);
      this.keyboardProcess.stderr?.on("data", (data) => {
        console.error("Keyboard monitor error:", data.toString());
      });

      this.keyboardProcess.on("close", (code) => {
        console.log("Keyboard monitor process exited with code", code);
        this.keyboardProcess = null;
      });

      this.store.setIsEnabled(true);
    } catch (error) {
      dialog.showErrorBox(
        "Keyboard Monitor Error",
        "Failed to start keyboard monitor. Please check if PowerShell is available."
      );
    }
  }

  public stopListening(): void {
    if (this.keyboardProcess) {
      this.keyboardProcess.stdout?.removeAllListeners();
      this.keyboardProcess.stderr?.removeAllListeners();
      this.keyboardProcess.removeAllListeners();

      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    this.store.setIsEnabled(false);
  }

  public async getMappings(): Promise<KeyMapping[]> {
    return this.store.getMappings();
  }

  public async addMapping(
    mapping: Omit<KeyMapping, "id">
  ): Promise<KeyMapping> {
    return this.store.addMapping(mapping);
  }

  public async updateMapping(
    id: string,
    updates: Partial<KeyMapping>
  ): Promise<KeyMapping> {
    return this.store.updateMapping(id, updates);
  }

  public async deleteMapping(id: string): Promise<void> {
    return this.store.deleteMapping(id);
  }

  private handleKeyboardOutput = (data: Buffer) => {
    try {
      const state = JSON.parse(data.toString());
      this.mainWindow?.webContents.send("keyboard-event", {
        ctrlKey: Boolean(state.ctrl),
        altKey: Boolean(state.alt),
        shiftKey: Boolean(state.shift),
        metaKey: Boolean(state.win),
        capsLock: Boolean(state.caps),
        pressedKeys: Array.isArray(state.pressedKeys) ? state.pressedKeys : [],
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Error parsing keyboard state:", error);
    }
  };

  public dispose(): void {
    this.stopListening();
    this.mainWindow = null;
  }
}
