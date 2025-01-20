// This is the keyboard monitor implementation file that handles keyboard input monitoring,
// key event processing, and communication with Node.js through N-API.
// It maintains a circular buffer of keyboard frames and supports key remapping functionality.

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

    // Skip if the key doesn't have a valid mapping
    std::string keyName = KeyMapping::GetKeyName(vkCode);
    if (keyName.empty()) return;

    // Open gate and update last key event time on any key event
    OpenGate();

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
            
            // Update event info
            currentFrame.event.type = "keydown";
            currentFrame.event.key = vkCode;
        }
    } else {
        if (currentFrame.held.find(vkCode) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vkCode);
            currentFrame.held.erase(vkCode);
            keyPressStartFrames.erase(vkCode);
            
            // Update event info
            currentFrame.event.type = "keyup";
            currentFrame.event.key = vkCode;
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

    // Update gate state
    UpdateGateState();

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
                    OpenGate(); // Open gate on new key press
                }
            }
        } else if (currentFrame.held.find(vk) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vk);
            currentFrame.held.erase(vk);
            keyPressStartFrames.erase(vk);
            OpenGate(); // Open gate on key release
        }
    }

    // Update hold durations in frames
    for (const auto& key : currentFrame.held) {
        if (keyPressStartFrames.find(key) != keyPressStartFrames.end()) {
            currentFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
        }
    }

    // Emit frame if gate is open and we've reached the frame time
    if (isGateOpen && frameDelta >= FRAME_TIME_MICROS) {
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
    newFrame.gateOpen = isGateOpen;

    // Copy held keys from previous frame
    if (totalFrames > 1) {
        int prevIndex = (currentFrameIndex - 1 + BUFFER_SIZE) % BUFFER_SIZE;
        newFrame.held = frameBuffer[prevIndex].held;
        
        // Copy hold durations for held keys
        for (const auto& key : newFrame.held) {
            if (keyPressStartFrames.find(key) != keyPressStartFrames.end()) {
                newFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
            }
        }
    }

    lastFrameTime = std::chrono::steady_clock::now();
}

int KeyboardMonitor::GetFramesSince(int startFrame) const {
    return totalFrames - startFrame;
}

