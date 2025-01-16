#pragma once

#include <string>
#include <map>
#include <set>
#include <vector>
#include <queue>
#include <windows.h>

struct KeyState {
    bool isPressed;
    bool isModifier;
    long long pressTime;
    std::vector<DWORD> remappedTo;
};

class KeyMapping {
public:
    static DWORD GetVirtualKeyCode(const std::string& keyName);
    static std::string GetKeyName(DWORD vkCode);
    
    // Remap processing
    static void ProcessRemaps(
        const std::map<std::string, std::vector<std::string>>& remaps,
        DWORD vkCode,
        bool isKeyDown,
        int maxChainLength
    );
    
    // Check if a key is being remapped
    static bool IsKeyRemapped(DWORD vkCode);
    
    // Get the remapped keys for a given key
    static std::vector<DWORD> GetRemappedKeys(DWORD vkCode);

    // CapsLock handling
    static bool IsCapsLockRemapped();
    static void BlockCapsLockToggle();
    static bool ShouldReportCapsLock();

private:
    static std::map<std::string, DWORD> keyNameToVK;
    static std::map<DWORD, std::string> vkToKeyName;
    static std::map<DWORD, std::vector<DWORD>> activeRemaps;
    static std::map<DWORD, KeyState> keyStates;
    static std::set<DWORD> processedKeys;
    static std::queue<DWORD> releaseOrder;
    static bool capsLockRemapped;
    static bool reportCapsLock;
    
    static void InitializeMaps();
    static bool mapsInitialized;
    
    // Helper functions for remap processing
    static void SimulateKeyPress(DWORD vkCode);
    static void SimulateKeyRelease(DWORD vkCode);
    static bool IsCircularRemap(
        DWORD sourceKey,
        const std::map<std::string, std::vector<std::string>>& remaps,
        std::set<DWORD>& visited,
        int depth,
        int maxDepth
    );
    
    // Key state management
    static bool IsModifierKey(DWORD vkCode);
    static void TrackKeyPress(DWORD vkCode, const std::vector<DWORD>& remappedKeys);
    static void TrackKeyRelease(DWORD vkCode);
    static void ReleaseRemappedKeys(DWORD vkCode);
    
    // CapsLock helpers
    static void HandleCapsLockRemap(bool isKeyDown);
    static void UpdateCapsLockState(const std::map<std::string, std::vector<std::string>>& remaps);
}; 