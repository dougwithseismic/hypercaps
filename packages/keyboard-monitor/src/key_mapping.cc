#include "key_mapping.h"
#include <algorithm>
#include <cctype>

std::map<std::string, DWORD> KeyMapping::keyNameToVK;
std::map<DWORD, std::string> KeyMapping::vkToKeyName;
bool KeyMapping::mapsInitialized = false;

void KeyMapping::InitializeMaps() {
    if (mapsInitialized) return;

    // Basic keys
    keyNameToVK["CapsLock"] = VK_CAPITAL;
    keyNameToVK["Shift"] = VK_SHIFT;
    keyNameToVK["Control"] = VK_CONTROL;
    keyNameToVK["Alt"] = VK_MENU;
    keyNameToVK["Win"] = VK_LWIN;
    keyNameToVK["Tab"] = VK_TAB;
    keyNameToVK["Enter"] = VK_RETURN;
    keyNameToVK["Space"] = VK_SPACE;
    keyNameToVK["Backspace"] = VK_BACK;
    keyNameToVK["Delete"] = VK_DELETE;
    keyNameToVK["Escape"] = VK_ESCAPE;

    // Left/Right modifiers
    keyNameToVK["LShift"] = VK_LSHIFT;
    keyNameToVK["RShift"] = VK_RSHIFT;
    keyNameToVK["LControl"] = VK_LCONTROL;
    keyNameToVK["RControl"] = VK_RCONTROL;
    keyNameToVK["LAlt"] = VK_LMENU;
    keyNameToVK["RAlt"] = VK_RMENU;
    keyNameToVK["LWin"] = VK_LWIN;
    keyNameToVK["RWin"] = VK_RWIN;

    // Function keys
    for (int i = 1; i <= 12; i++) {
        keyNameToVK["F" + std::to_string(i)] = VK_F1 + i - 1;
    }

    // Number keys
    for (int i = 0; i <= 9; i++) {
        keyNameToVK[std::to_string(i)] = '0' + i;
    }

    // Letter keys
    for (char c = 'A'; c <= 'Z'; c++) {
        keyNameToVK[std::string(1, c)] = c;
    }

    // Navigation keys
    keyNameToVK["Home"] = VK_HOME;
    keyNameToVK["End"] = VK_END;
    keyNameToVK["PageUp"] = VK_PRIOR;
    keyNameToVK["PageDown"] = VK_NEXT;
    keyNameToVK["Insert"] = VK_INSERT;
    keyNameToVK["Left"] = VK_LEFT;
    keyNameToVK["Right"] = VK_RIGHT;
    keyNameToVK["Up"] = VK_UP;
    keyNameToVK["Down"] = VK_DOWN;

    // Create reverse mapping
    for (const auto& [name, vk] : keyNameToVK) {
        vkToKeyName[vk] = name;
    }

    mapsInitialized = true;
}

DWORD KeyMapping::GetVirtualKeyCode(const std::string& keyName) {
    if (!mapsInitialized) InitializeMaps();

    // Convert to uppercase for case-insensitive comparison
    std::string upperKeyName = keyName;
    std::transform(upperKeyName.begin(), upperKeyName.end(), upperKeyName.begin(), ::toupper);

    auto it = keyNameToVK.find(upperKeyName);
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