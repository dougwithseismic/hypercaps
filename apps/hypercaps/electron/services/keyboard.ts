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
  private startupTimeout: NodeJS.Timeout | null = null;
  private isStarting: boolean = false;

  constructor() {
    this.store = Store.getInstance();
  }

  public async init(): Promise<void> {
    await this.store.load();
    const isEnabled = await this.store.getIsEnabled();
    this.mainWindow?.webContents.send("keyboard-service-state", isEnabled);
    if (isEnabled) {
      await this.startListening();
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public async startListening(): Promise<void> {
    console.log("[KeyboardService] startListening() called");
    if (this.keyboardProcess || this.isStarting) {
      console.log(
        "[KeyboardService] Process already running or starting, returning early"
      );
      return;
    }

    this.isStarting = true;
    console.log(
      "[KeyboardService] Setting isStarting flag and sending loading state"
    );
    this.mainWindow?.webContents.send("keyboard-service-loading", true);

    const scriptPath =
      process.env.NODE_ENV === "development"
        ? path.resolve(process.cwd(), "electron/scripts/keyboard-monitor.ps1")
        : path.resolve(__dirname, "../scripts/keyboard-monitor.ps1");

    console.log("[KeyboardService] Using script path:", scriptPath);
    console.log("[KeyboardService] Current environment:", process.env.NODE_ENV);

    try {
      console.log("[KeyboardService] Spawning PowerShell process");
      this.keyboardProcess = spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ]);

      console.log("[KeyboardService] Setting startup timeout");
      this.startupTimeout = setTimeout(() => {
        if (this.isStarting) {
          console.warn(
            "[KeyboardService] Initial startup timeout reached (10s)"
          );
          setTimeout(() => {
            if (this.isStarting) {
              console.error(
                "[KeyboardService] Extended startup timeout reached (15s total)"
              );
              this.handleStartupFailure(
                "Keyboard monitor failed to start within extended timeout"
              );
            }
          }, 5000);
        }
      }, 10000);

      console.log("[KeyboardService] Creating startup promise");
      const startupPromise = new Promise<void>((resolve, reject) => {
        const onFirstData = (data: Buffer) => {
          console.log(
            "[KeyboardService] Received first data:",
            data.toString().trim()
          );
          this.clearStartupState();
          this.handleKeyboardOutput(data);
          resolve();
        };

        const onStartupError = (error: Buffer) => {
          console.error("[KeyboardService] Startup error:", error.toString());
          this.clearStartupState();
          reject(new Error(error.toString()));
        };

        this.keyboardProcess?.stdout?.once("data", onFirstData);
        this.keyboardProcess?.stderr?.once("data", onStartupError);

        this.keyboardProcess?.once("close", (code) => {
          console.log(
            "[KeyboardService] Process closed during startup with code:",
            code
          );
          this.keyboardProcess?.stdout?.removeListener("data", onFirstData);
          this.keyboardProcess?.stderr?.removeListener("data", onStartupError);
          if (this.isStarting) {
            reject(
              new Error(`Process exited with code ${code} during startup`)
            );
          }
        });
      });

      console.log("[KeyboardService] Awaiting startup promise");
      await startupPromise;

      console.log("[KeyboardService] Setting up operation listeners");
      this.keyboardProcess.stdout?.on("data", (data) => {
        console.log("[KeyboardService] Received data:", data.toString().trim());
        this.handleKeyboardOutput(data);
      });

      this.keyboardProcess.stderr?.on("data", (data) => {
        console.error("[KeyboardService] Runtime error:", data.toString());
      });

      this.keyboardProcess.on("close", (code) => {
        console.log("[KeyboardService] Process closed with code:", code);
        this.clearStartupState();
        this.keyboardProcess = null;
        this.mainWindow?.webContents.send("keyboard-service-state", false);
      });

      console.log("[KeyboardService] Updating store and sending success state");
      await this.store.setIsEnabled(true);
      this.mainWindow?.webContents.send("keyboard-service-state", true);
    } catch (error) {
      console.error("[KeyboardService] Startup error:", error);
      this.handleStartupFailure(
        error instanceof Error ? error.message : "Unknown error during startup"
      );
    }
  }

  private clearStartupState(): void {
    this.isStarting = false;
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }
    this.mainWindow?.webContents.send("keyboard-service-loading", false);
  }

  private handleStartupFailure(message: string): void {
    this.clearStartupState();
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    dialog.showErrorBox(
      "Keyboard Monitor Error",
      `Failed to start keyboard monitor: ${message}`
    );
    this.mainWindow?.webContents.send("keyboard-service-state", false);
  }

  public async stopListening(): Promise<void> {
    if (this.keyboardProcess) {
      this.keyboardProcess.stdout?.removeAllListeners();
      this.keyboardProcess.stderr?.removeAllListeners();
      this.keyboardProcess.removeAllListeners();

      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    await this.store.setIsEnabled(false);
    this.mainWindow?.webContents.send("keyboard-service-state", false);
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
