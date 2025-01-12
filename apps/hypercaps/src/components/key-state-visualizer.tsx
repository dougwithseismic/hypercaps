import React from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import { useKeyboardStore } from "../store/keyboard-store";

// Define Windows.Forms.Keys names we use
export type WindowsFormsKeyName =
  | "LControlKey"
  | "RControlKey"
  | "LMenu"
  | "RMenu"
  | "LShiftKey"
  | "RShiftKey"
  | "LWin"
  | "RWin"
  | "CapsLock";

// Helper to identify standard modifier keys
const STANDARD_MODIFIER_KEYS = new Set<WindowsFormsKeyName>([
  "LControlKey",
  "RControlKey",
  "LMenu",
  "RMenu",
  "LShiftKey",
  "RShiftKey",
  "LWin",
  "RWin",
  "CapsLock",
]);

interface ModifierDisplayProps {
  modifiers: {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    capsLock: boolean;
    hyperKeyActive: boolean;
  };
  currentKeys: WindowsFormsKeyName[];
  hyperKeyConfig: {
    enabled: boolean;
    trigger: WindowsFormsKeyName;
    modifiers: {
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      win?: boolean;
    };
  } | null;
  className?: string;
}

export function ModifierDisplay({
  modifiers,
  currentKeys,
  hyperKeyConfig,
  className,
}: ModifierDisplayProps) {
  // Format the HyperKey label
  const hyperKeyLabel = hyperKeyConfig
    ? `HyperKey (${hyperKeyConfig.trigger})`
    : "HyperKey";

  // Get specific modifier states directly from currentKeys
  const modifierStates = {
    lctrl: currentKeys.includes("LControlKey"),
    rctrl: currentKeys.includes("RControlKey"),
    lalt: currentKeys.includes("LMenu"),
    ralt: currentKeys.includes("RMenu"),
    lshift: currentKeys.includes("LShiftKey"),
    rshift: currentKeys.includes("RShiftKey"),
    lwin: currentKeys.includes("LWin"),
    rwin: currentKeys.includes("RWin"),
  };

  // Filter out the HyperKey trigger from being shown separately
  const shouldShowModifier = (key: WindowsFormsKeyName) => {
    if (!hyperKeyConfig?.enabled) return true;
    return key !== hyperKeyConfig.trigger;
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {shouldShowModifier("LControlKey") && (
        <Badge variant={modifierStates.lctrl ? "default" : "secondary"}>
          LControlKey
        </Badge>
      )}
      {shouldShowModifier("RControlKey") && (
        <Badge variant={modifierStates.rctrl ? "default" : "secondary"}>
          RControlKey
        </Badge>
      )}
      {shouldShowModifier("LMenu") && (
        <Badge variant={modifierStates.lalt ? "default" : "secondary"}>
          LMenu
        </Badge>
      )}
      {shouldShowModifier("RMenu") && (
        <Badge variant={modifierStates.ralt ? "default" : "secondary"}>
          RMenu
        </Badge>
      )}
      {shouldShowModifier("LShiftKey") && (
        <Badge variant={modifierStates.lshift ? "default" : "secondary"}>
          LShiftKey
        </Badge>
      )}
      {shouldShowModifier("RShiftKey") && (
        <Badge variant={modifierStates.rshift ? "default" : "secondary"}>
          RShiftKey
        </Badge>
      )}
      {shouldShowModifier("LWin") && (
        <Badge variant={modifierStates.lwin ? "default" : "secondary"}>
          LWin
        </Badge>
      )}
      {shouldShowModifier("RWin") && (
        <Badge variant={modifierStates.rwin ? "default" : "secondary"}>
          RWin
        </Badge>
      )}
      <Badge variant={modifiers.hyperKeyActive ? "default" : "secondary"}>
        {hyperKeyLabel}
      </Badge>
    </div>
  );
}

interface KeyDisplayProps {
  currentKeys: WindowsFormsKeyName[];
  hyperKeyConfig: {
    enabled: boolean;
    trigger: WindowsFormsKeyName;
    modifiers: {
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      win?: boolean;
    };
  } | null;
  modifiers: {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    hyperKeyActive: boolean;
    capsLock: boolean;
  };
  className?: string;
  buffer?: {
    keys: WindowsFormsKeyName[];
    isComplete: boolean;
  };
  allowedKeys?: WindowsFormsKeyName[];
}

