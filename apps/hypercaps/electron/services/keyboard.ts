import { BrowserWindow } from "electron";
import { spawn } from "child_process";
import path from "path";

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
  private keyboardProcess: any = null;
  private mappings: KeyMapping[] = [];
  private nextId: number = 1;

  private generateId(): string {
    return `mapping-${Date.now()}-${this.nextId++}`;
  }

  constructor() {
    // Initialize with default mappings if needed
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  startListening() {
    if (this.keyboardProcess) {
      return;
    }

    const isDev = process.env.NODE_ENV === "development";
    const scriptPath = isDev
      ? path.resolve(process.cwd(), "electron/scripts/keyboard-monitor.ps1")
      : path.resolve(__dirname, "../scripts/keyboard-monitor.ps1");

    console.log("Starting keyboard monitor with script:", scriptPath);

    this.keyboardProcess = spawn("powershell.exe", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ]);

    this.keyboardProcess.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n");
      lines.forEach((line) => {
        try {
          const state = JSON.parse(line);
          this.mainWindow?.webContents.send("keyboard-event", {
            ctrlKey: state.ctrl,
            altKey: state.alt,
            shiftKey: state.shift,
            metaKey: state.win,
            capsLock: state.caps,
            pressedKeys: state.pressedKeys || [],
            timestamp: Date.now(),
          });
        } catch (error) {
          console.error("Error parsing keyboard state:", error);
        }
      });
    });

    this.keyboardProcess.stderr.on("data", (data: Buffer) => {
      console.error("Keyboard monitor error:", data.toString());
    });

    this.keyboardProcess.on("close", (code: number) => {
      console.log("Keyboard monitor process exited with code:", code);
      this.keyboardProcess = null;
    });
  }

  stopListening() {
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
  }

  getMappings(): KeyMapping[] {
    return this.mappings;
  }

  addMapping(mapping: Omit<KeyMapping, "id">): KeyMapping {
    const newMapping = { ...mapping, id: this.generateId() } as KeyMapping;
    this.mappings.push(newMapping);
    return newMapping;
  }

  updateMapping(id: string, updates: Partial<KeyMapping>): KeyMapping | null {
    const index = this.mappings.findIndex((m) => m.id === id);
    if (index === -1) return null;

    this.mappings[index] = { ...this.mappings[index], ...updates };
    return this.mappings[index];
  }

  deleteMapping(id: string): boolean {
    const index = this.mappings.findIndex((m) => m.id === id);
    if (index === -1) return false;

    this.mappings.splice(index, 1);
    return true;
  }

  dispose() {
    this.stopListening();
  }
}
