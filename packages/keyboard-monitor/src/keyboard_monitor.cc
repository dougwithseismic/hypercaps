#include "keyboard_monitor.h"
#include "key_mapping.h"

KeyboardMonitor* KeyboardMonitor::instance = nullptr;

Napi::Object KeyboardMonitor::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "KeyboardMonitor", {
        InstanceMethod("start", &KeyboardMonitor::Start),
        InstanceMethod("stop", &KeyboardMonitor::Stop),
        InstanceMethod("setConfig", &KeyboardMonitor::SetConfig),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("KeyboardMonitor", func);
    return exports;
}

KeyboardMonitor::KeyboardMonitor(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<KeyboardMonitor>(info) {
    instance = this;
    Napi::Env env = info.Env();

    // Create thread-safe function for emitting events
    tsfn = Napi::ThreadSafeFunction::New(
        env,
        info[0].As<Napi::Function>(),  // JavaScript callback
        "KeyboardCallback",            // Resource name
        0,                            // Max queue size (0 = unlimited)
        1                             // Initial thread count
    );
}

KeyboardMonitor::~KeyboardMonitor() {
    if (isPolling) {
        isPolling = false;
        WaitForSingleObject(pollingThread, INFINITE);
        CloseHandle(pollingThread);
    }
    if (tsfn) {
        tsfn.Release();
    }
}

void KeyboardMonitor::ProcessKeyEvent(DWORD vkCode, bool isKeyDown) {
    if (!isEnabled) return;

    auto now = std::chrono::steady_clock::now();
    auto frameDelta = std::chrono::duration_cast<std::chrono::microseconds>(
        now - lastFrameTime
    ).count();

    // Create new frame if needed
    if (frameDelta >= FRAME_TIME_MICROS) {
        CreateNewFrame();
    }

    auto& currentFrame = frameBuffer[currentFrameIndex];
    
    // Handle remapping if enabled
    if (isRemapperEnabled && !KeyMapping::IsKeyRemapped(vkCode)) {
        KeyMapping::ProcessRemaps(remaps, vkCode, isKeyDown, maxRemapChainLength);
        if (KeyMapping::IsKeyRemapped(vkCode) && 
            !(vkCode == VK_CAPITAL && KeyMapping::ShouldReportCapsLock())) {
            return;
        }
    }
    
    if (isKeyDown) {
        if (currentFrame.held.find(vkCode) == currentFrame.held.end()) {
            currentFrame.justPressed.insert(vkCode);
            currentFrame.held.insert(vkCode);
            keyPressStartFrames[vkCode] = totalFrames;
        }
    } else {
        if (currentFrame.held.find(vkCode) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vkCode);
            currentFrame.held.erase(vkCode);
            keyPressStartFrames.erase(vkCode);
        }
    }

    // Update hold durations in frames
    for (const auto& key : currentFrame.held) {
        if (keyPressStartFrames.find(key) != keyPressStartFrames.end()) {
            currentFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
        }
    }

    EmitFrame(currentFrame);
}