export function KeyDisplay({
  currentKeys,
  hyperKeyConfig,
  modifiers,
  className,
  buffer,
  allowedKeys,
}: KeyDisplayProps) {
  // Get specific modifier states directly from currentKeys
  const modifierStates = {
    capsLock: currentKeys.includes("CapsLock"),
    lctrl: currentKeys.includes("LControlKey"),
    rctrl: currentKeys.includes("RControlKey"),
    lalt: currentKeys.includes("LMenu"),
    ralt: currentKeys.includes("RMenu"),
    lshift: currentKeys.includes("LShiftKey"),
    rshift: currentKeys.includes("RShiftKey"),
    lwin: currentKeys.includes("LWin"),
    rwin: currentKeys.includes("RWin"),
  };

  // Track which keys are being shown as modifiers
  const activeModifierKeys = new Set<WindowsFormsKeyName>();

  type ModifierLabel =
    | WindowsFormsKeyName
    | "HyperKey"
    | `HyperKey (${WindowsFormsKeyName})`;

  // Helper to check if a key should be shown
  const shouldShowKey = (key: WindowsFormsKeyName) => {
    if (!hyperKeyConfig?.enabled) return true;
    return key !== hyperKeyConfig.trigger;
  };

  // Get active modifier names
  const activeModifiers = [
    modifierStates.capsLock &&
      shouldShowKey("CapsLock") &&
      ("CapsLock" as const),
    modifierStates.lctrl &&
      shouldShowKey("LControlKey") &&
      ("LControlKey" as const),
    modifierStates.rctrl &&
      shouldShowKey("RControlKey") &&
      ("RControlKey" as const),
    modifierStates.lalt && shouldShowKey("LMenu") && ("LMenu" as const),
    modifierStates.ralt && shouldShowKey("RMenu") && ("RMenu" as const),
    modifierStates.lshift &&
      shouldShowKey("LShiftKey") &&
      ("LShiftKey" as const),
    modifierStates.rshift &&
      shouldShowKey("RShiftKey") &&
      ("RShiftKey" as const),
    modifierStates.lwin && shouldShowKey("LWin") && ("LWin" as const),
    modifierStates.rwin && shouldShowKey("RWin") && ("RWin" as const),
    modifiers.hyperKeyActive && hyperKeyConfig
      ? (`HyperKey (${hyperKeyConfig.trigger})` as const)
      : modifiers.hyperKeyActive
        ? ("HyperKey" as const)
        : null,
  ].filter((mod): mod is ModifierLabel => Boolean(mod));

  // Add active modifiers to our tracking set
  activeModifiers.forEach((key) => {
    // Only add WindowsFormsKeyName keys to the set
    if (
      key !== "HyperKey" &&
      !key.startsWith("HyperKey (") &&
      STANDARD_MODIFIER_KEYS.has(key as WindowsFormsKeyName)
    ) {
      activeModifierKeys.add(key as WindowsFormsKeyName);
    }
  });

  // Get non-modifier keys - use buffer if provided, otherwise use currentKeys
  const keysToDisplay = buffer ? buffer.keys : currentKeys;
  const regularKeys = keysToDisplay.filter(
    (key) =>
      !activeModifierKeys.has(key) && // Don't show keys that are already shown as modifiers
      !STANDARD_MODIFIER_KEYS.has(key) && // Don't show other standard modifier keys
      (!hyperKeyConfig?.enabled || key !== hyperKeyConfig.trigger) // Don't show the hyperkey trigger if enabled
  );

  // Get the last pressed key for invalid key message
  const lastPressedKey = keysToDisplay[keysToDisplay.length - 1];
  const showInvalidKeyMessage =
    lastPressedKey &&
    allowedKeys?.length &&
    !allowedKeys.includes(lastPressedKey);

  if (keysToDisplay.length === 0) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <span className="text-sm text-muted-foreground">No keys pressed</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm">
        {activeModifiers.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1">
              {activeModifiers.map((mod) => (
                <Badge
                  key={mod}
                  variant={
                    mod.startsWith("HyperKey")
                      ? "default"
                      : allowedKeys
                        ? STANDARD_MODIFIER_KEYS.has(
                            mod as WindowsFormsKeyName
                          ) && allowedKeys.includes(mod as WindowsFormsKeyName)
                          ? "secondary"
                          : "destructive"
                        : "secondary"
                  }
                >
                  {mod}
                </Badge>
              ))}
            </div>
            {regularKeys.length > 0 && (
              <span className="text-muted-foreground">+</span>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-1">
          {regularKeys.map((key) => (
            <Badge
              key={key}
              variant={
                buffer?.isComplete
                  ? "secondary"
                  : allowedKeys
                    ? allowedKeys.includes(key)
                      ? "default"
                      : "destructive"
                    : "default"
              }
              className={cn(
                "animate-in fade-in zoom-in",
                buffer?.isComplete && "bg-primary/10"
              )}
            >
              {key}
            </Badge>
          ))}
        </div>
      </div>
      {showInvalidKeyMessage && (
        <div className="text-sm text-destructive">
          This key cannot be used as a trigger
        </div>
      )}
    </div>
  );
}

export function KeyStateVisualizer() {
  const { modifiers, currentKeys, hyperKeyConfig } = useKeyboardStore();

  return (
    <Card className="bg-background/50 backdrop-blur-md border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Current Key States</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ModifierDisplay
          modifiers={modifiers}
          currentKeys={currentKeys}
          hyperKeyConfig={hyperKeyConfig}
        />
        <KeyDisplay
          currentKeys={currentKeys}
          hyperKeyConfig={hyperKeyConfig}
          modifiers={modifiers}
        />
      </CardContent>
    </Card>
  );
}
