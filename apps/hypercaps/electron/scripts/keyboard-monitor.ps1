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

public static class KeyboardMonitor {
    public const int WH_KEYBOARD_LL = 13;
    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;

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
        // Map keys that might have different names across Windows versions
        var mappedKey = key;
        switch (key) {
            case Keys.Alt:
                // Check both LMenu and RMenu for Alt
                return (GetAsyncKeyState(Keys.LMenu) & 0x8000) != 0 || (GetAsyncKeyState(Keys.RMenu) & 0x8000) != 0;
            case Keys.ControlKey:
                // Check both LControlKey and RControlKey
                return (GetAsyncKeyState(Keys.LControlKey) & 0x8000) != 0 || (GetAsyncKeyState(Keys.RControlKey) & 0x8000) != 0;
            case Keys.ShiftKey:
                // Check both LShiftKey and RShiftKey
                return (GetAsyncKeyState(Keys.LShiftKey) & 0x8000) != 0 || (GetAsyncKeyState(Keys.RShiftKey) & 0x8000) != 0;
            default:
                return (GetAsyncKeyState(key) & 0x8000) != 0;
        }
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

    // Map Windows Forms Keys to their display names - only special cases
    private static Dictionary<Keys, string> keyDisplayNames = new Dictionary<Keys, string>() {
        { Keys.Capital, "CapsLock" }
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

    public static bool IsHyperKeyEnabled = false;
    public static Keys HyperKeyTrigger = Keys.CapsLock;
    public static bool UseCtrl = false;
    public static bool UseAlt = false;
    public static bool UseShift = false;
    public static bool UseWin = false;
    public static CapsLockBehavior CapsLockHandling = CapsLockBehavior.BlockToggle;

    public static void ConfigureHyperKey(bool enabled, string trigger, bool useCtrl, bool useAlt, bool useShift, bool useWin, string capsLockBehavior = "BlockToggle") {
        IsHyperKeyEnabled = enabled;
        HyperKeyTrigger = (Keys)Enum.Parse(typeof(Keys), trigger, true);
        UseCtrl = useCtrl;
        UseAlt = useAlt;
        UseShift = useShift;
        UseWin = useWin;
        CapsLockHandling = (CapsLockBehavior)Enum.Parse(typeof(CapsLockBehavior), capsLockBehavior, true);
    }

    private static Dictionary<Keys, Keys> keyMappings = new Dictionary<Keys, Keys>() {
        { Keys.Alt, Keys.LMenu },
        { Keys.ControlKey, Keys.LControlKey },
        { Keys.ShiftKey, Keys.LShiftKey }
    };

    private static Keys GetMappedKey(Keys key) {
        return keyMappings.ContainsKey(key) ? keyMappings[key] : key;
    }

    public static void SendHyperKeyDown() {
        if (UseCtrl) SendKeyDown(GetMappedKey(Keys.ControlKey));
        if (UseAlt) SendKeyDown(GetMappedKey(Keys.Alt));
        if (UseShift) SendKeyDown(GetMappedKey(Keys.ShiftKey));
        if (UseWin) SendKeyDown(Keys.LWin);
    }

    public static void SendHyperKeyUp() {
        if (UseWin) SendKeyUp(Keys.LWin);
        if (UseShift) SendKeyUp(GetMappedKey(Keys.ShiftKey));
        if (UseAlt) SendKeyUp(GetMappedKey(Keys.Alt));
        if (UseCtrl) SendKeyUp(GetMappedKey(Keys.ControlKey));
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

            // Always track key states
            if (isKeyDown) {
                KeyboardMonitor.AddPressedKey(key);
            }
            else if (isKeyUp) {
                KeyboardMonitor.RemovePressedKey(key);
            }

            // If this key is our HyperKey trigger
            if (KeyboardMonitor.IsHyperKeyEnabled && key == KeyboardMonitor.HyperKeyTrigger) {
                if (key == Keys.CapsLock && !KeyboardMonitor.isHandlingSyntheticCapsLock) {
                    switch (KeyboardMonitor.CapsLockHandling) {
                        case KeyboardMonitor.CapsLockBehavior.DoublePress:
                            if (isKeyDown) {
                                System.Threading.Thread.Sleep(1);
                                KeyboardMonitor.SendKeyDown(Keys.CapsLock);
                                KeyboardMonitor.SendKeyUp(Keys.CapsLock);
                                KeyboardMonitor.SendHyperKeyDown();
                            } else if (isKeyUp) {
                                KeyboardMonitor.SendHyperKeyUp();
                            }
                            break;
                        case KeyboardMonitor.CapsLockBehavior.BlockToggle:
                            if (isKeyDown) {
                                KeyboardMonitor.SendHyperKeyDown();
                            } else if (isKeyUp) {
                                KeyboardMonitor.SendHyperKeyUp();
                            }
                            break;
                        case KeyboardMonitor.CapsLockBehavior.None:
                            if (isKeyDown) {
                                KeyboardMonitor.SendHyperKeyDown();
                            } else if (isKeyUp) {
                                KeyboardMonitor.SendHyperKeyUp();
                            }
                            return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
                    }
                } else {
                    if (isKeyDown) {
                        KeyboardMonitor.SendHyperKeyDown();
                    } else if (isKeyUp) {
                        KeyboardMonitor.SendHyperKeyUp();
                    }
                }
                return (IntPtr)1;  // Block the original key signal
            }
        }
        return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

    # Configure the hyperkey based on config
    Write-Debug-Message "Configuring HyperKey with: enabled=$($Config.enabled), trigger=$($Config.trigger)"
    Write-Debug-Message "Modifiers: ctrl=$($Config.modifiers.ctrl), alt=$($Config.modifiers.alt), shift=$($Config.modifiers.shift), win=$($Config.modifiers.win)"
    Write-Debug-Message "CapsLock Behavior: $($Config.capsLockBehavior)"

    # Set default CapsLock behavior if not specified
    $capsLockBehavior = if ($Config.capsLockBehavior) { $Config.capsLockBehavior } else { "BlockToggle" }

    [KeyboardMonitor]::ConfigureHyperKey(
        [bool]$Config.enabled,  # Explicitly cast to bool
        $Config.trigger,
        [bool]$Config.modifiers.ctrl,
        [bool]$Config.modifiers.alt,
        [bool]$Config.modifiers.shift,
        [bool]$Config.modifiers.win,
        $capsLockBehavior
    )

    Write-Debug-Message "HyperKey state after config: enabled=$([KeyboardMonitor]::IsHyperKeyEnabled), trigger=$([KeyboardMonitor]::HyperKeyTrigger)"

    # Initialize the keyboard hook
    [KeyboardHook]::Initialize()
    Write-Debug-Message "Keyboard hook initialized"

    try {
        while ($true) {
            $ctrl = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::ControlKey)
            $alt = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::Alt)
            $shift = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::ShiftKey)
            $win = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::LWin) -or [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::RWin)
            $caps = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::CapsLock)
            
            # Get all currently pressed keys
            $pressedKeys = @([KeyboardMonitor]::GetPressedKeys() | ForEach-Object { $_.ToString() })

            # Ensure clean JSON output on a single line
            $state = @{
                ctrl = $ctrl
                alt = $alt
                shift = $shift
                win = $win
                caps = $caps
                pressedKeys = $pressedKeys
                hyperKeyActive = $Config.enabled -and [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::($Config.trigger))
            } | ConvertTo-Json -Compress

            # Write state to stdout
            [Console]::WriteLine($state)
            Start-Sleep -Milliseconds 16
        }
    }
    finally {
        # Cleanup when the script exits
        [KeyboardHook]::Cleanup()
        Write-Debug-Message "Keyboard hook cleaned up"
    }
}
catch {
    Write-Error "Error in keyboard monitor: $_"
    exit 1
} 