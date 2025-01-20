#pragma once

#include <napi.h>
#include <windows.h>
#include <set>
#include <queue>
#include <map>
#include <chrono>
#include <string>
#include <vector>
#include <array>
#include <bitset>

// Forward declare the polling thread function
DWORD WINAPI PollingThreadProc(LPVOID param);

struct KeyboardFrame {
    std::bitset<256> justPressed;
    std::bitset<256> held;
    std::bitset<256> justReleased;
    std::array<int, 256> holdDurations;
    long long timestamp;
    int frameNumber;
    struct {
        std::string type;
        DWORD key;
    } event;
    bool gateOpen;
};

class KeyboardMonitor : public Napi::ObjectWrap<KeyboardMonitor> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    KeyboardMonitor(const Napi::CallbackInfo& info);
    ~KeyboardMonitor();

private:
    static KeyboardMonitor* instance;
    int FRAME_TIME_MICROS = 16667;  // Default to 60 FPS (1/60th second in microseconds)
    static const int POLLING_INTERVAL = 8; // 8ms polling (~120Hz) is more reasonable

    // Thread-safe function for callbacks
    Napi::ThreadSafeFunction tsfn;

    // State
    bool isEnabled = false;
    bool isRemapperEnabled = false;
    bool isPolling = false;
    HANDLE pollingThread = NULL;
    
    // oka!
    // Configuration
    std::map<std::string, std::vector<std::string>> remaps;
    int maxRemapChainLength = 5;
    int gateTimeout = 32; // 2 frames at 60fps
    
    // Current frame state
    KeyboardFrame currentFrame;
    int totalFrames = 0;
    std::chrono::steady_clock::time_point lastFrameTime;
    std::chrono::steady_clock::time_point lastPollTime;
    std::chrono::steady_clock::time_point lastKeyEventTime;
    std::array<int, 256> keyPressStartFrames;

    // Gate state
    bool isGateOpen = false;
    
    // Methods
    Napi::Value Start(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value SetConfig(const Napi::CallbackInfo& info);
    
    void PollKeyboardState();
    void CreateNewFrame();
    void EmitFrame(const KeyboardFrame& frame);
    void ProcessKeyEvent(DWORD vkCode, bool isKeyDown);
    int GetFramesSince(int startFrame) const;
    void UpdateGateState();
    void OpenGate();

    friend DWORD WINAPI PollingThreadProc(LPVOID param);
}; 