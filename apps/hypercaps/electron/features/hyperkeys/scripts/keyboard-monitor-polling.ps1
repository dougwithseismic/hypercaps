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
using System.Collections.Generic;
using System.Linq;
using System.Timers;

public class KeyAction {
    public Keys Key { get; private set; }
    public bool IsPress { get; private set; }

    public KeyAction(Keys key, bool isPress) {
        Key = key;
        IsPress = isPress;
    }
}

public class InputSequence {
    public List<KeyAction> RequiredInputs { get; private set; }
    public long TimeWindow { get; private set; }
    public string Name { get; private set; }

    public InputSequence(string name, long timeWindow) {
        Name = name;
        TimeWindow = timeWindow;
        RequiredInputs = new List<KeyAction>();
    }

    public void AddInput(Keys key, bool isPress) {
        RequiredInputs.Add(new KeyAction(key, isPress));
    }
}

public class PollingKeyboardMonitor {
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(Keys vKey);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int KEYEVENTF_KEYDOWN = 0x0000;
    public const int KEYEVENTF_KEYUP = 0x0002;
    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;

    private static InputBuffer inputBuffer;
    private static System.Timers.Timer pollTimer;
    private static HashSet<Keys> lastFrameKeys = new HashSet<Keys>();
    public static bool IsDebugEnabled = false;

    // HyperKey state
    public static bool IsEnabled = false;
    public static bool IsHyperKeyEnabled = false;
    public static Keys HyperKeyTrigger = Keys.CapsLock;
    public static List<Keys> ModifierKeys = new List<Keys>();
    public static bool isHandlingSyntheticCapsLock = false;
    public static CapsLockBehavior CapsLockHandling = CapsLockBehavior.BlockToggle;

    public enum CapsLockBehavior {
        None,           // Don't do anything special with CapsLock
        DoublePress,    // Press CapsLock again to untoggle
        BlockToggle     // Just block the CapsLock toggle completely
    }

    public static void Initialize(bool isEnabled, bool isHyperKeyEnabled, string trigger, string[] modifiers, string capsLockBehavior = "BlockToggle", long bufferWindow = 3000) {
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

        inputBuffer = new InputBuffer(bufferWindow);
        
        pollTimer = new System.Timers.Timer(8.33); // ~120Hz polling
        pollTimer.Elapsed += (sender, e) => PollKeyboardState();
        pollTimer.Start();
        
        if (IsDebugEnabled) {
            Console.WriteLine(string.Format("[DEBUG] HyperKey Configured - New State: IsEnabled={0}, IsHyperKeyEnabled={1}, Trigger={2}, Modifiers={3}, BufferWindow={4}ms",
                IsEnabled, IsHyperKeyEnabled, HyperKeyTrigger, string.Join(",", ModifierKeys), bufferWindow));
        }
    }

    private static void ProcessKeyPress(Keys key) {
        if (!IsEnabled) return;

        var timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        if (inputBuffer != null) {
            inputBuffer.ProcessKeyEvent(key, true, timestamp);
        }

        if (IsHyperKeyEnabled && key == HyperKeyTrigger) {
            if (key == Keys.CapsLock && !isHandlingSyntheticCapsLock) {
                switch (CapsLockHandling) {
                    case CapsLockBehavior.DoublePress:
                        System.Threading.Thread.Sleep(1);
                        SendKeyDown(Keys.CapsLock);
                        SendKeyUp(Keys.CapsLock);
                        SendHyperKeyDown();
                        break;
                    case CapsLockBehavior.BlockToggle:
                        SendHyperKeyDown();
                        break;
                    case CapsLockBehavior.None:
                        SendHyperKeyDown();
                        break;
                }
            } else {
                SendHyperKeyDown();
            }
        }
    }

    private static void ProcessKeyRelease(Keys key) {
        if (!IsEnabled) return;

        var timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        if (inputBuffer != null) {
            inputBuffer.ProcessKeyEvent(key, false, timestamp);
        }

        if (IsHyperKeyEnabled && key == HyperKeyTrigger) {
            SendHyperKeyUp();
        }
    }

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

    private static void PollKeyboardState() {
        try {
            if (!IsEnabled) return;

            var timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds();
            var currentKeys = new HashSet<Keys>();

            // Check all possible key values
            foreach (Keys key in Enum.GetValues(typeof(Keys))) {
                // Skip modifiers and other special keys that might cause issues
                if (key == Keys.None || 
                    key == Keys.Modifiers || 
                    key == Keys.KeyCode || 
                    key == Keys.LButton || 
                    key == Keys.RButton || 
                    key == Keys.MButton || 
                    key == Keys.XButton1 || 
                    key == Keys.XButton2) {
                    continue;
                }

                if ((GetAsyncKeyState(key) & 0x8000) != 0) {
                    currentKeys.Add(key);
                }
            }

            var justPressed = currentKeys.Except(lastFrameKeys);
            var justReleased = lastFrameKeys.Except(currentKeys);

            foreach (var key in justPressed) {
                ProcessKeyPress(key);
            }
            foreach (var key in justReleased) {
                ProcessKeyRelease(key);
            }

            if (currentKeys.Count > 0 && inputBuffer != null) {
                inputBuffer.ForceFrameUpdate(timestamp);
            }

            lastFrameKeys = currentKeys;
        }
        catch (Exception ex) {
            if (IsDebugEnabled) {
                Console.WriteLine(string.Format("[ERROR] Polling error: {0}", ex.Message));
            }
        }
    }

