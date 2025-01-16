/**
 * Valid key names that can be used in remapping
 * These match the Windows Virtual Key codes handled in the native module
 */
export declare const VALID_KEY_NAMES: readonly ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "Escape", "Tab", "CapsLock", "Space", "Enter", "Backspace", "Delete", "Insert", "Home", "End", "PageUp", "PageDown", "PrintScreen", "ScrollLock", "Pause", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "LShift", "RShift", "LControl", "RControl", "LAlt", "RAlt", "LWin", "RWin", "NumLock", "NumpadDivide", "NumpadMultiply", "NumpadSubtract", "NumpadAdd", "NumpadEnter", "NumpadDecimal", "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4", "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9", "Semicolon", "Equal", "Comma", "Minus", "Period", "Slash", "Backquote", "BracketLeft", "Backslash", "BracketRight", "Quote"];
export type ValidKeyName = (typeof VALID_KEY_NAMES)[number];
/**
 * Gets all valid key names that can be used in remapping
 */
export declare function getValidKeyNames(): string[];
/**
 * Checks if a key name is valid for remapping
 */
export declare function isValidKeyName(key: string): key is ValidKeyName;
