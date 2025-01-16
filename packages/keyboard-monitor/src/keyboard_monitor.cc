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
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ).count();

    if (frames.empty() || 
        std::chrono::duration_cast<std::chrono::milliseconds>(now - lastFrameTime).count() >= FRAME_TIME) {
        CreateNewFrame(timestamp);
    }

    auto& currentFrame = frames.back();
    
    // Handle remapping if enabled
    if (isRemapperEnabled && !KeyMapping::IsKeyRemapped(vkCode)) {
        KeyMapping::ProcessRemaps(remaps, vkCode, isKeyDown, maxRemapChainLength);
        // If the key was remapped, we don't process it further
        // unless it's CapsLock and we want to report it
        if (KeyMapping::IsKeyRemapped(vkCode) && 
            !(vkCode == VK_CAPITAL && KeyMapping::ShouldReportCapsLock())) {
            return;
        }
    }
    
    if (isKeyDown) {
        if (currentFrame.held.find(vkCode) == currentFrame.held.end()) {
            currentFrame.justPressed.insert(vkCode);
            currentFrame.held.insert(vkCode);
            keyPressStartTimes[vkCode] = timestamp;
        }
    } else {
        if (currentFrame.held.find(vkCode) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vkCode);
            currentFrame.held.erase(vkCode);
            keyPressStartTimes.erase(vkCode);
        }
    }

    // Update hold durations
    for (const auto& key : currentFrame.held) {
        if (keyPressStartTimes.find(key) != keyPressStartTimes.end()) {
            currentFrame.holdDurations[key] = timestamp - keyPressStartTimes[key];
        }
    }

    EmitFrame(currentFrame);
}

void KeyboardMonitor::PollKeyboardState() {
    if (!isEnabled) return;

    auto now = std::chrono::steady_clock::now();
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ).count();

    // Create new frame if needed
    if (frames.empty() || 
        std::chrono::duration_cast<std::chrono::milliseconds>(now - lastFrameTime).count() >= FRAME_TIME) {
        CreateNewFrame(timestamp);
    }

    auto& currentFrame = frames.back();
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
            // Only process keys that have a valid mapping
            std::string keyName = KeyMapping::GetKeyName(vk);
            if (!keyName.empty()) {
                // For CapsLock, only process if we should report it
                if (vk == VK_CAPITAL && !KeyMapping::ShouldReportCapsLock()) {
                    continue;
                }
                
                currentKeys.insert(vk);
                if (currentFrame.held.find(vk) == currentFrame.held.end()) {
                    currentFrame.justPressed.insert(vk);
                    currentFrame.held.insert(vk);
                    keyPressStartTimes[vk] = timestamp;
                }
            }
        } else if (currentFrame.held.find(vk) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vk);
            currentFrame.held.erase(vk);
            keyPressStartTimes.erase(vk);
        }
    }

    // Update hold durations
    for (const auto& key : currentFrame.held) {
        if (keyPressStartTimes.find(key) != keyPressStartTimes.end()) {
            currentFrame.holdDurations[key] = timestamp - keyPressStartTimes[key];
        }
    }

    // Emit frame if there's activity
    if (!currentFrame.justPressed.empty() || !currentFrame.justReleased.empty() || !currentFrame.held.empty()) {
        EmitFrame(currentFrame);
    }

    lastPollTime = now;
}

void KeyboardMonitor::CreateNewFrame(long long timestamp) {
    KeyboardFrame newFrame;
    newFrame.timestamp = timestamp;
    newFrame.frameNumber = currentFrame++;

    // Copy held keys from previous frame
    if (!frames.empty()) {
        newFrame.held = frames.back().held;
    }

    frames.push(newFrame);
    while (frames.size() > 60) {
        frames.pop();
    }
    lastFrameTime = std::chrono::steady_clock::now();
}

