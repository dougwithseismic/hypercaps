/**
 * Keyboard Service
 *
 * Coordinates between real-time keyboard events and persistent configuration.
 * Uses both MessageQueue (for real-time events) and Store (for configuration).
 *
 * Architecture:
 * - MessageQueue: Handles real-time keyboard events and state updates
 * - Store: Manages feature configuration and persistent settings
 *
 * Data Flow:
 * 1. PowerShell script sends keyboard events
 * 2. Events are queued via MessageQueue for ordered processing
 * 3. Configuration changes are persisted via Store
 * 4. State updates are propagated to renderer via MessageQueue
 */

import { BrowserWindow, dialog, app } from "electron";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import path from "path";
import { Store } from "@electron/services/store";
import { MessageQueue } from "@electron/services/queue";
import { ipc } from "@electron/services/ipc";
import { HyperKeyFeatureConfig } from "./types/hyperkey-feature";
import { KeyboardService as KeyboardServiceType } from "./types/keyboard-ipc";

interface KeyboardState {
  pressedKeys: string[];
  timestamp: number;
}

interface ServiceState {
  isListening: boolean;
  isLoading: boolean;
  isStarting: boolean;
  isHyperKeyEnabled: boolean;
  error?: string;
  lastError?: {
    message: string;
    timestamp: number;
  };
}

