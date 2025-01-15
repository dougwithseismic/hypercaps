#include "key_mapping.h"
#include <algorithm>
#include <cctype>

std::map<std::string, DWORD> KeyMapping::keyNameToVK;
std::map<DWORD, std::string> KeyMapping::vkToKeyName;
bool KeyMapping::mapsInitialized = false;

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