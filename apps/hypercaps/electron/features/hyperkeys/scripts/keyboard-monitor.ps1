# Suppress PowerShell startup banner
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

# Helper function for debug output
function Write-Debug-Message {
    param([string]$Message)
    Write-Host "[DEBUG] $Message"
}

# Validate config
if (-not (Get-Variable -Name Config -ErrorAction SilentlyContinue)) {
    Write-Error "No config variable found"
    exit 1
}

Write-Debug-Message "Starting keyboard monitor with config: $($Config | ConvertTo-Json)"

try {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Diagnostics;
using System.Collections.Generic;
using System.Linq;

public static class KeyboardMonitor {
    public const int WH_KEYBOARD_LL = 13;
    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;

    public static bool IsDebugEnabled = true;

    [StructLayout(LayoutKind.Sequential)]
    public struct KBDLLHOOKSTRUCT {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(Keys vKey);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int KEYEVENTF_KEYDOWN = 0x0000;
    public const int KEYEVENTF_KEYUP = 0x0002;
    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;

    public static bool IsKeyPressed(Keys key) {
        // Check specific keys directly
        return (GetAsyncKeyState(key) & 0x8000) != 0;
    }

    public static bool isHandlingSyntheticCapsLock = false;

    public static void SendKeyDown(Keys key, bool extended = false) {
        if (key == Keys.CapsLock) {
            isHandlingSyntheticCapsLock = true;
        }
        uint flags = (uint)(KEYEVENTF_KEYDOWN | (extended ? KEYEVENTF_EXTENDEDKEY : 0));
        keybd_event((byte)key, 0, flags, UIntPtr.Zero);
    }

    public static void SendKeyUp(Keys key, bool extended = false) {
        uint flags = (uint)(KEYEVENTF_KEYUP | (extended ? KEYEVENTF_EXTENDEDKEY : 0));
        keybd_event((byte)key, 0, flags, UIntPtr.Zero);
        if (key == Keys.CapsLock) {
            isHandlingSyntheticCapsLock = false;
        }
    }

    private static HashSet<Keys> pressedKeys = new HashSet<Keys>();

    // Track last sent state for deduplication
    private static string lastSentState = "";

    // Map Windows Forms Keys to their display names - only special cases
    private static Dictionary<Keys, string> keyDisplayNames = new Dictionary<Keys, string>() {
        { Keys.CapsLock, "CapsLock" }
    };

    public static HashSet<Keys> GetPressedKeys() {
        return pressedKeys;
    }

    public static Dictionary<string, string> GetPressedKeysWithRaw() {
        var result = new Dictionary<string, string>();
        foreach (var key in pressedKeys) {
            result[key.ToString()] = GetKeyDisplayName(key);
        }
        return result;
    }

    public static string GetKeyDisplayName(Keys key) {
        return keyDisplayNames.ContainsKey(key) ? keyDisplayNames[key] : key.ToString();
    }

    public static void AddPressedKey(Keys key) {
        pressedKeys.Add(key);
    }

    public static void RemovePressedKey(Keys key) {
        pressedKeys.Remove(key);
    }

    public enum CapsLockBehavior {
        None,           // Don't do anything special with CapsLock
        DoublePress,    // Current behavior - press CapsLock again to untoggle
        BlockToggle     // Just block the CapsLock toggle completely
    }

    public static bool IsEnabled = false;
    public static bool IsHyperKeyEnabled = false;
    public static Keys HyperKeyTrigger = Keys.CapsLock;
    public static List<Keys> ModifierKeys = new List<Keys>();
    public static CapsLockBehavior CapsLockHandling = CapsLockBehavior.BlockToggle;

    public static void ConfigureHyperKey(bool isEnabled, bool isHyperKeyEnabled, string trigger, string[] modifiers, string capsLockBehavior = "BlockToggle") {
        if (IsDebugEnabled) {
            Console.WriteLine(string.Format("[DEBUG] Configuring HyperKey - Previous State: IsEnabled={0}, IsHyperKeyEnabled={1}", 
                IsEnabled, IsHyperKeyEnabled));
        }

        IsEnabled = isEnabled;
        IsHyperKeyEnabled = isHyperKeyEnabled;
        HyperKeyTrigger = (Keys)Enum.Parse(typeof(Keys), trigger, true);
        CapsLockHandling = (CapsLockBehavior)Enum.Parse(typeof(CapsLockBehavior), capsLockBehavior, true);
        
        ModifierKeys.Clear();
        foreach (var modifier in modifiers) {
            ModifierKeys.Add((Keys)Enum.Parse(typeof(Keys), modifier, true));
        }

        if (IsDebugEnabled) {
            Console.WriteLine(string.Format("[DEBUG] HyperKey Configured - New State: IsEnabled={0}, IsHyperKeyEnabled={1}, Trigger={2}, Modifiers={3}",
                IsEnabled, IsHyperKeyEnabled, HyperKeyTrigger, string.Join(",", ModifierKeys)));
        }
    }

    private static void UpdateState() {
        if (!IsEnabled) {
            pressedKeys.Clear();
            lastSentState = "";
            if (IsDebugEnabled) {
                Console.WriteLine("[DEBUG] Service disabled, cleared state");
            }
            return;
        }

        UpdateModifierState();
    }

    public static void SendHyperKeyDown() {
        foreach (var key in ModifierKeys) {
            SendKeyDown(key);
        }
    }

    public static void SendHyperKeyUp() {
        // Release in reverse order
        for (int i = ModifierKeys.Count - 1; i >= 0; i--) {
            SendKeyUp(ModifierKeys[i]);
        }
    }

    public static void UpdateModifierState() {
        // Convert HashSet to array directly
        var keys = KeyboardMonitor.GetPressedKeys().ToArray();
        var keyNames = new string[keys.Length];
        for (int i = 0; i < keys.Length; i++) {
            keyNames[i] = KeyboardMonitor.GetKeyDisplayName(keys[i]);
        }

        // Create JSON manually using string.Format
        var quotedKeys = keyNames.Select(k => string.Format("\"{0}\"", k));
        var json = string.Format("{{\"pressedKeys\":[{0}]}}", string.Join(",", quotedKeys));
        
        // Only send if state has changed
        if (json != KeyboardMonitor.lastSentState) {
            KeyboardMonitor.lastSentState = json;
            Console.WriteLine(json);
        }
    }
}

public class KeyboardHook {
    private static IntPtr hookId = IntPtr.Zero;
    private static KeyboardMonitor.LowLevelKeyboardProc hookProc;

    public static void Initialize() {
        hookProc = HookCallback;
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            hookId = KeyboardMonitor.SetWindowsHookEx(
                KeyboardMonitor.WH_KEYBOARD_LL,
                hookProc,
                KeyboardMonitor.GetModuleHandle(curModule.ModuleName),
                0
            );
        }
    }

    public static void Cleanup() {
        if (hookId != IntPtr.Zero) {
            KeyboardMonitor.UnhookWindowsHookEx(hookId);
            hookId = IntPtr.Zero;
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            var hookStruct = (KeyboardMonitor.KBDLLHOOKSTRUCT)Marshal.PtrToStructure(
                lParam,
                typeof(KeyboardMonitor.KBDLLHOOKSTRUCT)
            );

            Keys key = (Keys)hookStruct.vkCode;
            bool isKeyDown = wParam == (IntPtr)KeyboardMonitor.WM_KEYDOWN || wParam == (IntPtr)KeyboardMonitor.WM_SYSKEYDOWN;
            bool isKeyUp = wParam == (IntPtr)KeyboardMonitor.WM_KEYUP || wParam == (IntPtr)KeyboardMonitor.WM_SYSKEYUP;

            // Debug logging for key events
            if (KeyboardMonitor.IsDebugEnabled) {
                Console.WriteLine(string.Format("[DEBUG] Key Event - Key: {0}, IsDown: {1}, IsUp: {2}, IsEnabled: {3}, IsHyperKeyEnabled: {4}, IsTrigger: {5}",
                    key, isKeyDown, isKeyUp, KeyboardMonitor.IsEnabled, KeyboardMonitor.IsHyperKeyEnabled, key == KeyboardMonitor.HyperKeyTrigger));
            }

            // Only process keys if the service is enabled
            if (KeyboardMonitor.IsEnabled) {
                // Track key states and update output
                if (isKeyDown) {
                    KeyboardMonitor.AddPressedKey(key);
                    KeyboardMonitor.UpdateModifierState();
                }
                else if (isKeyUp) {
                    KeyboardMonitor.RemovePressedKey(key);
                    KeyboardMonitor.UpdateModifierState();
                }

                // If this is our trigger key and HyperKey is enabled
                if (KeyboardMonitor.IsHyperKeyEnabled && key == KeyboardMonitor.HyperKeyTrigger) {
                    if (KeyboardMonitor.IsDebugEnabled) {
                        Console.WriteLine(string.Format("[DEBUG] HyperKey Trigger Detected - Key: {0}, IsCapsLock: {1}, IsHandlingSynthetic: {2}, Behavior: {3}",
                            key, key == Keys.CapsLock, KeyboardMonitor.isHandlingSyntheticCapsLock, KeyboardMonitor.CapsLockHandling));
                    }

                    if (key == Keys.CapsLock && !KeyboardMonitor.isHandlingSyntheticCapsLock) {
                        switch (KeyboardMonitor.CapsLockHandling) {
                            case KeyboardMonitor.CapsLockBehavior.DoublePress:
                                if (isKeyDown) {
                                    if (KeyboardMonitor.IsDebugEnabled) {
                                        Console.WriteLine("[DEBUG] DoublePress - Sending CapsLock and HyperKey Down");
                                    }
                                    System.Threading.Thread.Sleep(1);
                                    KeyboardMonitor.SendKeyDown(Keys.CapsLock);
                                    KeyboardMonitor.SendKeyUp(Keys.CapsLock);
                                    KeyboardMonitor.SendHyperKeyDown();
                                } else if (isKeyUp) {
                                    if (KeyboardMonitor.IsDebugEnabled) {
                                        Console.WriteLine("[DEBUG] DoublePress - Sending HyperKey Up");
                                    }
                                    KeyboardMonitor.SendHyperKeyUp();
                                }
                                break;
                            case KeyboardMonitor.CapsLockBehavior.BlockToggle:
                                if (isKeyDown) {
                                    if (KeyboardMonitor.IsDebugEnabled) {
                                        Console.WriteLine("[DEBUG] BlockToggle - Sending HyperKey Down");
                                    }
                                    KeyboardMonitor.SendHyperKeyDown();
                                } else if (isKeyUp) {
                                    if (KeyboardMonitor.IsDebugEnabled) {
                                        Console.WriteLine("[DEBUG] BlockToggle - Sending HyperKey Up");
                                    }
                                    KeyboardMonitor.SendHyperKeyUp();
                                }
                                break;
                            case KeyboardMonitor.CapsLockBehavior.None:
                                if (isKeyDown) {
                                    if (KeyboardMonitor.IsDebugEnabled) {
                                        Console.WriteLine("[DEBUG] None - Sending HyperKey Down and allowing CapsLock");
                                    }
                                    KeyboardMonitor.SendHyperKeyDown();
                                } else if (isKeyUp) {
                                    if (KeyboardMonitor.IsDebugEnabled) {
                                        Console.WriteLine("[DEBUG] None - Sending HyperKey Up and allowing CapsLock");
                                    }
                                    KeyboardMonitor.SendHyperKeyUp();
                                }
                                return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
                        }
                    } else {
                        if (isKeyDown) {
                            if (KeyboardMonitor.IsDebugEnabled) {
                                Console.WriteLine("[DEBUG] Non-CapsLock Trigger - Sending HyperKey Down");
                            }
                            KeyboardMonitor.SendHyperKeyDown();
                        } else if (isKeyUp) {
                            if (KeyboardMonitor.IsDebugEnabled) {
                                Console.WriteLine("[DEBUG] Non-CapsLock Trigger - Sending HyperKey Up");
                            }
                            KeyboardMonitor.SendHyperKeyUp();
                        }
                    }
                    return (IntPtr)1;  // Block the original key signal
                }
                // If this is our trigger key but HyperKey is disabled
                else if (!KeyboardMonitor.IsHyperKeyEnabled && key == KeyboardMonitor.HyperKeyTrigger) {
                    // Let the key through but still track it
                    if (KeyboardMonitor.IsDebugEnabled) {
                        Console.WriteLine("[DEBUG] Trigger key detected but HyperKey disabled - passing through");
                    }
                    return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
                }
            }
        }
        return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

    # Configure the hyperkey based on config
    Write-Debug-Message "Configuring HyperKey with: isEnabled=$($Config.isEnabled), trigger=$($Config.trigger)"
    Write-Debug-Message "Full config: $($Config | ConvertTo-Json -Depth 10)"

    # Ensure modifiers is an array, even if empty
    if ($null -eq $Config.modifiers) {
        Write-Debug-Message "Modifiers is null, initializing empty array"
        $Config.modifiers = @()
    } elseif ($Config.modifiers -isnot [array]) {
        Write-Debug-Message "Modifiers is not an array, converting from: $($Config.modifiers.GetType())"
        $Config.modifiers = @($Config.modifiers)
    }

    Write-Debug-Message "Raw modifiers value: $($Config.modifiers | ConvertTo-Json -Depth 10)"

    # Set default CapsLock behavior if not specified
    $capsLockBehavior = if ($Config.capsLockBehavior) { $Config.capsLockBehavior } else { "BlockToggle" }
    Write-Debug-Message "Using CapsLock behavior: $capsLockBehavior"

    # Convert modifiers to string array and filter out empty/null values
    $modifiersArray = @($Config.modifiers | Where-Object { $_ } | ForEach-Object { $_.ToString().Trim() })

    Write-Debug-Message "Processed modifiers array: $($modifiersArray | ConvertTo-Json -Depth 10)"
    Write-Debug-Message "Modifiers array type: $($modifiersArray.GetType())"
    Write-Debug-Message "Modifiers array length: $($modifiersArray.Length)"

    try {
        Write-Debug-Message "Attempting to configure HyperKey..."
        Write-Debug-Message "Parameters: isEnabled=$($Config.isEnabled), isHyperKeyEnabled=$($Config.isHyperKeyEnabled), trigger=$($Config.trigger), modifiers=$($modifiersArray -join ','), capsLockBehavior=$capsLockBehavior"
        
        [KeyboardMonitor]::ConfigureHyperKey(
            [bool]$Config.isEnabled,
            [bool]$Config.isHyperKeyEnabled,
            [string]$Config.trigger,
            [string[]]@($modifiersArray),
            [string]$capsLockBehavior
        )
        Write-Debug-Message "HyperKey configured successfully"
    } catch {
        Write-Debug-Message "Error configuring HyperKey: $_"
        Write-Debug-Message "Error type: $($_.Exception.GetType())"
        Write-Debug-Message "Stack trace: $($_.ScriptStackTrace)"
        throw
    }

    Write-Debug-Message "HyperKey state after config: isEnabled=$([KeyboardMonitor]::IsEnabled), trigger=$([KeyboardMonitor]::HyperKeyTrigger), modifiers=$([string]::Join(',', [KeyboardMonitor]::ModifierKeys))"

    try {
        # Initialize the keyboard hook
        [KeyboardHook]::Initialize()
        Write-Debug-Message "Keyboard hook initialized"

        # Keep the script running but no need to poll
        $done = $false
        while (-not $done) {
            Start-Sleep -Seconds 1
        }
    }
    finally {
        # Cleanup when the script exits
        Write-Debug-Message "Starting cleanup process..."
        [KeyboardHook]::Cleanup()
        Write-Debug-Message "Keyboard hook cleaned up"
        Write-Debug-Message "Process terminating..."
    }
}
catch {
    Write-Debug-Message "Fatal error occurred: $_"
    Write-Debug-Message "Stack trace: $($_.ScriptStackTrace)"
    Write-Error "Error in keyboard monitor: $_"
    exit 1
} 