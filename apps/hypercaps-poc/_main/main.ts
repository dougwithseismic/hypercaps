import { app, dialog } from 'electron';
import electronSquirrelStartup from 'electron-squirrel-startup';
import { logEnvironmentInfo, logStartupInfo } from './utils/loggers';
import trayFeature from './features/tray';
import { keyboardService } from './service/keyboard/keyboard-service';
import { mainWindow } from './features/main-window';

logEnvironmentInfo();
logStartupInfo();

// Check platform - exit if not Windows
if (process.platform !== 'win32') {
  dialog.showErrorBox(
    'Unsupported Platform',
    'HyperCaps is only supported on Windows. The application will now exit.'
  );
  app.quit();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

app.whenReady().then(async () => {
  // Initialize services
  await trayFeature.initialize();
  await keyboardService.initialize();
  mainWindow.initialize();
});