void KeyboardMonitor::EmitFrame(const KeyboardFrame& frame) {
    // Debug output
    // printf("\n[DEBUG] Frame %d at %lld\n", frame.frameNumber, frame.timestamp);
    printf("  justPressed: [");
    for (const auto& key : frame.justPressed) {
        std::string keyName = KeyMapping::GetKeyName(key);
        printf("%s(%d) ", keyName.empty() ? "Unknown" : keyName.c_str(), key);
    }
    printf("]\n");
    
    printf("  held: [");
    for (const auto& key : frame.held) {
        std::string keyName = KeyMapping::GetKeyName(key);
        printf("%s(%d) ", keyName.empty() ? "Unknown" : keyName.c_str(), key);
    }
    printf("]\n");
    
    printf("  justReleased: [");
    for (const auto& key : frame.justReleased) {
        std::string keyName = KeyMapping::GetKeyName(key);
        printf("%s(%d) ", keyName.empty() ? "Unknown" : keyName.c_str(), key);
    }
    printf("]\n");
    
    printf("  holdDurations: {");
    for (const auto& pair : frame.holdDurations) {
        std::string keyName = KeyMapping::GetKeyName(pair.first);
        printf("%s(%d):%lld ", keyName.empty() ? "Unknown" : keyName.c_str(), pair.first, pair.second);
    }
    printf("}\n");

    tsfn.NonBlockingCall([frame](Napi::Env env, Napi::Function jsCallback) {
        auto eventData = Napi::Object::New(env);
        eventData.Set("frame", frame.frameNumber);
        eventData.Set("timestamp", frame.timestamp);
        
        // Get the key name and determine event type based on key state
        std::string eventKeyName;
        std::string eventType;
        
        if (!frame.justPressed.empty()) {
            eventKeyName = KeyMapping::GetKeyName(*frame.justPressed.begin());
            eventType = "keydown";
        } else if (!frame.justReleased.empty()) {
            eventKeyName = KeyMapping::GetKeyName(*frame.justReleased.begin());
            eventType = "keyup";
        } else if (!frame.held.empty()) {
            eventKeyName = KeyMapping::GetKeyName(*frame.held.begin());
            eventType = "keyhold";
        }
        
        auto event = Napi::Object::New(env);
        event.Set("type", eventType);
        event.Set("key", Napi::String::New(env, eventKeyName));
        eventData.Set("event", event);

                
        auto state = Napi::Object::New(env);
        
        // Convert sets to arrays with readable key names
        auto justPressed = Napi::Array::New(env);
        int idx = 0;
        for (const auto& key : frame.justPressed) {
            std::string keyName = KeyMapping::GetKeyName(key);
            if (!keyName.empty()) {
                justPressed[idx++] = Napi::String::New(env, keyName);
            }
        }
        state.Set("justPressed", justPressed);

        auto held = Napi::Array::New(env);
        idx = 0;
        for (const auto& key : frame.held) {
            std::string keyName = KeyMapping::GetKeyName(key);
            if (!keyName.empty()) {
                held[idx++] = Napi::String::New(env, keyName);
            }
        }
        state.Set("held", held);

        auto justReleased = Napi::Array::New(env);
        idx = 0;
        for (const auto& key : frame.justReleased) {
            std::string keyName = KeyMapping::GetKeyName(key);
            if (!keyName.empty()) {
                justReleased[idx++] = Napi::String::New(env, keyName);
            }
        }
        state.Set("justReleased", justReleased);

        auto holdDurations = Napi::Object::New(env);
        for (const auto& pair : frame.holdDurations) {
            std::string keyName = KeyMapping::GetKeyName(pair.first);
            if (!keyName.empty()) {
                holdDurations.Set(keyName, Napi::Number::New(env, pair.second));
            }
        }
        state.Set("holdDurations", holdDurations);

        eventData.Set("state", state);
        
        jsCallback.Call({Napi::String::New(env, "frame"), eventData});
    });
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
    bufferWindow = config.Get("bufferWindow").ToNumber().Int32Value();
    maxRemapChainLength = config.Get("maxRemapChainLength").ToNumber().Int32Value();
    
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