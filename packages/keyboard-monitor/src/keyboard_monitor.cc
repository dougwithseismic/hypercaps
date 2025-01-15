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
    if (keyboardHook) {
        UnhookWindowsHookEx(keyboardHook);
        keyboardHook = NULL;
    }
    if (tsfn) {
        tsfn.Release();
    }
}

LRESULT CALLBACK KeyboardMonitor::LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0 && instance) {
        KBDLLHOOKSTRUCT* hookStruct = (KBDLLHOOKSTRUCT*)lParam;
        bool isKeyDown = wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN;
        bool isKeyUp = wParam == WM_KEYUP || wParam == WM_SYSKEYUP;

        if (instance->isEnabled) {
            instance->ProcessKeyEvent(hookStruct->vkCode, isKeyDown);

            // Handle HyperKey functionality
            if (instance->isHyperKeyEnabled && hookStruct->vkCode == instance->hyperKeyTrigger) {
                if (isKeyDown) {
                    // Send modifier keys
                    for (DWORD modifier : instance->modifierKeys) {
                        keybd_event(modifier, 0, 0, 0);
                    }
                    return 1; // Block the original key
                } else if (isKeyUp) {
                    // Release modifier keys in reverse order
                    for (auto it = instance->modifierKeys.rbegin(); it != instance->modifierKeys.rend(); ++it) {
                        keybd_event(*it, 0, KEYEVENTF_KEYUP, 0);
                    }
                    return 1; // Block the original key
                }
            }
        }
    }
    return CallNextHookEx(NULL, nCode, wParam, lParam);
}

void KeyboardMonitor::ProcessKeyEvent(DWORD vkCode, bool isKeyDown) {
    auto now = std::chrono::steady_clock::now();
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()
    ).count();

    if (frames.empty() || 
        std::chrono::duration_cast<std::chrono::milliseconds>(now - lastFrameTime).count() >= FRAME_TIME) {
        // Create new frame
        KeyboardFrame newFrame;
        newFrame.justPressed = std::set<DWORD>();
        newFrame.held = std::set<DWORD>();
        newFrame.justReleased = std::set<DWORD>();
        newFrame.holdDurations = std::map<DWORD, long long>();
        newFrame.timestamp = timestamp;
        newFrame.frameNumber = currentFrame++;
        frames.push(newFrame);
        
        while (frames.size() > 60) { // Keep ~1 second of frames
            frames.pop();
        }
        lastFrameTime = now;
    }

    auto& currentFrame = frames.back();
    
    if (isKeyDown) {
        if (currentFrame.held.find(vkCode) == currentFrame.held.end()) {
            currentFrame.justPressed.insert(vkCode);
            currentFrame.held.insert(vkCode);
        }
    } else {
        if (currentFrame.held.find(vkCode) != currentFrame.held.end()) {
            currentFrame.justReleased.insert(vkCode);
            currentFrame.held.erase(vkCode);
        }
    }

    // Emit frame event
    tsfn.NonBlockingCall([frame = currentFrame](Napi::Env env, Napi::Function jsCallback) {
        auto eventData = Napi::Object::New(env);
        eventData.Set("frame", frame.frameNumber);
        eventData.Set("timestamp", frame.timestamp);
        
        auto state = Napi::Object::New(env);
        
        // Convert sets to arrays
        auto justPressed = Napi::Array::New(env);
        int idx = 0;
        for (const auto& key : frame.justPressed) {
            justPressed[idx++] = Napi::Number::New(env, key);
        }
        state.Set("justPressed", justPressed);

        auto held = Napi::Array::New(env);
        idx = 0;
        for (const auto& key : frame.held) {
            held[idx++] = Napi::Number::New(env, key);
        }
        state.Set("held", held);

        auto justReleased = Napi::Array::New(env);
        idx = 0;
        for (const auto& key : frame.justReleased) {
            justReleased[idx++] = Napi::Number::New(env, key);
        }
        state.Set("justReleased", justReleased);

        auto holdDurations = Napi::Object::New(env);
        for (const auto& pair : frame.holdDurations) {
            holdDurations.Set(std::to_string(pair.first), Napi::Number::New(env, pair.second));
        }
        state.Set("holdDurations", holdDurations);

        eventData.Set("state", state);
        
        jsCallback.Call({Napi::String::New(env, "frame"), eventData});
    });
}

Napi::Value KeyboardMonitor::Start(const Napi::CallbackInfo& info) {
    if (!keyboardHook) {
        keyboardHook = SetWindowsHookEx(
            WH_KEYBOARD_LL,
            LowLevelKeyboardProc,
            GetModuleHandle(NULL),
            0
        );
        
        if (!keyboardHook) {
            Napi::Error::New(info.Env(), "Failed to install keyboard hook")
                .ThrowAsJavaScriptException();
        }
        
        isEnabled = true;
    }
    return info.Env().Undefined();
}

Napi::Value KeyboardMonitor::Stop(const Napi::CallbackInfo& info) {
    if (keyboardHook) {
        UnhookWindowsHookEx(keyboardHook);
        keyboardHook = NULL;
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
    isHyperKeyEnabled = config.Get("isHyperKeyEnabled").ToBoolean();
    
    // Convert trigger key from string to VK code
    std::string triggerKey = config.Get("trigger").ToString();
    DWORD newTrigger = KeyMapping::GetVirtualKeyCode(triggerKey);
    if (newTrigger == 0) {
        Napi::Error::New(env, "Invalid trigger key: " + triggerKey).ThrowAsJavaScriptException();
        return env.Undefined();
    }
    hyperKeyTrigger = newTrigger;
    
    // Convert modifier keys
    Napi::Array modifiers = config.Get("modifiers").As<Napi::Array>();
    modifierKeys.clear();
    for (uint32_t i = 0; i < modifiers.Length(); i++) {
        std::string modifier = modifiers.Get(i).ToString();
        DWORD vkCode = KeyMapping::GetVirtualKeyCode(modifier);
        if (vkCode == 0) {
            Napi::Error::New(env, "Invalid modifier key: " + modifier).ThrowAsJavaScriptException();
            return env.Undefined();
        }
        modifierKeys.insert(vkCode);
    }
    
    return env.Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return KeyboardMonitor::Init(env, exports);
}

NODE_API_MODULE(keyboard_monitor, Init) 