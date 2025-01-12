import React from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "../lib/utils";
import { useKeyboardStore } from "../store/keyboard-store";

// Key name mappings to match Windows.Forms.Keys enum names
const KEY_NAME_MAPPINGS: Record<string, string> = {
  Capital: "CapsLock",
  Menu: "Alt",
  ControlKey: "Control",
  ShiftKey: "Shift",
  LMenu: "Alt",
  RMenu: "Alt",
  LControlKey: "Control",
  RControlKey: "Control",
  LShiftKey: "Shift",
  RShiftKey: "Shift",
  LWin: "Win",
  RWin: "Win",
};

// Helper to normalize key names
const normalizeKeyName = (key: string): string => {
  return KEY_NAME_MAPPINGS[key] || key;
};

interface ModifierDisplayProps {
  modifiers: {
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
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
    ? `HyperKey (${normalizeKeyName(hyperKeyConfig.trigger)})`
    : "HyperKey";

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Badge variant={modifiers.ctrlKey ? "default" : "secondary"}>Ctrl</Badge>
      <Badge variant={modifiers.altKey ? "default" : "secondary"}>Alt</Badge>
      <Badge variant={modifiers.shiftKey ? "default" : "secondary"}>
        Shift
      </Badge>
      <Badge variant={modifiers.metaKey ? "default" : "secondary"}>Win</Badge>
      <Badge
        variant={
          modifiers.hyperKeyActive ||
          (hyperKeyConfig?.trigger &&
            currentKeys.some(
              (key) =>
                normalizeKeyName(key) ===
                normalizeKeyName(hyperKeyConfig.trigger)
            ))
            ? "default"
            : "secondary"
        }
      >
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
  };
  className?: string;
}

// Helper to identify standard modifier keys
const STANDARD_MODIFIER_KEYS = new Set([
  "Control",
  "Alt",
  "Shift",
  "Win",
  "Ctrl",
  "LControl",
  "RControl",
  "LMenu",
  "RMenu",
  "LShift",
  "RShift",
  "LWin",
  "RWin",
  "CapsLock",
  "Capital",
  "ControlKey",
  "ShiftKey",
  "Menu",
]);

export function KeyDisplay({
  currentKeys,
  hyperKeyConfig,
  modifiers,
  className,
}: KeyDisplayProps) {
  // Get active modifier names
  const activeModifiers = [
    modifiers.ctrlKey ? "Ctrl" : null,
    modifiers.altKey ? "Alt" : null,
    modifiers.shiftKey ? "Shift" : null,
    modifiers.metaKey ? "Win" : null,
    modifiers.hyperKeyActive && hyperKeyConfig
      ? `HyperKey (${normalizeKeyName(hyperKeyConfig.trigger)})`
      : modifiers.hyperKeyActive
        ? "HyperKey"
        : null,
  ].filter((mod): mod is string => Boolean(mod));

  // Get non-modifier keys
  const regularKeys = currentKeys
    .filter((key) => {
      const normalizedKey = normalizeKeyName(key);
      return (
        !STANDARD_MODIFIER_KEYS.has(normalizedKey) &&
        (!hyperKeyConfig ||
          normalizedKey !== normalizeKeyName(hyperKeyConfig.trigger))
      );
    })
    .map(normalizeKeyName);

  if (currentKeys.length === 0) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        <span className="text-sm text-muted-foreground">No keys pressed</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      {activeModifiers.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1">
            {activeModifiers.map((mod) => (
              <Badge key={mod} variant="default">
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
            variant="outline"
            className="animate-in fade-in zoom-in"
          >
            {key}
          </Badge>
        ))}
      </div>
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
