#include "key_mapping.h"
#include <algorithm>
#include <cctype>
#include <chrono>

// Static member initialization
std::map<std::string, DWORD> KeyMapping::keyNameToVK;
std::map<DWORD, std::string> KeyMapping::vkToKeyName;
std::map<DWORD, std::vector<DWORD>> KeyMapping::activeRemaps;
std::map<DWORD, KeyState> KeyMapping::keyStates;
std::set<DWORD> KeyMapping::processedKeys;
std::queue<DWORD> KeyMapping::releaseOrder;
bool KeyMapping::mapsInitialized = false;
bool KeyMapping::capsLockRemapped = false;
bool KeyMapping::reportCapsLock = true;

void KeyMapping::InitializeMaps() {
    if (mapsInitialized) return;

    // Basic keys - store all keys in lowercase for case-insensitive lookup
    keyNameToVK["capslock"] = VK_CAPITAL;
    keyNameToVK["capital"] = VK_CAPITAL;  // Support both names
    keyNameToVK["shift"] = VK_SHIFT;
    keyNameToVK["control"] = VK_CONTROL;
    keyNameToVK["alt"] = VK_MENU;
    keyNameToVK["win"] = VK_LWIN;
    keyNameToVK["tab"] = VK_TAB;
    keyNameToVK["enter"] = VK_RETURN;
    keyNameToVK["space"] = VK_SPACE;
    keyNameToVK["backspace"] = VK_BACK;
    keyNameToVK["delete"] = VK_DELETE;
    keyNameToVK["escape"] = VK_ESCAPE;

    // Left/Right modifiers
    keyNameToVK["lshift"] = VK_LSHIFT;
    keyNameToVK["rshift"] = VK_RSHIFT;
    keyNameToVK["lcontrol"] = VK_LCONTROL;
    keyNameToVK["rcontrol"] = VK_RCONTROL;
    keyNameToVK["lalt"] = VK_LMENU;
    keyNameToVK["ralt"] = VK_RMENU;
    keyNameToVK["lwin"] = VK_LWIN;
    keyNameToVK["rwin"] = VK_RWIN;

    // Function keys
    for (int i = 1; i <= 12; i++) {
        keyNameToVK["f" + std::to_string(i)] = VK_F1 + i - 1;
    }

    // Number keys
    for (int i = 0; i <= 9; i++) {
        keyNameToVK[std::to_string(i)] = '0' + i;
    }

    // Letter keys - store in lowercase
    for (char c = 'a'; c <= 'z'; c++) {
        keyNameToVK[std::string(1, c)] = toupper(c);
    }

    // Navigation keys
    keyNameToVK["home"] = VK_HOME;
    keyNameToVK["end"] = VK_END;
    keyNameToVK["pageup"] = VK_PRIOR;
    keyNameToVK["pagedown"] = VK_NEXT;
    keyNameToVK["insert"] = VK_INSERT;
    keyNameToVK["left"] = VK_LEFT;
    keyNameToVK["right"] = VK_RIGHT;
    keyNameToVK["up"] = VK_UP;
    keyNameToVK["down"] = VK_DOWN;

    // Additional keys
    keyNameToVK["numlock"] = VK_NUMLOCK;
    keyNameToVK["scrolllock"] = VK_SCROLL;
    keyNameToVK["printscreen"] = VK_SNAPSHOT;
    keyNameToVK["pause"] = VK_PAUSE;
    keyNameToVK["semicolon"] = VK_OEM_1;
    keyNameToVK["equals"] = VK_OEM_PLUS;
    keyNameToVK["comma"] = VK_OEM_COMMA;
    keyNameToVK["minus"] = VK_OEM_MINUS;
    keyNameToVK["period"] = VK_OEM_PERIOD;
    keyNameToVK["slash"] = VK_OEM_2;
    keyNameToVK["backtick"] = VK_OEM_3;
    keyNameToVK["openbracket"] = VK_OEM_4;
    keyNameToVK["backslash"] = VK_OEM_5;
    keyNameToVK["closebracket"] = VK_OEM_6;
    keyNameToVK["quote"] = VK_OEM_7;

    // Create reverse mapping (keep original casing for display)
    vkToKeyName[VK_CAPITAL] = "CapsLock";
    vkToKeyName[VK_SHIFT] = "Shift";
    vkToKeyName[VK_CONTROL] = "Control";
    vkToKeyName[VK_MENU] = "Alt";
    vkToKeyName[VK_LWIN] = "Win";
    vkToKeyName[VK_TAB] = "Tab";
    vkToKeyName[VK_RETURN] = "Enter";
    vkToKeyName[VK_SPACE] = "Space";
    vkToKeyName[VK_BACK] = "Backspace";
    vkToKeyName[VK_DELETE] = "Delete";
    vkToKeyName[VK_ESCAPE] = "Escape";
    vkToKeyName[VK_LSHIFT] = "LShift";
    vkToKeyName[VK_RSHIFT] = "RShift";
    vkToKeyName[VK_LCONTROL] = "LControl";
    vkToKeyName[VK_RCONTROL] = "RControl";
    vkToKeyName[VK_LMENU] = "LAlt";
    vkToKeyName[VK_RMENU] = "RAlt";
    vkToKeyName[VK_HOME] = "Home";
    vkToKeyName[VK_END] = "End";
    vkToKeyName[VK_PRIOR] = "PageUp";
    vkToKeyName[VK_NEXT] = "PageDown";
    vkToKeyName[VK_INSERT] = "Insert";
    vkToKeyName[VK_LEFT] = "Left";
    vkToKeyName[VK_RIGHT] = "Right";
    vkToKeyName[VK_UP] = "Up";
    vkToKeyName[VK_DOWN] = "Down";

    // Function keys reverse mapping
    for (int i = 1; i <= 12; i++) {
        vkToKeyName[VK_F1 + i - 1] = "F" + std::to_string(i);
    }

    // Number keys reverse mapping
    for (int i = 0; i <= 9; i++) {
        vkToKeyName['0' + i] = std::to_string(i);
    }

    // Letter keys reverse mapping (uppercase)
    for (char c = 'A'; c <= 'Z'; c++) {
        vkToKeyName[c] = std::string(1, c);
    }

    // Additional keys reverse mapping
    vkToKeyName[VK_NUMLOCK] = "NumLock";
    vkToKeyName[VK_SCROLL] = "ScrollLock";
    vkToKeyName[VK_SNAPSHOT] = "PrintScreen";
    vkToKeyName[VK_PAUSE] = "Pause";
    vkToKeyName[VK_OEM_1] = "Semicolon";
    vkToKeyName[VK_OEM_PLUS] = "Equals";
    vkToKeyName[VK_OEM_COMMA] = "Comma";
    vkToKeyName[VK_OEM_MINUS] = "Minus";
    vkToKeyName[VK_OEM_PERIOD] = "Period";
    vkToKeyName[VK_OEM_2] = "Slash";
    vkToKeyName[VK_OEM_3] = "Backtick";
    vkToKeyName[VK_OEM_4] = "OpenBracket";
    vkToKeyName[VK_OEM_5] = "Backslash";
    vkToKeyName[VK_OEM_6] = "CloseBracket";
    vkToKeyName[VK_OEM_7] = "Quote";

    mapsInitialized = true;
}

