#pragma once

#include <string>
#include <map>
#include <windows.h>

class KeyMapping {
public:
    static DWORD GetVirtualKeyCode(const std::string& keyName);
    static std::string GetKeyName(DWORD vkCode);

private:
    static std::map<std::string, DWORD> keyNameToVK;
    static std::map<DWORD, std::string> vkToKeyName;
    static void InitializeMaps();
    static bool mapsInitialized;
}; 