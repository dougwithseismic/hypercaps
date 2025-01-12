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
        return (GetAsyncKeyState(key) & 0x8000) != 0;
    }

    public static void SendKeyDown(Keys key, bool extended = false) {
        uint flags = (uint)(KEYEVENTF_KEYDOWN | (extended ? KEYEVENTF_EXTENDEDKEY : 0));
        keybd_event((byte)key, 0, flags, UIntPtr.Zero);
    }

    public static void SendKeyUp(Keys key, bool extended = false) {
        uint flags = (uint)(KEYEVENTF_KEYUP | (extended ? KEYEVENTF_EXTENDEDKEY : 0));
        keybd_event((byte)key, 0, flags, UIntPtr.Zero);
    }

    private static HashSet<Keys> pressedKeys = new HashSet<Keys>();

    public static HashSet<Keys> GetPressedKeys() {
        return pressedKeys;
    }

    public static void AddPressedKey(Keys key) {
        pressedKeys.Add(key);
    }

    public static void RemovePressedKey(Keys key) {
        pressedKeys.Remove(key);
    }

    public static bool IsHyperKeyEnabled = false;
    public static Keys HyperKeyTrigger = Keys.CapsLock;
    public static bool UseCtrl = false;
    public static bool UseAlt = false;
    public static bool UseShift = false;
    public static bool UseWin = false;

    public static void ConfigureHyperKey(bool enabled, string trigger, bool useCtrl, bool useAlt, bool useShift, bool useWin) {
        IsHyperKeyEnabled = enabled;
        HyperKeyTrigger = (Keys)Enum.Parse(typeof(Keys), trigger, true);
        UseCtrl = useCtrl;
        UseAlt = useAlt;
        UseShift = useShift;
        UseWin = useWin;
    }

    public static void SendHyperKeyDown() {
        if (UseCtrl) SendKeyDown(Keys.ControlKey);
        if (UseAlt) SendKeyDown(Keys.Alt);
        if (UseShift) SendKeyDown(Keys.ShiftKey);
        if (UseWin) SendKeyDown(Keys.LWin);
    }

    public static void SendHyperKeyUp() {
        if (UseWin) SendKeyUp(Keys.LWin);
        if (UseShift) SendKeyUp(Keys.ShiftKey);
        if (UseAlt) SendKeyUp(Keys.Alt);
        if (UseCtrl) SendKeyUp(Keys.ControlKey);
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
                // Early return for CapsLock to prevent Windows from toggling caps state

                if (isKeyDown) {
                    KeyboardMonitor.SendHyperKeyDown();
                }
                else if (isKeyUp) {
                    KeyboardMonitor.SendHyperKeyUp();
                }
                return (IntPtr)1;  // Block the original key
            }


        }
        return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

    # Configure the hyperkey based on config
    Write-Debug-Message "Configuring HyperKey with: enabled=$($Config.enabled), trigger=$($Config.trigger)"
    Write-Debug-Message "Modifiers: ctrl=$($Config.modifiers.ctrl), alt=$($Config.modifiers.alt), shift=$($Config.modifiers.shift), win=$($Config.modifiers.win)"

    [KeyboardMonitor]::ConfigureHyperKey(
        [bool]$Config.enabled,  # Explicitly cast to bool
        $Config.trigger,
        [bool]$Config.modifiers.ctrl,
        [bool]$Config.modifiers.alt,
        [bool]$Config.modifiers.shift,
        [bool]$Config.modifiers.win
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
            $pressedKeys = [KeyboardMonitor]::GetPressedKeys() | ForEach-Object { $_.ToString() }

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