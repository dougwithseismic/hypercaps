import React from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import { useKeyboardStore } from "../store/keyboard-store";

// Helper to identify standard modifier keys
const STANDARD_MODIFIER_KEYS = new Set([
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
  currentKeys: string[];
  hyperKeyConfig: {
    enabled: boolean;
    trigger: string;
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

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Badge variant={modifierStates.lctrl ? "default" : "secondary"}>
        LControlKey
      </Badge>
      <Badge variant={modifierStates.rctrl ? "default" : "secondary"}>
        RControlKey
      </Badge>
      <Badge variant={modifierStates.lalt ? "default" : "secondary"}>
        LMenu
      </Badge>
      <Badge variant={modifierStates.ralt ? "default" : "secondary"}>
        RMenu
      </Badge>
      <Badge variant={modifierStates.lshift ? "default" : "secondary"}>
        LShiftKey
      </Badge>
      <Badge variant={modifierStates.rshift ? "default" : "secondary"}>
        RShiftKey
      </Badge>
      <Badge variant={modifierStates.lwin ? "default" : "secondary"}>
        LWin
      </Badge>
      <Badge variant={modifierStates.rwin ? "default" : "secondary"}>
        RWin
      </Badge>
      <Badge variant={modifiers.hyperKeyActive ? "default" : "secondary"}>
        {hyperKeyLabel}
      </Badge>
    </div>
  );
}

interface KeyDisplayProps {
  currentKeys: string[];
  hyperKeyConfig: {
    enabled: boolean;
    trigger: string;
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
    keys: string[];
    isComplete: boolean;
  };
  allowedKeys?: string[];
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
  const activeModifierKeys = new Set<string>();

  // Get active modifier names
  const activeModifiers = [
    modifierStates.capsLock && "CapsLock",
    modifierStates.lctrl && "LControlKey",
    modifierStates.rctrl && "RControlKey",
    modifierStates.lalt && "LMenu",
    modifierStates.ralt && "RMenu",
    modifierStates.lshift && "LShiftKey",
    modifierStates.rshift && "RShiftKey",
    modifierStates.lwin && "LWin",
    modifierStates.rwin && "RWin",
    modifiers.hyperKeyActive && hyperKeyConfig
      ? `HyperKey (${hyperKeyConfig.trigger})`
      : modifiers.hyperKeyActive
        ? "HyperKey"
        : null,
  ].filter((mod): mod is string => Boolean(mod));

  // Add active modifiers to our tracking set
  activeModifiers.forEach((key) => {
    if (key !== "HyperKey" && !key.startsWith("HyperKey (")) {
      activeModifierKeys.add(key);
    }
  });

  // Get non-modifier keys - use buffer if provided, otherwise use currentKeys
  const keysToDisplay = buffer ? buffer.keys : currentKeys;
  const regularKeys = keysToDisplay.filter(
    (key) =>
      !activeModifierKeys.has(key) && // Don't show keys that are already shown as modifiers
      !STANDARD_MODIFIER_KEYS.has(key) && // Don't show other standard modifier keys
      (!hyperKeyConfig || key !== hyperKeyConfig.trigger) // Don't show the hyperkey trigger
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
                        ? allowedKeys.includes(mod)
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
        <p className="text-sm text-destructive">
          {lastPressedKey} cannot be used as a trigger key
        </p>
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