export class KeyboardService extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private keyboardProcess: ChildProcess | null = null;
  private store: Store;
  private queue: MessageQueue;
  private startupTimeout: NodeJS.Timeout | null = null;
  private state: ServiceState = {
    isListening: false,
    isLoading: false,
    isStarting: false,
    isHyperKeyEnabled: false,
  };

  constructor() {
    super();
    this.store = Store.getInstance();
    this.queue = MessageQueue.getInstance();
    this.setupQueueHandlers();
    this.setupIPCHandlers();
  }

  /**
   * Set up IPC service handlers
   */
  private setupIPCHandlers(): void {
    // Register keyboard service
    ipc.registerService({
      id: "keyboard",
      priority: 1, // High priority for keyboard events
    });

    // Register command handlers
    ipc.registerHandler("keyboard", "start", async () => {
      await this.startListening();
      return this.getState();
    });

    ipc.registerHandler("keyboard", "stop", async () => {
      await this.stopListening();
      return this.getState();
    });

    ipc.registerHandler(
      "keyboard",
      "restart",
      async (params: KeyboardServiceType["commands"]["restart"]) => {
        await this.restartWithConfig(params.config);
        return this.getState();
      }
    );

    ipc.registerHandler("keyboard", "getState", async () => {
      return this.getState();
    });
  }

  private setupQueueHandlers(): void {
    this.queue.registerHandler("setState", async (message) => {
      console.log("[KeyboardService] Handling setState:", message.payload);
      const updates = message.payload as Partial<ServiceState>;
      this.state = { ...this.state, ...updates };
      this.mainWindow?.webContents.send("keyboard-service-state", {
        ...this.state,
        isRunning: this.isRunning(),
      });
      console.log("[KeyboardService] Emitting state changed event:", {
        ...this.state,
        isRunning: this.isRunning(),
      });
      ipc.emit({
        service: "keyboard",
        event: "stateChanged",
        data: {
          ...this.state,
          isRunning: this.isRunning(),
        },
      });
      this.emit("state-change", this.state);
    });

    this.queue.registerHandler("keyboardEvent", async (message) => {
      console.log(
        "[KeyboardService] Handling keyboard event:",
        message.payload
      );
      this.mainWindow?.webContents.send("keyboard-event", message.payload);
      console.log(
        "[KeyboardService] Emitting keyPressed event:",
        message.payload
      );
      ipc.emit({
        service: "keyboard",
        event: "keyPressed",
        data: message.payload,
      });
    });

    this.queue.on("message:failed", (message) => {
      console.error(`[KeyboardService] Message failed:`, message);
      if (message.type === "setState") {
        dialog.showErrorBox(
          "Keyboard Service Error",
          `Failed to update service state: ${message.error?.message}`
        );
      }
    });
  }

  private setState(updates: Partial<ServiceState>): void {
    this.queue.enqueue("setState", updates, 1);
  }

  private getScriptPath(): string {
    const scriptName = "keyboard-monitor.ps1";
    const scriptSubPath = path.join(
      "electron",
      "features",
      "hyperkeys",
      "scripts",
      scriptName
    );

    return process.env.NODE_ENV === "development"
      ? path.join(app.getAppPath(), scriptSubPath)
      : path.join(process.resourcesPath, scriptSubPath);
  }

  public async getState(): Promise<ServiceState> {
    const hyperKey = await this.store.getFeature("hyperKey");
    return {
      ...this.state,
      isHyperKeyEnabled: hyperKey?.config.isHyperKeyEnabled ?? false,
    };
  }

  public async init(): Promise<void> {
    await this.store.load();

    // Get HyperKey feature state
    const hyperKey = await this.store.getFeature("hyperKey");
    console.log("[KeyboardService] HyperKey feature state:", hyperKey);

    if (!hyperKey) {
      this.setState({
        error: "HyperKey feature not found",
        lastError: {
          message: "HyperKey feature not found",
          timestamp: Date.now(),
        },
      });
      throw new Error("HyperKey feature not found");
    }

    // Send initial state to renderer
    this.mainWindow?.webContents.send("hyperkey-state", {
      ...hyperKey.config,
      enabled: hyperKey.isFeatureEnabled,
    });

    // Auto-start if feature is enabled
    if (hyperKey.isFeatureEnabled) {
      await this.startListening();
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private async notifyStateUpdate(): Promise<void> {
    const hyperKeyFeature = await this.store.getFeature("hyperKey");
    if (hyperKeyFeature) {
      this.mainWindow?.webContents.send("hyperkey-state", {
        ...hyperKeyFeature.config,
        enabled: hyperKeyFeature.isFeatureEnabled,
      });
    }
  }

  public async startListening(): Promise<void> {
    console.log("[KeyboardService] startListening() called");

    if (this.keyboardProcess) {
      console.log("[KeyboardService] Process already running");
      return;
    }

    const hyperKey = await this.store.getFeature("hyperKey");
    if (!hyperKey?.isFeatureEnabled) {
      console.log("[KeyboardService] Feature is disabled, not starting");
      return;
    }

    if (this.state.isStarting) {
      console.log("[KeyboardService] Process already starting, waiting...");
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.state.isStarting) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      if (this.keyboardProcess) return;
    }

    this.setState({
      isLoading: true,
      isStarting: true,
      error: undefined,
      lastError: undefined,
      isListening: false,
    });

    try {
      const scriptPath = this.getScriptPath();
      const hyperKey = await this.store.getFeature("hyperKey");

      if (!hyperKey) {
        throw new Error("HyperKey feature not found");
      }

      const config = {
        isEnabled: hyperKey.isFeatureEnabled,
        isHyperKeyEnabled: hyperKey.config.isHyperKeyEnabled,
        trigger: hyperKey.config.trigger,
        modifiers: hyperKey.config.modifiers || [],
        capsLockBehavior: hyperKey.config.capsLockBehavior || "BlockToggle",
      };

      const command = [
        // Enable debug output and set error preferences
        "$ProgressPreference = 'SilentlyContinue';",
        "$ErrorActionPreference = 'Stop';",
        "Write-Host '[DEBUG] Starting keyboard monitor...';",

        // Set up config
        "$Config = @{",
        `  isEnabled=$${config.isEnabled.toString().toLowerCase()};`,
        `  isHyperKeyEnabled=$${config.isHyperKeyEnabled.toString().toLowerCase()};`,
        `  trigger='${config.trigger}';`,
        `  modifiers=@(${config.modifiers.map((m) => `'${m}'`).join(",") || "@()"});`,
        `  capsLockBehavior='${config.capsLockBehavior}';`,
        "};",

        // Debug output config
        "Write-Host '[DEBUG] Config:' ($Config | ConvertTo-Json -Depth 10);",

        // Execute script with proper error handling
        "try {",
        `  Set-Location '${path.dirname(scriptPath)}';`,
        `  . '${scriptPath}';`,
        "} catch {",
        "  Write-Error $_.Exception.Message;",
        "  Write-Error $_.ScriptStackTrace;",
        "  exit 1;",
        "}",
      ].join(" ");

      console.log("[KeyboardService] command", command);
      console.log("[KeyboardService] Spawning process with command:", command);
      console.log("[KeyboardService] Script path:", scriptPath);
      console.log("[KeyboardService] Process env:", process.env.NODE_ENV);

      // Verify script exists
      const fs = require("fs");
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Script not found at path: ${scriptPath}`);
      }
      console.log("[KeyboardService] Script exists at path");

      this.keyboardProcess = spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        command,
      ]);

      // Check if process started successfully
      if (!this.keyboardProcess.pid) {
        throw new Error("Failed to start PowerShell process");
      }
      console.log(
        "[KeyboardService] Process started with PID:",
        this.keyboardProcess.pid
      );

      await this.setupProcessListeners();

      // Update store on successful start
      await this.store.update((draft) => {
        const feature = draft.features.find((f) => f.name === "hyperKey");
        if (feature) {
          feature.isFeatureEnabled = true;
        }
      });

      this.setState({
        isListening: true,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during startup";
      this.setState({
        isStarting: false,
        error: errorMessage,
        lastError: {
          message: errorMessage,
          timestamp: Date.now(),
        },
      });
      this.handleStartupFailure(errorMessage);
    }
  }

  private async setupProcessListeners(): Promise<void> {
    if (!this.keyboardProcess) {
      console.log("[KeyboardService] Process not found, returning early");
      return;
    }

    console.log("[KeyboardService] Setting up process listeners");

    return new Promise((resolve, reject) => {
      let hasReceivedInitialData = false;
      const cleanup = () => {
        console.log("[KeyboardService] Cleaning up listeners");
        if (this.keyboardProcess) {
          this.keyboardProcess.stdout?.removeAllListeners();
          this.keyboardProcess.stderr?.removeAllListeners();
          this.keyboardProcess.removeAllListeners();
        }
      };

      // Handle process errors
      this.keyboardProcess.on("error", (error) => {
        console.error("[KeyboardService] Process error:", error);
        cleanup();
        reject(error);
      });

      // Handle stdout data
      this.keyboardProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        console.log("[KeyboardService] Raw stdout:", output);

        if (!hasReceivedInitialData) {
          console.log("[KeyboardService] Received initial data");
          hasReceivedInitialData = true;
          this.clearStartupState();
          resolve();
        }

        this.handleKeyboardOutput(data);
      });

      // Handle stderr data
      this.keyboardProcess.stderr?.on("data", (data) => {
        const error = data.toString();
        console.error("[KeyboardService] stderr:", error);
        if (!hasReceivedInitialData) {
          cleanup();
          reject(new Error(error));
        }
      });

      // Handle process exit
      this.keyboardProcess.on("close", (code, signal) => {
        console.log(
          "[KeyboardService] Process closed with code:",
          code,
          "signal:",
          signal
        );
        cleanup();
        this.keyboardProcess = null;

        // Update state to reflect process termination
        this.setState({
          isListening: false,
          isLoading: false,
          error: code !== 0 ? `Process exited with code ${code}` : undefined,
        });

        if (!hasReceivedInitialData) {
          reject(
            new Error(`Process exited with code ${code} before sending data`)
          );
        }
      });

      // Set timeout for initial data
      const timeout = setTimeout(() => {
        if (!hasReceivedInitialData) {
          console.error("[KeyboardService] Timeout waiting for initial data");
          cleanup();
          reject(new Error("Timeout waiting for initial data"));
        }
      }, 5000);

      // Cleanup timeout on success or failure
      Promise.race([
        new Promise((_, timeoutReject) => {
          timeout.unref(); // Don't let timeout prevent process exit
        }),
        new Promise<void>((successResolve) => {
          const checkInterval = setInterval(() => {
            if (hasReceivedInitialData) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              successResolve();
            }
          }, 100);
        }),
      ]).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private clearStartupState(): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }
    this.setState({
      isLoading: false,
      isStarting: false,
    });
  }

  private handleStartupFailure(message: string): void {
    this.clearStartupState();
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    this.setState({
      isListening: false,
      error: message,
      lastError: {
        message,
        timestamp: Date.now(),
      },
    });
    dialog.showErrorBox(
      "Keyboard Monitor Error",
      `Failed to start keyboard monitor: ${message}`
    );
  }

  public async stopListening(): Promise<void> {
    console.log("[KeyboardService] stopListening() called");

    if (this.keyboardProcess) {
      console.log("[KeyboardService] Cleaning up process");
      this.keyboardProcess.stdout?.removeAllListeners();
      this.keyboardProcess.stderr?.removeAllListeners();
      this.keyboardProcess.removeAllListeners();
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }

    this.setState({
      isListening: false,
      isLoading: false,
      error: undefined,
    });

    console.log("[KeyboardService] Service stopped");
  }

  private handleKeyboardOutput = (data: Buffer) => {
    try {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("[DEBUG]")) {
          console.log(trimmed);
          continue;
        }

        try {
          const state = JSON.parse(trimmed);
          console.log("[KeyboardService] Parsed keyboard state:", state);

          const keyboardState: KeyboardState = {
            pressedKeys: Array.isArray(state.pressedKeys)
              ? state.pressedKeys
              : [],
            timestamp: Date.now(),
          };

          console.log(
            "[KeyboardService] Enqueueing keyboard event:",
            keyboardState
          );
          // Queue keyboard events instead of sending directly
          this.queue.enqueue("keyboardEvent", keyboardState);
        } catch (parseError) {
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            console.error("Error parsing keyboard state:", parseError);
          }
        }
      }
    } catch (error) {
      console.error("Error handling keyboard output:", error);
    }
  };

  public async restartWithConfig(config: HyperKeyFeatureConfig): Promise<void> {
    await this.store.update((draft) => {
      const feature = draft.features.find((f) => f.name === "hyperKey");
      if (feature) {
        feature.config = config;
      }
    });

    // Emit config change event
    this.mainWindow?.webContents.send("ipc:event", {
      service: "hyperKey",
      event: "configChanged",
      data: config,
    });

    await this.stopListening();
    await this.startListening();
  }

  public isRunning(): boolean {
    return this.keyboardProcess !== null;
  }

  public dispose(): void {
    this.stopListening();
    this.mainWindow = null;
  }
}