DWORD KeyMapping::GetVirtualKeyCode(const std::string& keyName) {
    if (!mapsInitialized) InitializeMaps();

    // Convert to lowercase for case-insensitive lookup
    std::string lowerKeyName = keyName;
    std::transform(lowerKeyName.begin(), lowerKeyName.end(), lowerKeyName.begin(), ::tolower);

    auto it = keyNameToVK.find(lowerKeyName);
    if (it != keyNameToVK.end()) {
        return it->second;
    }

    // Return 0 if key name not found
    return 0;
}

std::string KeyMapping::GetKeyName(DWORD vkCode) {
    if (!mapsInitialized) InitializeMaps();

    auto it = vkToKeyName.find(vkCode);
    if (it != vkToKeyName.end()) {
        return it->second;
    }

    // Return empty string if VK code not found
    return "";
}

bool KeyMapping::IsModifierKey(DWORD vkCode) {
    return vkCode == VK_SHIFT || vkCode == VK_CONTROL || vkCode == VK_MENU ||
           vkCode == VK_LSHIFT || vkCode == VK_RSHIFT ||
           vkCode == VK_LCONTROL || vkCode == VK_RCONTROL ||
           vkCode == VK_LMENU || vkCode == VK_RMENU ||
           vkCode == VK_LWIN || vkCode == VK_RWIN;
}

