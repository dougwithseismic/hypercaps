#pragma once

#include <napi.h>
#include <windows.h>
#include <set>
#include <queue>
#include <map>
#include <chrono>
#include <string>
#include <vector>

// Forward declare the polling thread function
DWORD WINAPI PollingThreadProc(LPVOID param);

struct KeyboardFrame {
    std::set<DWORD> justPressed;
    std::set<DWORD> held;
    std::set<DWORD> justReleased;
    std::map<DWORD, long long> holdDurations;
    long long timestamp;
    int frameNumber;
    struct {
        std::string type;
        DWORD key;
    } event;
};

class KeyboardMonitor : public Napi::ObjectWrap<KeyboardMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    KeyboardMonitor(const Napi::CallbackInfo& info);
    ~KeyboardMonitor();

private:
    static KeyboardMonitor* instance;
    static const int FRAME_TIME = 16.67;
    static const int POLLING_INTERVAL = 1;

    // Thread-safe function for callbacks
    Napi::ThreadSafeFunction tsfn;

    // State
    bool isEnabled = false;
    bool isRemapperEnabled = false;
    bool isPolling = false;
    HANDLE pollingThread = NULL;
    
    // Configuration
    std::map<std::string, std::vector<std::string>> remaps;
    int bufferWindow = 3000;
    int maxRemapChainLength = 5;
    
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