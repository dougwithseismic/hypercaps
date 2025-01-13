import { BrowserWindow, dialog } from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { Store } from "./store";
import { HyperKeyConfig, KeyMapping } from "./types";

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
    const hyperKeyConfig = await this.store.getHyperKeyConfig();

    // Update hyperkey config to match service state
    if (hyperKeyConfig.enabled !== isEnabled) {
      await this.store.setHyperKeyConfig({
        ...hyperKeyConfig,
        enabled: isEnabled,
      });
    }

    // Send both states to the renderer
    this.mainWindow?.webContents.send("keyboard-service-state", isEnabled);
    this.mainWindow?.webContents.send("hyperkey-state", {
      ...hyperKeyConfig,
      enabled: isEnabled,
    });

    console.log("[KeyboardService] isEnabled:", isEnabled);
    // Only start if service is enabled
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

      // Get hyperkey config - store is already loaded in init()
      const hyperKeyConfig = await this.store.getHyperKeyConfig();
      if (!hyperKeyConfig) {
        throw new Error("Failed to get hyperkey config");
      }

      console.log("[KeyboardService] Got hyperkey config:", hyperKeyConfig);

      // Convert trigger to proper case for Windows.Forms.Keys enum
      const config = {
        ...hyperKeyConfig,
        trigger: hyperKeyConfig.trigger,
        // Ensure modifiers is always an array
        modifiers: Array.isArray(hyperKeyConfig.modifiers)
          ? hyperKeyConfig.modifiers
          : [],
      };

      console.log("[KeyboardService] Processed config:", config);

      // Create PowerShell command that sets config and runs script
      const command = [
        // First set the config
        "$Config = @{",
        `enabled=$${config.enabled.toString().toLowerCase()};`,
        `trigger='${config.trigger}';`,
        // Always create a PowerShell array, even if empty
        `modifiers=@(${config.modifiers.map((m) => `'${m}'`).join(",") || "@()"});`,
        `capsLockBehavior='${config.capsLockBehavior || "BlockToggle"}';`,
        "};",
        // Log the config for debugging
        "Write-Host 'Config:' $($Config | ConvertTo-Json -Depth 10);",
        // Then run the script
        `& {`,
        `  Set-Location '${path.dirname(scriptPath)}';`,
        `  . '${scriptPath}'`,
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

  private async executeCommand(command: string): Promise<void> {
    try {
      const { exec } = require("child_process");
      exec(command, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`[KeyboardService] Command execution error: ${error}`);
          return;
        }
        if (stderr) {
          console.error(`[KeyboardService] Command stderr: ${stderr}`);
        }
        if (stdout) {
          console.log(`[KeyboardService] Command output: ${stdout}`);
        }
      });
    } catch (error) {
      console.error("[KeyboardService] Failed to execute command:", error);
    }
  }

  private async executeMapping(mapping: KeyMapping): Promise<void> {
    try {
      // Update metadata
      const now = Date.now();
      await this.store.updateMapping(mapping.id, {
        metadata: {
          ...mapping.metadata,
          lastUsed: now,
          useCount: (mapping.metadata?.useCount || 0) + 1,
        },
      });

      // Execute based on action type
      switch (mapping.actionType) {
        case "command": {
          const { exec } = require("child_process");
          const options: any = {
            ...(mapping.options?.workingDirectory && {
              cwd: mapping.options.workingDirectory,
            }),
            ...(mapping.options?.shell && { shell: mapping.options.shell }),
          };

          // For admin commands on Windows, prefix with runas
          const cmd = mapping.options?.runAsAdmin
            ? `powershell.exe Start-Process -Verb RunAs "${mapping.action}"`
            : mapping.action;

          if (mapping.options?.async) {
            exec(cmd, options);
          } else {
            await new Promise((resolve, reject) => {
              exec(
                cmd,
                options,
                (error: Error | null, stdout: string, stderr: string) => {
                  if (error) {
                    console.error(
                      `[KeyboardService] Command execution error:`,
                      error
                    );
                    reject(error);
                    return;
                  }
                  if (stderr) {
                    console.error(`[KeyboardService] Command stderr:`, stderr);
                  }
                  if (stdout) {
                    console.log(`[KeyboardService] Command output:`, stdout);
                  }
                  resolve(void 0);
                }
              );
            });
          }
          break;
        }

        case "script": {
          const { execFile } = require("child_process");
          const options: any = {
            ...(mapping.options?.workingDirectory && {
              cwd: mapping.options.workingDirectory,
            }),
          };

          if (mapping.options?.async) {
            execFile(mapping.action, [], options);
          } else {
            await new Promise((resolve, reject) => {
              execFile(
                mapping.action,
                [],
                options,
                (error: Error | null, stdout: string, stderr: string) => {
                  if (error) {
                    console.error(
                      `[KeyboardService] Script execution error:`,
                      error
                    );
                    reject(error);
                    return;
                  }
                  if (stderr) {
                    console.error(`[KeyboardService] Script stderr:`, stderr);
                  }
                  if (stdout) {
                    console.log(`[KeyboardService] Script output:`, stdout);
                  }
                  resolve(void 0);
                }
              );
            });
          }
          break;
        }

        case "shortcut": {
          // For keyboard shortcuts, we'll use @nut-tree/nut-js
          const { keyboard, Key } = require("@nut-tree/nut-js");

          // Parse the shortcut string (e.g. "control+shift+a")
          const keys = mapping.action.toLowerCase().split("+");

          // Press all modifier keys first
          const modifierKeys = keys
            .slice(0, -1)
            .map((key) => {
              switch (key) {
                case "control":
                case "ctrl":
                  return Key.LeftControl;
                case "shift":
                  return Key.LeftShift;
                case "alt":
                  return Key.LeftAlt;
                case "command":
                case "cmd":
                case "win":
                  return Key.LeftWindows;
                default:
                  return null;
              }
            })
            .filter((key) => key !== null);

          // Press the final key
          const finalKey = keys[keys.length - 1].toUpperCase();

          // Press all keys together
          await keyboard.pressKey(...modifierKeys, Key[finalKey]);
          await keyboard.releaseKey(...modifierKeys, Key[finalKey]);
          break;
        }

        default:
          console.error(
            `[KeyboardService] Unknown action type: ${(mapping as any).actionType}`
          );
      }
    } catch (error) {
      console.error("[KeyboardService] Failed to execute mapping:", error);
      dialog.showErrorBox(
        "Shortcut Error",
        `Failed to execute shortcut "${mapping.name}": ${error}`
      );
    }
  }

  private handleKeyboardOutput = (data: Buffer) => {
    try {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines
        if (!trimmed) continue;

        // If line starts with '[DEBUG]', log it
        if (trimmed.startsWith("[DEBUG]")) {
          console.log(trimmed);
          continue;
        }

        // Parse JSON state updates
        try {
          const state = JSON.parse(trimmed);
          console.log("[KeyboardService] Parsed state:", state);

          // Get current pressed keys
          const pressedKeys = Array.isArray(state.pressedKeys)
            ? state.pressedKeys
            : [];

          // Check mappings
          this.store.getMappings().then((mappings) => {
            for (const mapping of mappings) {
              if (!mapping.enabled) continue;

              // Check if all trigger keys are pressed
              const allTriggersPressed = mapping.triggers.every((trigger) =>
                pressedKeys.includes(trigger)
              );

              // If triggers match, execute the mapping
              if (allTriggersPressed) {
                console.log(
                  `[KeyboardService] Executing mapping: ${mapping.name} (${mapping.id})`
                );
                this.executeMapping(mapping);
              }
            }
          });

          // Send keyboard event to renderer
          this.mainWindow?.webContents.send("keyboard-event", {
            pressedKeys,
            timestamp: Date.now(),
          });
        } catch (parseError) {
          // Only log parsing errors for lines that look like JSON
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            console.error("Error parsing keyboard state:", parseError);
          }
        }
      }
    } catch (error) {
      console.error("Error handling keyboard output:", error);
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