void KeyboardMonitor::PollKeyboardState() {
    if (!isEnabled) return;

    auto now = std::chrono::steady_clock::now();
    auto frameDelta = std::chrono::duration_cast<std::chrono::microseconds>(
        now - lastFrameTime
    ).count();

    // Create new frame if needed
    if (frameDelta >= FRAME_TIME_MICROS) {
        CreateNewFrame();
    }

    auto& currentFrame = frameBuffer[currentFrameIndex];
    std::set<DWORD> currentKeys;

    // Check all possible virtual key codes
    for (int vk = 0; vk < 256; vk++) {
        // Skip invalid or system keys
        if (vk == 0 || vk == VK_PACKET || 
            (vk >= VK_LBUTTON && vk <= VK_XBUTTON2) || // Skip mouse buttons
            vk == VK_CANCEL || vk == VK_MODECHANGE ||
            vk == VK_CLEAR || vk == VK_SELECT ||
            vk == VK_EXECUTE || vk == VK_HELP ||
            (vk >= VK_BROWSER_BACK && vk <= VK_LAUNCH_APP2) || // Skip browser/media keys
            (vk >= VK_PROCESSKEY && vk <= VK_PACKET) || // Skip IME keys
            vk == VK_ATTN || vk == VK_CRSEL || vk == VK_EXSEL ||
            vk == VK_EREOF || vk == VK_PLAY || vk == VK_ZOOM ||
            vk == VK_NONAME || vk == VK_PA1) {
            continue;
        }

        SHORT keyState = GetAsyncKeyState(vk);
        if (keyState & 0x8000) { // Key is pressed
            std::string keyName = KeyMapping::GetKeyName(vk);
            if (!keyName.empty()) {
                if (vk == VK_CAPITAL && !KeyMapping::ShouldReportCapsLock()) {
                    continue;
                }
                
                currentKeys.insert(vk);
                if (currentFrame.held.find(vk) == currentFrame.held.end()) {
                    currentFrame.justPressed.insert(vk);
                    currentFrame.held.insert(vk);
                    keyPressStartFrames[vk] = totalFrames;
                }
            }
        } else if (currentFrame.held.find(vk) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vk);
            currentFrame.held.erase(vk);
            keyPressStartFrames.erase(vk);
        }
    }

    // Update hold durations in frames
    for (const auto& key : currentFrame.held) {
        if (keyPressStartFrames.find(key) != keyPressStartFrames.end()) {
            currentFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
        }
    }

    // Emit frame if there's activity
    if (!currentFrame.justPressed.empty() || !currentFrame.justReleased.empty() || !currentFrame.held.empty()) {
        EmitFrame(currentFrame);
    }

    lastPollTime = now;
}

void KeyboardMonitor::CreateNewFrame() {
    // Move to next frame in circular buffer
    currentFrameIndex = (currentFrameIndex + 1) % BUFFER_SIZE;
    totalFrames++;

    // Initialize new frame
    auto& newFrame = frameBuffer[currentFrameIndex];
    newFrame = KeyboardFrame(); // Clear previous frame data
    newFrame.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()
    ).count();
    newFrame.frameNumber = totalFrames;

    // Copy held keys from previous frame
    if (totalFrames > 1) {
        int prevIndex = (currentFrameIndex - 1 + BUFFER_SIZE) % BUFFER_SIZE;
        newFrame.held = frameBuffer[prevIndex].held;
    }

    lastFrameTime = std::chrono::steady_clock::now();
}

int KeyboardMonitor::GetFramesSince(int startFrame) const {
    return totalFrames - startFrame;
}

void KeyboardMonitor::EmitFrame(const KeyboardFrame& frame) {
    // Create JavaScript frame object
    auto callback = [frame](Napi::Env env, Napi::Function jsCallback) {
        auto eventData = Napi::Object::New(env);
        eventData.Set("frame", frame.frameNumber);
        eventData.Set("timestamp", frame.timestamp);

        // Create state object
        auto state = Napi::Object::New(env);
        
        // Convert sets to arrays
        auto justPressed = Napi::Array::New(env);
        int index = 0;
        for (const auto& key : frame.justPressed) {
            justPressed[index++] = key;
        }
        state.Set("justPressed", justPressed);

        auto held = Napi::Array::New(env);
        index = 0;
        for (const auto& key : frame.held) {
            held[index++] = key;
        }
        state.Set("held", held);

        auto justReleased = Napi::Array::New(env);
        index = 0;
        for (const auto& key : frame.justReleased) {
            justReleased[index++] = key;
        }
        state.Set("justReleased", justReleased);

        // Convert hold durations
        auto holdDurations = Napi::Object::New(env);
        for (const auto& pair : frame.holdDurations) {
            holdDurations.Set(std::to_string(pair.first), pair.second);
        }
        state.Set("holdDurations", holdDurations);

        eventData.Set("state", state);

        // Call JavaScript callback
        jsCallback.Call({Napi::String::New(env, "frame"), eventData});
    };

    tsfn.NonBlockingCall(callback);
}

