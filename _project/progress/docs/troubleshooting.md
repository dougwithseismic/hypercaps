# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with HyperCaps.

## Diagnostic Tools

### Debug Mode

Enable detailed logging:

1. Right-click tray icon
2. Select "Enable Debug Mode"
3. Reproduce the issue
4. Check logs in `%APPDATA%\HyperCaps\logs`

### System Information

Run diagnostics:

```powershell
hypercaps --diagnose
```

## Common Issues

### Installation Problems

#### Error: "Installation Failed"

**Symptoms:**

- Installation process fails
- Error message about permissions
- Windows Defender warning

**Solutions:**

1. Run installer as administrator
2. Temporarily disable antivirus
3. Check Windows Event Viewer for details
4. Verify system requirements

#### Error: "Missing Dependencies"

**Symptoms:**

- Installation fails with dependency error
- Missing DLL messages

**Solutions:**

1. Install latest Visual C++ Redistributable
2. Update Windows
3. Run Windows System File Checker:

   ```powershell
   sfc /scannow
   ```

### Startup Issues

#### HyperCaps Won't Start

**Symptoms:**

- No tray icon appears
- Application crashes on startup
- Error about another instance running

**Solutions:**

1. Check Task Manager:
   - End any existing HyperCaps processes
   - Look for error status

2. Clear application data:

   ```powershell
   Remove-Item "$env:APPDATA\HyperCaps\*" -Recurse
   ```

3. Verify Windows startup entry:

   ```powershell
   Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" | Select HyperCaps
   ```

#### Tray Icon Missing

**Symptoms:**

- Application running but no tray icon
- Can't access settings

**Solutions:**

1. Restart Windows Explorer:

   ```powershell
   Stop-Process -Name explorer -Force
   ```

2. Check tray icon settings in Windows
3. Reinstall application

### Key Mapping Issues

#### Keys Not Responding

**Symptoms:**

- Mapped keys don't work
- Inconsistent behavior
- Delays in response

**Solutions:**

1. Check if HyperCaps is enabled:
   - Look for tray icon status
   - Verify Gaming Mode is off

2. Reset key mappings:

   ```powershell
   hypercaps --reset-mappings
   ```

3. Check for conflicts:
   - Other keyboard software
   - Windows shortcuts
   - Application shortcuts

#### CapsLock Behavior Issues

**Symptoms:**

- CapsLock not working as expected
- Double-press not registering
- Stuck in CapsLock state

**Solutions:**

1. Reset CapsLock settings:

   ```powershell
   hypercaps --reset-capslock
   ```

2. Check Windows keyboard settings
3. Test with different CapsLock modes

### Performance Issues

#### High CPU Usage

**Symptoms:**

- High processor utilization
- System slowdown
- Fan noise increase

**Solutions:**

1. Check process priority:

   ```powershell
   Get-Process hypercaps | Select-Object ProcessName, CPU, Priority
   ```

2. Update to latest version
3. Disable unused features
4. Check for conflicting software

#### Memory Leaks

**Symptoms:**

- Increasing memory usage
- Performance degradation over time
- System slowdown

**Solutions:**

1. Monitor memory usage:

   ```powershell
   Get-Process hypercaps | Select-Object ProcessName, WorkingSet
   ```

2. Restart application regularly
3. Update to latest version
4. Clear application cache

### Gaming Mode Issues

#### Game Detection Problems

**Symptoms:**

- HyperCaps remains active in games
- Interference with game controls
- Inconsistent behavior

**Solutions:**

1. Manually add game to exclusion list:

   ```json
   {
     "gameExclusions": [
       "game.exe",
       "launcher.exe"
     ]
   }
   ```

2. Force Gaming Mode:
   - Use Win + Shift + G
   - Configure in settings

### Profile System Issues

#### Profile Not Loading

**Symptoms:**

- Settings not applying
- Wrong profile active
- Profile switching fails

**Solutions:**

1. Verify profile integrity:

   ```powershell
   hypercaps --verify-profile "profile-name"
   ```

2. Reset profile system:

   ```powershell
   hypercaps --reset-profiles
   ```

3. Check profile permissions

## Advanced Troubleshooting

### Log Analysis

Check specific log sections:

```powershell
Get-Content "$env:APPDATA\HyperCaps\logs\hypercaps.log" | Select-String "ERROR"
```

### Registry Cleanup

Reset registry entries:

```powershell
Remove-Item "HKCU:\Software\HyperCaps" -Recurse
```

### Clean Installation

1. Uninstall HyperCaps
2. Remove all data:

   ```powershell
   Remove-Item "$env:APPDATA\HyperCaps" -Recurse
   Remove-Item "$env:LOCALAPPDATA\HyperCaps" -Recurse
   ```

3. Clean registry
4. Reinstall application

## Getting Help

If issues persist:

1. Generate diagnostic report:

   ```powershell
   hypercaps --diagnostic-report
   ```

2. Join our [Discord](https://discord.gg/hypercaps)
3. Open an [issue on GitHub](https://github.com/withseismic/hypercaps/issues)
4. Check [FAQ](./faq.md) for known issues
