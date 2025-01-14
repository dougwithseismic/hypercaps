# Installation Guide

This guide will help you get HyperCaps up and running on your Windows system.

## System Requirements

- Windows 10 or later
- 64-bit operating system
- Minimal system resources (less than 100MB RAM)
- No additional software dependencies

## Installation Methods

### Using Winget (Recommended)

```bash
winget install hypercaps
```

### Using Scoop

```bash
scoop install hypercaps
```

### Manual Installation

1. Download the latest release from our [GitHub Releases](https://github.com/withseismic/hypercaps/releases) page
2. Run the installer (.exe)
3. Follow the installation wizard prompts

## Post-Installation Setup

1. **First Launch**

   - HyperCaps will start automatically after installation
   - Look for the HyperCaps icon in your system tray
   - Click the icon to open the configuration window

2. **Windows Startup**

   - HyperCaps is configured to start with Windows by default
   - You can disable this in the settings if preferred

3. **Security Permissions**
   - Windows may ask for administrator permissions
   - This is required for keyboard monitoring
   - All code is open source and can be audited

## Verifying Installation

1. Check the system tray for the HyperCaps icon
2. Open HyperCaps and ensure the UI loads properly
3. Try a basic key remapping to test functionality

## Troubleshooting

### Common Issues

1. **Installation Fails**

   - Ensure you have administrator privileges
   - Check Windows Defender or antivirus settings
   - Try running the installer as administrator

2. **HyperCaps Won't Start**

   - Check the Windows Event Viewer for errors
   - Verify Windows Defender isn't blocking execution
   - Try reinstalling with administrator privileges

3. **Key Remapping Not Working**
   - Ensure HyperCaps is running (check system tray)
   - Verify your remapping configuration
   - Check if any other keyboard software is conflicting

### Getting Help

If you encounter any issues:

1. Check our [FAQ](./faq.md)
2. Join our [Discord community](https://discord.gg/hypercaps)
3. [Report an issue](https://github.com/withseismic/hypercaps/issues) on GitHub

## Uninstallation

If you need to remove HyperCaps:

1. **Using Windows Settings**

   - Open Windows Settings
   - Go to Apps & Features
   - Search for "HyperCaps"
   - Click Uninstall

2. **Using Winget**

   ```bash
   winget uninstall hypercaps
   ```

3. **Using Scoop**

   ```bash
   scoop uninstall hypercaps
   ```

All settings and configurations will be removed during uninstallation.

## Next Steps

- Read the [Usage Guide](./usage.md) to learn how to use HyperCaps
- Check out [Advanced Features](./advanced-features.md) for power user tips
- Join our [Discord community](https://discord.gg/hypercaps) for support and updates
