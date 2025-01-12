import { app, IpcMainEvent } from "electron";
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

export class DevTools {
  public static async install(): Promise<void> {
    if (process.env.NODE_ENV === "development") {
      try {
        const name = await installExtension(REACT_DEVELOPER_TOOLS);
        console.log(`[DevTools] Added Extension: ${name}`);
      } catch (err) {
        console.error("[DevTools] An error occurred:", err);
      }
    }
  }

  public static setupDebugListeners(): void {
    if (process.env.NODE_ENV === "development") {
      // Log all IPC messages
      const ipcLogger = (
        _event: IpcMainEvent,
        channel: string,
        ...args: any[]
      ) => {
        console.log(`[IPC] ${channel}`, ...args);
      };

      app.on("browser-window-created", (_, window) => {
        window.webContents.on("ipc-message", ipcLogger);
        window.webContents.on("ipc-message-sync", ipcLogger);
      });

      // Log unhandled errors and rejections
      process.on("uncaughtException", (error) => {
        console.error("[Main Process] Uncaught Exception:", error);
      });

      process.on("unhandledRejection", (reason) => {
        console.error("[Main Process] Unhandled Rejection:", reason);
      });
    }
  }
}
