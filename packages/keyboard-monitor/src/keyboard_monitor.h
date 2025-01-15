#pragma once

#include <napi.h>
#include <windows.h>
#include <set>
#include <string>
#include <queue>
#include <chrono>
#include <map>

class KeyboardMonitor : public Napi::ObjectWrap<KeyboardMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    KeyboardMonitor(const Napi::CallbackInfo& info);
    ~KeyboardMonitor();

private:
    static LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam);
    static KeyboardMonitor* instance;

    // N-API methods
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value SetConfig(const Napi::CallbackInfo& info);
    
    // Internal methods
    void ProcessKeyEvent(DWORD vkCode, bool isKeyDown);
    void EmitKeyboardEvent(const std::string& eventName, const Napi::Object& eventData);
    
    // State
    bool isEnabled = false;
    bool isHyperKeyEnabled = false;
    DWORD hyperKeyTrigger = VK_CAPITAL; // Default to CapsLock
    std::set<DWORD> modifierKeys;
    HHOOK keyboardHook = NULL;
    Napi::ThreadSafeFunction tsfn;
    
    // Frame tracking
    struct KeyboardFrame {
        std::set<DWORD> justPressed;
        std::set<DWORD> held;
        std::set<DWORD> justReleased;
        std::map<DWORD, long long> holdDurations;
        long long timestamp;
        int frameNumber;
    };
    
    std::queue<KeyboardFrame> frames;
    int currentFrame = 0;
    std::chrono::steady_clock::time_point lastFrameTime;
    static constexpr long long FRAME_TIME = 16; // ~60fps
}; 