void KeyMapping::TrackKeyPress(DWORD vkCode, const std::vector<DWORD>& remappedKeys) {
    auto now = std::chrono::steady_clock::now();
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ).count();

    KeyState state;
    state.isPressed = true;
    state.isModifier = IsModifierKey(vkCode);
    state.pressTime = timestamp;
    state.remappedTo = remappedKeys;

    keyStates[vkCode] = state;
    releaseOrder.push(vkCode);
}

void KeyMapping::TrackKeyRelease(DWORD vkCode) {
    auto it = keyStates.find(vkCode);
    if (it != keyStates.end()) {
        // Release remapped keys in reverse order
        ReleaseRemappedKeys(vkCode);
        keyStates.erase(it);
    }
}

void KeyMapping::ReleaseRemappedKeys(DWORD vkCode) {
    auto it = keyStates.find(vkCode);
    if (it == keyStates.end()) return;

    const auto& remappedKeys = it->second.remappedTo;
    // Release keys in reverse order
    for (auto rit = remappedKeys.rbegin(); rit != remappedKeys.rend(); ++rit) {
        SimulateKeyRelease(*rit);
        auto stateIt = keyStates.find(*rit);
        if (stateIt != keyStates.end()) {
            keyStates.erase(stateIt);
        }
    }
}

void KeyMapping::ProcessRemaps(
    const std::map<std::string, std::vector<std::string>>& remaps,
    DWORD vkCode,
    bool isKeyDown,
    int maxChainLength
) {
    // Update CapsLock state when processing remaps
    UpdateCapsLockState(remaps);
    
    // Handle CapsLock specially if it's remapped
    if (vkCode == VK_CAPITAL && capsLockRemapped) {
        HandleCapsLockRemap(isKeyDown);
    }
    
    // Skip if already processed to prevent recursion
    if (processedKeys.find(vkCode) != processedKeys.end()) {
        return;
    }
    
    // Mark as processed
    processedKeys.insert(vkCode);
    
    // Get the key name for lookup
    std::string keyName = GetKeyName(vkCode);
    if (keyName.empty()) {
        processedKeys.erase(vkCode);
        return;
    }
    
    // Check if this key has remaps
    auto remapIt = remaps.find(keyName);
    if (remapIt == remaps.end()) {
        processedKeys.erase(vkCode);
        return;
    }
    
    // Convert target key names to VK codes
    std::vector<DWORD> targetKeys;
    for (const auto& targetKeyName : remapIt->second) {
        DWORD targetVK = GetVirtualKeyCode(targetKeyName);
        if (targetVK != 0) {
            targetKeys.push_back(targetVK);
        }
    }
    
    // Store active remaps for this key
    activeRemaps[vkCode] = targetKeys;
    
    // Check for circular remaps
    std::set<DWORD> visited;
    if (IsCircularRemap(vkCode, remaps, visited, 0, maxChainLength)) {
        printf("Warning: Circular remap detected for key %s\n", keyName.c_str());
        processedKeys.erase(vkCode);
        return;
    }
    
    if (isKeyDown) {
        // Track the key press and its remapped keys
        TrackKeyPress(vkCode, targetKeys);
        
        // Process the remapped keys in order
        for (DWORD targetVK : targetKeys) {
            SimulateKeyPress(targetVK);
        }
    } else {
        // Release keys and clean up state
        TrackKeyRelease(vkCode);
    }
    
    // Clear processed flag
    processedKeys.erase(vkCode);
}