    public static void Cleanup() {
        if (pollTimer != null) {
            pollTimer.Stop();
            pollTimer.Dispose();
        }
        if (inputBuffer != null) {
            inputBuffer.Dispose();
        }
    }
}

public class InputFrame {
    public HashSet<Keys> JustPressed;
    public HashSet<Keys> HeldKeys;
    public HashSet<Keys> JustReleased;
    public Dictionary<Keys, long> HoldDurations;
    public long Timestamp;
    public int FrameNumber;

    public InputFrame(long timestamp, int frameNumber) {
        JustPressed = new HashSet<Keys>();
        HeldKeys = new HashSet<Keys>();
        JustReleased = new HashSet<Keys>();
        HoldDurations = new Dictionary<Keys, long>();
        Timestamp = timestamp;
        FrameNumber = frameNumber;
    }
}

public class InputBuffer {
    private const long FRAME_TIME = 16;
    private long maxBufferWindow;
    private int maxBufferSize;
    private Queue<InputFrame> frames = new Queue<InputFrame>();
    private Dictionary<Keys, long> keyPressStartTimes = new Dictionary<Keys, long>();
    private HashSet<Keys> currentlyHeldKeys = new HashSet<Keys>();
    private int currentFrame = 0;
    private long lastFrameTime = 0;

    // Sequence detection
    private List<InputSequence> registeredSequences = new List<InputSequence>();
    private Queue<KeyAction> inputHistory = new Queue<KeyAction>();
    private const int MAX_HISTORY_SIZE = 30;

    public InputBuffer(long bufferWindow) {
        maxBufferWindow = bufferWindow;
        maxBufferSize = (int)((maxBufferWindow / FRAME_TIME) + 60);

        // Register example sequences
        var hadoken = new InputSequence("Hadoken", 500);
        hadoken.AddInput(Keys.Down, true);
        hadoken.AddInput(Keys.Right, true);
        hadoken.AddInput(Keys.Down, false);
        hadoken.AddInput(Keys.A, true);
        registeredSequences.Add(hadoken);

        var shoryuken = new InputSequence("Shoryuken", 500);
        shoryuken.AddInput(Keys.Right, true);
        shoryuken.AddInput(Keys.Down, true);
        shoryuken.AddInput(Keys.Right, false);
        shoryuken.AddInput(Keys.Right, true);
        shoryuken.AddInput(Keys.A, true);
        registeredSequences.Add(shoryuken);
    }

    private void AddToHistory(Keys key, bool isPress, long timestamp) {
        var action = new KeyAction(key, isPress);
        inputHistory.Enqueue(action);
        while (inputHistory.Count > MAX_HISTORY_SIZE) {
            inputHistory.Dequeue();
        }
    }

    private void CheckSequences(long currentTime) {
        foreach (var sequence in registeredSequences) {
            var historyList = inputHistory.ToList();
            var sequenceLength = sequence.RequiredInputs.Count;
            
            for (int i = historyList.Count - sequenceLength; i >= 0; i--) {
                bool matches = true;
                for (int j = 0; j < sequenceLength; j++) {
                    if (i + j >= historyList.Count || 
                        historyList[i + j].Key != sequence.RequiredInputs[j].Key ||
                        historyList[i + j].IsPress != sequence.RequiredInputs[j].IsPress ||
                        currentTime - lastFrameTime > sequence.TimeWindow) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches) {
                    Console.WriteLine(string.Format("{{\"type\":\"sequence\",\"name\":\"{0}\",\"timestamp\":{1}}}", 
                        sequence.Name, currentTime));
                    for (int j = 0; j < sequenceLength; j++) {
                        inputHistory.Dequeue();
                    }
                    break;
                }
            }
        }
    }

