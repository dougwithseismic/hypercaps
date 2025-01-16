/**
 * Valid key names that can be used in remapping
 * These match the Windows Virtual Key codes handled in the native module
 */
export const VALID_KEY_NAMES = [
  // Letters
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',

  // Numbers
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',

  // Function keys
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',

  // Special keys
  'Escape',
  'Tab',
  'CapsLock',
  'Space',
  'Enter',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'PrintScreen',
  'ScrollLock',
  'Pause',

  // Arrow keys
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',

  // Modifiers
  'LShift',
  'RShift',
  'LControl',
  'RControl',
  'LAlt',
  'RAlt',
  'LWin',
  'RWin',

  // Numpad
  'NumLock',
  'NumpadDivide',
  'NumpadMultiply',
  'NumpadSubtract',
  'NumpadAdd',
  'NumpadEnter',
  'NumpadDecimal',
  'Numpad0',
  'Numpad1',
  'Numpad2',
  'Numpad3',
  'Numpad4',
  'Numpad5',
  'Numpad6',
  'Numpad7',
  'Numpad8',
  'Numpad9',

  // Punctuation and symbols
  'Semicolon',
  'Equal',
  'Comma',
  'Minus',
  'Period',
  'Slash',
  'Backquote',
  'BracketLeft',
  'Backslash',
  'BracketRight',
  'Quote',
] as const;

export type ValidKeyName = (typeof VALID_KEY_NAMES)[number];

/**
 * Gets all valid key names that can be used in remapping
 */
export function getValidKeyNames(): string[] {
  return [...VALID_KEY_NAMES];
}

/**
 * Checks if a key name is valid for remapping
 */
export function isValidKeyName(key: string): key is ValidKeyName {
  return VALID_KEY_NAMES.includes(key as ValidKeyName);
}