bool KeyMapping::IsKeyRemapped(DWORD vkCode) {
    return activeRemaps.find(vkCode) != activeRemaps.end();
}

std::vector<DWORD> KeyMapping::GetRemappedKeys(DWORD vkCode) {
    auto it = activeRemaps.find(vkCode);
    return it != activeRemaps.end() ? it->second : std::vector<DWORD>();
}

void KeyMapping::SimulateKeyPress(DWORD vkCode) {
    // Don't simulate if key is already pressed
    auto it = keyStates.find(vkCode);
    if (it != keyStates.end() && it->second.isPressed) {
        return;
    }

    INPUT input = {0};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = vkCode;
    input.ki.dwFlags = 0; // Key press
    SendInput(1, &input, sizeof(INPUT));
}

void KeyMapping::SimulateKeyRelease(DWORD vkCode) {
    INPUT input = {0};
    input.type = INPUT_KEYBOARD;
    input.ki.wVk = vkCode;
    input.ki.dwFlags = KEYEVENTF_KEYUP;
    SendInput(1, &input, sizeof(INPUT));
}

bool KeyMapping::IsCircularRemap(
    DWORD sourceKey,
    const std::map<std::string, std::vector<std::string>>& remaps,
    std::set<DWORD>& visited,
    int depth,
    int maxDepth
) {
    // Check depth limit
    if (depth >= maxDepth) {
        return true;
    }
    
    // Check for circular reference
    if (visited.find(sourceKey) != visited.end()) {
        return true;
    }
    
    visited.insert(sourceKey);
    
    // Get source key name
    std::string keyName = GetKeyName(sourceKey);
    if (keyName.empty()) {
        visited.erase(sourceKey);
        return false;
    }
    
    // Check remaps for this key
    auto remapIt = remaps.find(keyName);
    if (remapIt == remaps.end()) {
        visited.erase(sourceKey);
        return false;
    }
    
    // Check each target key for circular references
    for (const auto& targetKeyName : remapIt->second) {
        DWORD targetVK = GetVirtualKeyCode(targetKeyName);
        if (targetVK != 0) {
            if (IsCircularRemap(targetVK, remaps, visited, depth + 1, maxDepth)) {
                return true;
            }
        }
    }
    
    visited.erase(sourceKey);
    return false;
}

bool KeyMapping::IsCapsLockRemapped() {
    return capsLockRemapped;
}

void KeyMapping::BlockCapsLockToggle() {
    // Get current state
    bool capsState = (GetKeyState(VK_CAPITAL) & 0x0001) != 0;
    
    // If CapsLock is ON, turn it OFF
    if (capsState) {
        // Simulate CapsLock press and release to toggle it off
        keybd_event(VK_CAPITAL, 0x45, KEYEVENTF_EXTENDEDKEY, 0);
        keybd_event(VK_CAPITAL, 0x45, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    }
}

bool KeyMapping::ShouldReportCapsLock() {
    return reportCapsLock;
}

void KeyMapping::HandleCapsLockRemap(bool isKeyDown) {
    if (isKeyDown) {
        // Block the toggle behavior
        BlockCapsLockToggle();
    }
}

void KeyMapping::UpdateCapsLockState(const std::map<std::string, std::vector<std::string>>& remaps) {
    // Check if CapsLock is being remapped
    auto it = remaps.find("CapsLock");
    if (it == remaps.end()) {
        it = remaps.find("Capital"); // Check alternate name
    }
    
    capsLockRemapped = (it != remaps.end());
    // Only report CapsLock if it's not being remapped to something else
    reportCapsLock = !capsLockRemapped;
} 