    public void ProcessKeyEvent(Keys key, bool isDown, long timestamp) {
        if (frames.Count == 0 || timestamp - lastFrameTime >= FRAME_TIME) {
            CreateNewFrame(timestamp);
        }

        var currentFrame = frames.Last();

        if (isDown) {
            if (!currentlyHeldKeys.Contains(key)) {
                currentFrame.JustPressed.Add(key);
                keyPressStartTimes[key] = timestamp;
                currentlyHeldKeys.Add(key);
                currentFrame.HeldKeys.Add(key);
                AddToHistory(key, true, timestamp);
                CheckSequences(timestamp);
            }
        } else {
            if (currentlyHeldKeys.Contains(key)) {
                currentFrame.JustReleased.Add(key);
                currentFrame.HeldKeys.Remove(key);
                currentlyHeldKeys.Remove(key);
                keyPressStartTimes.Remove(key);
                AddToHistory(key, false, timestamp);
                CheckSequences(timestamp);
            }
        }

        UpdateHoldDurations(currentFrame, timestamp);
        OutputFrameState(currentFrame, key, isDown);
    }

    public void ForceFrameUpdate(long timestamp) {
        if (timestamp - lastFrameTime >= FRAME_TIME) {
            CreateNewFrame(timestamp);
            var currentFrame = frames.Last();
            UpdateHoldDurations(currentFrame, timestamp);
            OutputFrameState(currentFrame, Keys.None, false);
        }
    }

    private void UpdateHoldDurations(InputFrame frame, long timestamp) {
        foreach (var key in currentlyHeldKeys) {
            if (keyPressStartTimes.ContainsKey(key)) {
                frame.HoldDurations[key] = timestamp - keyPressStartTimes[key];
            }
        }
    }

    private void CreateNewFrame(long timestamp) {
        while (frames.Count >= maxBufferSize) {
            frames.Dequeue();
        }

        var frame = new InputFrame(timestamp, currentFrame++);
        
        foreach (var key in currentlyHeldKeys) {
            frame.HeldKeys.Add(key);
        }

        frames.Enqueue(frame);
        lastFrameTime = timestamp;
    }

    private void OutputFrameState(InputFrame frame, Keys triggerKey, bool isDown) {
        var quotedPressed = frame.JustPressed.Select(k => string.Format("\"{0}\"", k)).ToArray();
        var quotedHeld = frame.HeldKeys.Select(k => string.Format("\"{0}\"", k)).ToArray();
        var quotedReleased = frame.JustReleased.Select(k => string.Format("\"{0}\"", k)).ToArray();
        var holdDurations = frame.HoldDurations.Select(kvp => 
            string.Format("\"{0}\":{1}", kvp.Key, kvp.Value)).ToArray();

        var json = string.Format(
            "{{\"frame\":{0},\"timestamp\":{1},\"event\":{{\"type\":\"{2}\",\"key\":\"{3}\"}},\"state\":{{\"justPressed\":[{4}],\"held\":[{5}],\"justReleased\":[{6}],\"holdDurations\":{{{7}}}}}}}",
            frame.FrameNumber,
            frame.Timestamp,
            isDown ? "keydown" : "keyup",
            triggerKey,
            string.Join(",", quotedPressed),
            string.Join(",", quotedHeld),
            string.Join(",", quotedReleased),
            string.Join(",", holdDurations)
        );

        Console.WriteLine(json);
    }

    public void Dispose() {
        frames.Clear();
        keyPressStartTimes.Clear();
        currentlyHeldKeys.Clear();
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
        
        [PollingKeyboardMonitor]::IsDebugEnabled = $true
        [PollingKeyboardMonitor]::Initialize(
            [bool]$Config.isEnabled,
            [bool]$Config.isHyperKeyEnabled,
            [string]$Config.trigger,
            [string[]]@($modifiersArray),
            [string]$capsLockBehavior,
            [long]$Config.bufferWindow
        )
        Write-Debug-Message "HyperKey configured successfully"
    } catch {
        Write-Debug-Message "Error configuring HyperKey: $_"
        Write-Debug-Message "Error type: $($_.Exception.GetType())"
        Write-Debug-Message "Stack trace: $($_.ScriptStackTrace)"
        throw
    }

    Write-Debug-Message "HyperKey state after config: isEnabled=$([PollingKeyboardMonitor]::IsEnabled), trigger=$([PollingKeyboardMonitor]::HyperKeyTrigger), modifiers=$([string]::Join(',', [PollingKeyboardMonitor]::ModifierKeys))"

    try {
        Write-Host "[DEBUG] Polling keyboard monitor started. Press Ctrl+C to exit."
        
        while ($true) {
            Start-Sleep -Seconds 1
        }
    }
    finally {
        Write-Debug-Message "Starting cleanup process..."
        [PollingKeyboardMonitor]::Cleanup()
        Write-Debug-Message "Keyboard monitor cleaned up"
        Write-Debug-Message "Process terminating..."
    }
} catch {
    Write-Debug-Message "Fatal error occurred: $_"
    Write-Debug-Message "Stack trace: $($_.ScriptStackTrace)"
    Write-Error "Error in polling keyboard monitor: $_"
    exit 1
} 