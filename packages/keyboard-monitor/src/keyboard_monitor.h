#pragma once

#include <napi.h>
#include <windows.h>
#include <set>
#include <queue>
#include <map>
#include <chrono>

// Forward declare the polling thread function
DWORD WINAPI PollingThreadProc(LPVOID param);

struct KeyboardFrame {
    std::set<DWORD> justPressed;
    std::set<DWORD> held;
    std::set<DWORD> justReleased;
    std::map<DWORD, long long> holdDurations;
    long long timestamp;
    int frameNumber;
};

class KeyboardMonitor : public Napi::ObjectWrap<KeyboardMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    KeyboardMonitor(const Napi::CallbackInfo& info);
    ~KeyboardMonitor();

private:
    static KeyboardMonitor* instance;
    static const int FRAME_TIME = 16;
    static const int POLLING_INTERVAL = 8;

    // Thread-safe function for callbacks
    Napi::ThreadSafeFunction tsfn;

    // State
    bool isEnabled = false;
    bool isHyperKeyEnabled = false;
    bool isPolling = false;
    DWORD hyperKeyTrigger = 0;
    std::set<DWORD> modifierKeys;
    HANDLE pollingThread = NULL;
    
    // Frame management
    std::queue<KeyboardFrame> frames;
    int currentFrame = 0;
    std::chrono::steady_clock::time_point lastFrameTime;
    std::chrono::steady_clock::time_point lastPollTime;
    std::map<DWORD, long long> keyPressStartTimes;

    // Methods
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value SetConfig(const Napi::CallbackInfo& info);
    
    void PollKeyboardState();
    void CreateNewFrame(long long timestamp);
    void EmitFrame(const KeyboardFrame& frame);
    void ProcessKeyEvent(DWORD vkCode, bool isKeyDown);

    friend DWORD WINAPI PollingThreadProc(LPVOID param);
}; 