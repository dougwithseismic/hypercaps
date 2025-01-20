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

    // ALWAYS create a new frame for key events to ensure we don't miss any
    CreateNewFrame();
    OpenGate();

    // Handle remapping if enabled
    if (isRemapperEnabled && !KeyMapping::IsKeyRemapped(vkCode)) {
        KeyMapping::ProcessRemaps(remaps, vkCode, isKeyDown, maxRemapChainLength);
        if (KeyMapping::IsKeyRemapped(vkCode) && 
            !(vkCode == VK_CAPITAL && KeyMapping::ShouldReportCapsLock())) {
            return;
        }
    }
    
    if (isKeyDown) {
        if (!currentFrame.held[vkCode]) {
            currentFrame.justPressed[vkCode] = true;
            currentFrame.held[vkCode] = true;
            keyPressStartFrames[vkCode] = totalFrames;
            
            // Update event info
            currentFrame.event.type = "keydown";
            currentFrame.event.key = vkCode;
            
            // Important: Emit the press frame immediately
            EmitFrame(currentFrame);
        }
    } else {
        if (currentFrame.held[vkCode]) {
            currentFrame.justReleased[vkCode] = true;
            currentFrame.held[vkCode] = false;
            keyPressStartFrames[vkCode] = 0;
            
            // Update event info
            currentFrame.event.type = "keyup";
            currentFrame.event.key = vkCode;
            
            // Important: Emit the release frame even if it's very close to the press
            EmitFrame(currentFrame);
        }
    }

    // Update hold durations
    for (size_t key = 0; key < 256; key++) {
        if (currentFrame.held[key]) {
            currentFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
        }
    }
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

    bool shouldEmitFrame = false;

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
        bool isPressed = (keyState & 0x8000) != 0;
        
        std::string keyName = KeyMapping::GetKeyName(vk);
        if (keyName.empty()) continue;

        if (vk == VK_CAPITAL && !KeyMapping::ShouldReportCapsLock()) {
            continue;
        }

        // Key is pressed
        if (isPressed) {
            if (!currentFrame.held[vk]) {
                // This is a new press
                currentFrame.justPressed[vk] = true;
                currentFrame.held[vk] = true;
                keyPressStartFrames[vk] = totalFrames;
                OpenGate();
                shouldEmitFrame = true;
            }
        } 
        // Key is released
        else if (currentFrame.held[vk]) {
            currentFrame.justReleased[vk] = true;
            currentFrame.held[vk] = false;
            keyPressStartFrames[vk] = 0;
            OpenGate();
            shouldEmitFrame = true;
        }
    }

    // Update hold durations
    for (size_t key = 0; key < 256; key++) {
        if (currentFrame.held[key]) {
            currentFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
        }
    }

    // Emit frame if we have new presses/releases or if enough time has passed
    if (shouldEmitFrame || (isGateOpen && frameDelta >= FRAME_TIME_MICROS)) {
        EmitFrame(currentFrame);
    }

    lastPollTime = now;
}

void KeyboardMonitor::CreateNewFrame() {
    totalFrames++;

    // Clear previous frame data but maintain held keys
    auto heldKeys = currentFrame.held;
    currentFrame = KeyboardFrame();
    currentFrame.held = heldKeys;
    currentFrame.timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()
    ).count();
    currentFrame.frameNumber = totalFrames;
    currentFrame.gateOpen = isGateOpen;

    // Update hold durations for held keys
    for (size_t key = 0; key < 256; key++) {
        if (currentFrame.held[key]) {
            currentFrame.holdDurations[key] = GetFramesSince(keyPressStartFrames[key]);
        }
    }

    lastFrameTime = std::chrono::steady_clock::now();
}

int KeyboardMonitor::GetFramesSince(int startFrame) const {
    return totalFrames - startFrame;
}

void KeyboardMonitor::EmitFrame(const KeyboardFrame& frame) {
    if (!tsfn || !isEnabled) return;

    auto jsCallback = [this, frame](Napi::Env env, Napi::Function jsCallback) {
        Napi::Object frameObj = Napi::Object::New(env);
        Napi::Object stateObj = Napi::Object::New(env);
        Napi::Array justPressedArr = Napi::Array::New(env);
        Napi::Array heldArr = Napi::Array::New(env);
        Napi::Array justReleasedArr = Napi::Array::New(env);
        Napi::Object holdDurationsObj = Napi::Object::New(env);

        // Convert justPressed bits to key names
        uint32_t pressedIndex = 0;
        for (size_t i = 0; i < 256; i++) {
            if (frame.justPressed[i]) {
                std::string keyName = KeyMapping::GetKeyName(i);
                if (!keyName.empty()) {
                    justPressedArr.Set(pressedIndex++, Napi::String::New(env, keyName));
                }
            }
        }

        // Convert held bits to key names
        uint32_t heldIndex = 0;
        for (size_t i = 0; i < 256; i++) {
            if (frame.held[i]) {
                std::string keyName = KeyMapping::GetKeyName(i);
                if (!keyName.empty()) {
                    heldArr.Set(heldIndex++, Napi::String::New(env, keyName));
                }
            }
        }

        // Convert justReleased bits to key names
        uint32_t releasedIndex = 0;
        for (size_t i = 0; i < 256; i++) {
            if (frame.justReleased[i]) {
                std::string keyName = KeyMapping::GetKeyName(i);
                if (!keyName.empty()) {
                    justReleasedArr.Set(releasedIndex++, Napi::String::New(env, keyName));
                }
            }
        }

        // Convert hold durations
        for (size_t i = 0; i < 256; i++) {
            if (frame.holdDurations[i] > 0) {
                std::string keyName = KeyMapping::GetKeyName(i);
                if (!keyName.empty()) {
                    holdDurationsObj.Set(keyName, Napi::Number::New(env, frame.holdDurations[i]));
                }
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

    // Keep gate open if any keys are still held
    if (!currentFrame.held.any()) {
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