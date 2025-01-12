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

  // Get specific modifier states from currentKeys
  const leftCtrl = currentKeys.includes("LControlKey");
  const rightCtrl = currentKeys.includes("RControlKey");
  const leftAlt = currentKeys.includes("LMenu");
  const rightAlt = currentKeys.includes("RMenu");
  const leftShift = currentKeys.includes("LShiftKey");
  const rightShift = currentKeys.includes("RShiftKey");
  const win = currentKeys.some((key) => key === "LWin" || key === "RWin");

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Badge variant={leftCtrl ? "default" : "secondary"}>L-Ctrl</Badge>
      <Badge variant={rightCtrl ? "default" : "secondary"}>R-Ctrl</Badge>
      <Badge variant={leftAlt ? "default" : "secondary"}>L-Alt</Badge>
      <Badge variant={rightAlt ? "default" : "secondary"}>R-Alt</Badge>
      <Badge variant={leftShift ? "default" : "secondary"}>L-Shift</Badge>
      <Badge variant={rightShift ? "default" : "secondary"}>R-Shift</Badge>
      <Badge variant={win ? "default" : "secondary"}>Win</Badge>
      <Badge
        variant={
          modifiers.hyperKeyActive ||
          (hyperKeyConfig?.trigger &&
            currentKeys.includes(hyperKeyConfig.trigger))
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
    capsLock: boolean;
  };
  className?: string;
}

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
      ? `HyperKey (${hyperKeyConfig.trigger})`
      : modifiers.hyperKeyActive
        ? "HyperKey"
        : null,
  ].filter((mod): mod is string => Boolean(mod));

  // Get non-modifier keys
  const regularKeys = currentKeys.filter(
    (key) =>
      !STANDARD_MODIFIER_KEYS.has(key) &&
      (!hyperKeyConfig || key !== hyperKeyConfig.trigger)
  );
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
