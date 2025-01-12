import { BrowserWindow, dialog } from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { Store } from "./store";
import { HyperKeyConfig } from "./types";

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

    // If already running, just return
    if (this.keyboardProcess) {
      console.log("[KeyboardService] Process already running, returning early");
      return;
    }

    // If starting, wait for it to complete or fail
    if (this.isStarting) {
      console.log("[KeyboardService] Process already starting, waiting...");
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isStarting) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
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
      // Kill any existing process first
      if (this.keyboardProcess) {
        this.keyboardProcess.kill();
        this.keyboardProcess = null;
      }

      // Get hyperkey config
      const hyperKeyConfig = await this.store.getHyperKeyConfig();
      if (!hyperKeyConfig) {
        throw new Error("Failed to get hyperkey config");
      }

      // Convert trigger to proper case for Windows.Forms.Keys enum
      const config = {
        ...hyperKeyConfig,
        trigger: hyperKeyConfig.trigger.toUpperCase(),
      };

      // Create PowerShell command that sets config and runs script
      const command = [
        // First set the config
        "$Config = @{",
        `enabled=[bool]$${config.enabled.toString().toLowerCase()};`,
        `trigger='${config.trigger}';`,
        "modifiers=@{",
        `ctrl=[bool]$${config.modifiers.ctrl?.toString().toLowerCase()};`,
        `alt=[bool]$${config.modifiers.alt?.toString().toLowerCase()};`,
        `shift=[bool]$${config.modifiers.shift?.toString().toLowerCase()};`,
        `win=[bool]$${config.modifiers.win?.toString().toLowerCase()}`,
        "}};",
        // Log the config for debugging
        "Write-Host 'Config:' $($Config | ConvertTo-Json);",
        // Then run the script
        `& {`,
        `  Set-Location '${path.dirname(scriptPath)}';`, // Ensure we're in the right directory
        `  . '${scriptPath}'`, // Source the script instead of running it
        `}`,
      ].join(" ");

      console.log(
        "[KeyboardService] Spawning PowerShell process with config:",
        config,
        "\nCommand:",
        command
      );

      this.keyboardProcess = spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        command,
      ]);

      console.log("[KeyboardService] Setting startup timeout");
      this.startupTimeout = setTimeout(() => {
        if (this.isStarting) {
          console.warn("[KeyboardService] Startup timeout reached (5s)");
          this.handleStartupFailure(
            "Keyboard monitor failed to start within timeout"
          );
        }
      }, 5000); // Reduced timeout to 5s

      console.log("[KeyboardService] Creating startup promise");
      const startupPromise = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          if (this.keyboardProcess) {
            this.keyboardProcess.stdout?.removeAllListeners();
            this.keyboardProcess.stderr?.removeAllListeners();
            this.keyboardProcess.removeAllListeners();
          }
        };

        const onFirstData = (data: Buffer) => {
          console.log(
            "[KeyboardService] Received first data:",
            data.toString().trim()
          );
          cleanup();
          this.clearStartupState();
          this.handleKeyboardOutput(data);
          resolve();
        };

        const onStartupError = (error: Buffer) => {
          console.error("[KeyboardService] Startup error:", error.toString());
          cleanup();
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
          cleanup();
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
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines
        if (!trimmed) continue;

        // If line starts with '[' or '{', treat as JSON
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const state = JSON.parse(trimmed);
          this.mainWindow?.webContents.send("keyboard-event", {
            ctrlKey: Boolean(state.ctrl),
            altKey: Boolean(state.alt),
            shiftKey: Boolean(state.shift),
            metaKey: Boolean(state.win),
            capsLock: Boolean(state.caps),
            pressedKeys: Array.isArray(state.pressedKeys)
              ? state.pressedKeys
              : [],
            timestamp: Date.now(),
          });
        } else {
          // Log other lines as debug output
          console.log("[PowerShell]", trimmed);
        }
      }
    } catch (error) {
      // Only log parsing errors for lines that look like JSON
      if (error instanceof SyntaxError) {
        console.debug("Skipping non-JSON output");
      } else {
        console.error("Error handling keyboard output:", error);
      }
    }
  };

  public dispose(): void {
    this.stopListening();
    this.mainWindow = null;
  }

  public async restartWithConfig(config: HyperKeyConfig): Promise<void> {
    await this.store.setHyperKeyConfig(config);
    await this.stopListening();
    await this.startListening();
  }
}