Napi::Value KeyboardMonitor::Start(const Napi::CallbackInfo& info) {
    if (!isPolling) {
        isPolling = true;
        pollingThread = CreateThread(
            NULL,
            0,
            PollingThreadProc,
            this,
            0,
            NULL
        );
        
        if (!pollingThread) {
            Napi::Error::New(info.Env(), "Failed to start polling thread")
                .ThrowAsJavaScriptException();
        }
        
        isEnabled = true;
    }
    return info.Env().Undefined();
}

Napi::Value KeyboardMonitor::Stop(const Napi::CallbackInfo& info) {
    if (isPolling) {
        isPolling = false;
        WaitForSingleObject(pollingThread, INFINITE);
        CloseHandle(pollingThread);
        pollingThread = NULL;
        isEnabled = false;
    }
    return info.Env().Undefined();
}

Napi::Value KeyboardMonitor::SetConfig(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (!info[0].IsObject()) {
        Napi::TypeError::New(env, "Config must be an object").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object config = info[0].As<Napi::Object>();
    
    // Update configuration
    isEnabled = config.Get("isEnabled").ToBoolean();
    isRemapperEnabled = config.Get("isRemapperEnabled").ToBoolean();
    
    // Get remap configuration
    Napi::Object remapsObj = config.Get("remaps").ToObject();
    remaps.clear();
    
    auto remapProps = remapsObj.GetPropertyNames();
    for (uint32_t i = 0; i < remapProps.Length(); i++) {
        std::string fromKey = remapProps.Get(i).ToString();
        Napi::Array toKeys = remapsObj.Get(fromKey).As<Napi::Array>();
        
        std::vector<std::string> targetKeys;
        for (uint32_t j = 0; j < toKeys.Length(); j++) {
            targetKeys.push_back(toKeys.Get(j).ToString());
        }
        
        remaps[fromKey] = targetKeys;
    }
    
    // Get behavior configuration
    std::string capsLockBehavior = config.Get("capsLockBehavior").ToString();
    if (capsLockBehavior == "None") {
        // Handle None behavior
    } else if (capsLockBehavior == "DoublePress") {
        // Handle DoublePress behavior
    } else if (capsLockBehavior == "BlockToggle") {
        // Handle BlockToggle behavior
    }
    
    // Get timing configuration
    maxRemapChainLength = config.Get("maxRemapChainLength").ToNumber().Int32Value();

    // Handle frame-based configuration
    if (config.Has("frameRate")) {
        int frameRate = config.Get("frameRate").ToNumber().Int32Value();
        FRAME_TIME_MICROS = static_cast<int>(1000000.0 / frameRate);  // Convert to microseconds
    }

    if (config.Has("frameBufferSize")) {
        // Note: We can't change BUFFER_SIZE at runtime as it's a static const
        // But we can use it to validate the configuration
        int requestedSize = config.Get("frameBufferSize").ToNumber().Int32Value();
        if (requestedSize > BUFFER_SIZE) {
            Napi::Error::New(env, "Requested frame buffer size exceeds maximum").ThrowAsJavaScriptException();
            return env.Undefined();
        }
    }
    
    return env.Undefined();
}

DWORD WINAPI PollingThreadProc(LPVOID param) {
    KeyboardMonitor* monitor = (KeyboardMonitor*)param;
    while (monitor->isPolling) {
        monitor->PollKeyboardState();
        Sleep(KeyboardMonitor::POLLING_INTERVAL);
    }
    return 0;
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return KeyboardMonitor::Init(env, exports);
}

NODE_API_MODULE(keyboard_monitor, Init) 