void KeyboardMonitor::EmitFrame(const KeyboardFrame& frame) {
    if (!tsfn || !isEnabled) return;

    // Convert VK codes to key names
    auto jsCallback = [this, frame](Napi::Env env, Napi::Function jsCallback) {
        Napi::Object frameObj = Napi::Object::New(env);
        Napi::Object stateObj = Napi::Object::New(env);
        Napi::Array justPressedArr = Napi::Array::New(env);
        Napi::Array heldArr = Napi::Array::New(env);
        Napi::Array justReleasedArr = Napi::Array::New(env);
        Napi::Object holdDurationsObj = Napi::Object::New(env);

        // Convert justPressed VK codes to key names
        uint32_t pressedIndex = 0;
        for (const auto& vk : frame.justPressed) {
            std::string keyName = KeyMapping::GetKeyName(vk);
            if (!keyName.empty()) {
                justPressedArr.Set(pressedIndex++, Napi::String::New(env, keyName));
            }
        }

        // Convert held VK codes to key names
        uint32_t heldIndex = 0;
        for (const auto& vk : frame.held) {
            std::string keyName = KeyMapping::GetKeyName(vk);
            if (!keyName.empty()) {
                heldArr.Set(heldIndex++, Napi::String::New(env, keyName));
            }
        }

        // Convert justReleased VK codes to key names
        uint32_t releasedIndex = 0;
        for (const auto& vk : frame.justReleased) {
            std::string keyName = KeyMapping::GetKeyName(vk);
            if (!keyName.empty()) {
                justReleasedArr.Set(releasedIndex++, Napi::String::New(env, keyName));
            }
        }

        // Convert hold durations
        for (const auto& [vk, duration] : frame.holdDurations) {
            std::string keyName = KeyMapping::GetKeyName(vk);
            if (!keyName.empty()) {
                holdDurationsObj.Set(keyName, Napi::Number::New(env, duration));
            }
        }

        // Build state object
        stateObj.Set("justPressed", justPressedArr);
        stateObj.Set("held", heldArr);
        stateObj.Set("justReleased", justReleasedArr);
        stateObj.Set("holdDurations", holdDurationsObj);
        stateObj.Set("frameNumber", Napi::Number::New(env, frame.frameNumber));

        // Build frame object
        frameObj.Set("frameNumber", Napi::Number::New(env, frame.frameNumber));
        frameObj.Set("timestamp", Napi::Number::New(env, frame.timestamp));
        frameObj.Set("frameTimestamp", Napi::Number::New(env, frame.timestamp));
        frameObj.Set("state", stateObj);
        frameObj.Set("processed", Napi::Boolean::New(env, false));
        frameObj.Set("id", Napi::String::New(env, std::to_string(frame.frameNumber)));
        frameObj.Set("gateOpen", Napi::Boolean::New(env, isGateOpen));

        // Convert event if present
        if (!frame.event.type.empty()) {
            Napi::Object eventObj = Napi::Object::New(env);
            eventObj.Set("type", Napi::String::New(env, frame.event.type));
            std::string keyName = KeyMapping::GetKeyName(frame.event.key);
            if (!keyName.empty()) {
                eventObj.Set("key", Napi::String::New(env, keyName));
            }
            frameObj.Set("event", eventObj);
        }

        jsCallback.Call({Napi::String::New(env, "frame"), frameObj});
    };

    tsfn.BlockingCall(jsCallback);
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
    
    if (info.Length() < 1 || !info[0].IsObject()) {
        Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    Napi::Object config = info[0].As<Napi::Object>();

    // Get remaps if present
    if (config.Has("remaps") && config.Get("remaps").IsObject()) {
        Napi::Object remapsObj = config.Get("remaps").As<Napi::Object>();
        remaps.clear();

        // Convert each remap entry
        auto remapProps = remapsObj.GetPropertyNames();
        for (uint32_t i = 0; i < remapProps.Length(); i++) {
            auto sourceKey = remapProps.Get(i).As<Napi::String>().Utf8Value();
            auto targetValue = remapsObj.Get(sourceKey);

            if (targetValue.IsArray()) {
                auto targetArray = targetValue.As<Napi::Array>();
                std::vector<std::string> targetKeys;

                for (uint32_t j = 0; j < targetArray.Length(); j++) {
                    if (targetArray.Get(j).IsString()) {
                        targetKeys.push_back(targetArray.Get(j).As<Napi::String>().Utf8Value());
                    }
                }

                if (!targetKeys.empty()) {
                    remaps[sourceKey] = targetKeys;
                }
            }
        }
    }

    // Get maxRemapChainLength if present
    if (config.Has("maxRemapChainLength") && config.Get("maxRemapChainLength").IsNumber()) {
        maxRemapChainLength = config.Get("maxRemapChainLength").As<Napi::Number>().Int32Value();
    }

    // Get frameRate if present
    if (config.Has("frameRate") && config.Get("frameRate").IsNumber()) {
        int frameRate = config.Get("frameRate").As<Napi::Number>().Int32Value();
        if (frameRate > 0) {
            FRAME_TIME_MICROS = 1000000 / frameRate;
        }
    }

    // Enable/disable remapper
    if (config.Has("enableRemapper") && config.Get("enableRemapper").IsBoolean()) {
        isRemapperEnabled = config.Get("enableRemapper").As<Napi::Boolean>().Value();
    }

    // Get gateTimeout if present
    if (config.Has("gateTimeout") && config.Get("gateTimeout").IsNumber()) {
        gateTimeout = config.Get("gateTimeout").As<Napi::Number>().Int32Value();
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

void KeyboardMonitor::OpenGate() {
    isGateOpen = true;
    lastKeyEventTime = std::chrono::steady_clock::now();
}

void KeyboardMonitor::UpdateGateState() {
    if (!isGateOpen) return;

    auto now = std::chrono::steady_clock::now();
    auto timeSinceLastEvent = std::chrono::duration_cast<std::chrono::milliseconds>(
        now - lastKeyEventTime
    ).count();

    auto& currentFrame = frameBuffer[currentFrameIndex];
    
    // Keep gate open if any keys are still held
    if (!currentFrame.held.empty()) {
        lastKeyEventTime = now;  // Reset timer while keys are held
        return;
    }

    // Only close gate if no keys are held AND timeout has elapsed
    if (timeSinceLastEvent >= gateTimeout) {
        isGateOpen = false;
    }
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return KeyboardMonitor::Init(env, exports);
}

NODE_API_MODULE(keyboard_monitor, Init) 