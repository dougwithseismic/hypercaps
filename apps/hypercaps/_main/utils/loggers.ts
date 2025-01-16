import { app } from 'electron';

/**
 * Logs environment information and application startup details
 */
const logEnvironmentInfo = () => {
  console.log('=== Environment Debug ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isDev:', process.env.NODE_ENV === 'development');
  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);
  console.log('Electron Version:', process.versions.electron);
  console.log('Chrome Version:', process.versions.chrome);
  console.log('Node Version:', process.versions.node);
  console.log('======================');
};

/**
 * Logs application startup information
 */
const logStartupInfo = () => {
  console.log('=== Application Startup ===');
  console.log('App Path:', app.getAppPath());
  console.log('User Data Path:', app.getPath('userData'));
  console.log('Temp Path:', app.getPath('temp'));
  console.log('======================');
};

export { logEnvironmentInfo, logStartupInfo };
