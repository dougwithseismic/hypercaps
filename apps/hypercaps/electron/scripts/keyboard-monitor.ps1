# Suppress PowerShell startup banner
$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'

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

            // Track key states
            if (wParam == (IntPtr)KeyboardMonitor.WM_KEYDOWN || wParam == (IntPtr)KeyboardMonitor.WM_SYSKEYDOWN) {
                KeyboardMonitor.AddPressedKey(key);
            }
            else if (wParam == (IntPtr)KeyboardMonitor.WM_KEYUP || wParam == (IntPtr)KeyboardMonitor.WM_SYSKEYUP) {
                KeyboardMonitor.RemovePressedKey(key);
            }

            // Block CapsLock (vkCode 20)
            if (hookStruct.vkCode == 20) {
                // Key down event
                if (wParam == (IntPtr)KeyboardMonitor.WM_KEYDOWN || wParam == (IntPtr)KeyboardMonitor.WM_SYSKEYDOWN) {
                    KeyboardMonitor.SendKeyDown(Keys.ControlKey);
                    KeyboardMonitor.SendKeyDown(Keys.ShiftKey);
                    KeyboardMonitor.SendKeyDown(Keys.LWin);
                }
                // Key up event
                else if (wParam == (IntPtr)KeyboardMonitor.WM_KEYUP || wParam == (IntPtr)KeyboardMonitor.WM_SYSKEYUP) {
                    KeyboardMonitor.SendKeyUp(Keys.LWin);
                    KeyboardMonitor.SendKeyUp(Keys.ShiftKey);
                    KeyboardMonitor.SendKeyUp(Keys.ControlKey);
                }
                return (IntPtr)1; // Block the original CapsLock
            }
        }
        return KeyboardMonitor.CallNextHookEx(hookId, nCode, wParam, lParam);
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

# Initialize the keyboard hook
[KeyboardHook]::Initialize()

try {
    while ($true) {
        $ctrl = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::ControlKey)
        $alt = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::Alt)
        $shift = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::ShiftKey)
        $win = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::LWin) -or [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::RWin)
        $caps = [KeyboardMonitor]::IsKeyPressed([System.Windows.Forms.Keys]::CapsLock)
        
        # Get all currently pressed keys
        $pressedKeys = [KeyboardMonitor]::GetPressedKeys() | ForEach-Object { $_.ToString() }

        # Ensure clean JSON output
        $state = @{
            ctrl = $ctrl
            alt = $alt
            shift = $shift
            win = $win
            caps = $caps
            pressedKeys = $pressedKeys
        } | ConvertTo-Json -Compress

        [Console]::WriteLine($state)
        Start-Sleep -Milliseconds 16
    }
}
finally {
    # Cleanup when the script exits
    [KeyboardHook]::Cleanup()
} 