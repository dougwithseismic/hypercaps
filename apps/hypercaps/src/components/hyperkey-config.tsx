import { useEffect, useState } from "react";
import { KeyDisplay, WindowsFormsKeyName } from "./key-state-visualizer";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { useKeyboardStore } from "../store/keyboard-store";

interface HyperKeyConfigProps {
  singleKeyMode?: boolean;
  allowedKeys?: WindowsFormsKeyName[];
}

interface HyperKeyConfig {
  enabled: boolean;
  trigger: WindowsFormsKeyName;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
}

interface BufferedKeys {
  trigger: WindowsFormsKeyName | null;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  };
}

// Helper to normalize key names - only handle special cases
const normalizeKeyName = (key: WindowsFormsKeyName): WindowsFormsKeyName => {
  return key;
};

const ALLOWED_TRIGGER_KEYS: WindowsFormsKeyName[] = [
  "CapsLock",
  "LControlKey",
  "RControlKey",
  "LMenu",
  "RMenu",
  "LShiftKey",
  "RShiftKey",
  "LWin",
  "RWin",
];

export function HyperKeyConfig({
  singleKeyMode = false,
  allowedKeys = ALLOWED_TRIGGER_KEYS,
}: HyperKeyConfigProps) {
  const {
    isEnabled,
    isLoading,
    currentKeys,
    modifiers,
    hyperKeyConfig,
    updateHyperKeyConfig,
  } = useKeyboardStore();
  const [isCapturingTrigger, setIsCapturingTrigger] = useState(false);
  const [wasEnabled, setWasEnabled] = useState(false);
  const [bufferedKeys, setBufferedKeys] = useState<BufferedKeys>({
    trigger: null,
    modifiers: {
      ctrl: false,
      alt: false,
      shift: false,
      win: false,
    },
  });

  // Update buffered keys when currentKeys changes during capture
  useEffect(() => {
    if (!isCapturingTrigger) return;

    const lastKey = currentKeys[currentKeys.length - 1];
    if (!lastKey) return;

    if (singleKeyMode) {
      // In single key mode, only allow modifier keys
      if (allowedKeys.includes(lastKey)) {
        setBufferedKeys({
          trigger: lastKey,
          modifiers: {
            ctrl: false,
            alt: false,
            shift: false,
            win: false,
          },
        });
      }
    } else {
      // In combo mode, allow one modifier key as trigger plus optional modifier combinations
      if (allowedKeys.includes(lastKey)) {
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

        setBufferedKeys({
          trigger: lastKey,
          modifiers: {
            ctrl: modifierStates.lctrl || modifierStates.rctrl,
            alt: modifierStates.lalt || modifierStates.ralt,
            shift: modifierStates.lshift || modifierStates.rshift,
            win: modifierStates.lwin || modifierStates.rwin,
          },
        });
      }
    }
  }, [currentKeys, isCapturingTrigger, singleKeyMode, allowedKeys]);

  // Format the key combination string
  const keyComboString = bufferedKeys.trigger
    ? singleKeyMode
      ? normalizeKeyName(bufferedKeys.trigger)
      : [
          bufferedKeys.modifiers.ctrl && ("LControlKey" as const),
          bufferedKeys.modifiers.alt && ("LMenu" as const),
          bufferedKeys.modifiers.shift && ("LShiftKey" as const),
          bufferedKeys.modifiers.win && ("LWin" as const),
          normalizeKeyName(bufferedKeys.trigger),
        ]
          .filter(Boolean)
          .join(" + ")
    : "";

  const handleTriggerCapture = async () => {
    if (!hyperKeyConfig || !bufferedKeys.trigger) return;

    const updatedConfig: HyperKeyConfig = {
      ...hyperKeyConfig,
      enabled: wasEnabled,
      trigger: bufferedKeys.trigger,
      ...(singleKeyMode
        ? {}
        : {
            modifiers: {
              ctrl: bufferedKeys.modifiers.ctrl,
              alt: bufferedKeys.modifiers.alt,
              shift: bufferedKeys.modifiers.shift,
              win: bufferedKeys.modifiers.win,
            },
          }),
    };

    await updateHyperKeyConfig(updatedConfig);
    setIsCapturingTrigger(false);
    setBufferedKeys({
      trigger: null,
      modifiers: {
        ctrl: false,
        alt: false,
        shift: false,
        win: false,
      },
    });
  };

  const handleModifierToggle = async (
    modifier: keyof HyperKeyConfig["modifiers"]
  ) => {
    if (!hyperKeyConfig) return;

    const updatedConfig = {
      ...hyperKeyConfig,
      modifiers: {
        ...hyperKeyConfig.modifiers,
        [modifier]: !hyperKeyConfig.modifiers[modifier],
      },
    };

    await updateHyperKeyConfig(updatedConfig);
  };

  const handleEnableToggle = async () => {
    if (!hyperKeyConfig) return;

    const updatedConfig = {
      ...hyperKeyConfig,
      enabled: !hyperKeyConfig.enabled,
    };

    await updateHyperKeyConfig(updatedConfig);
  };

  const handleDialogClose = () => {
    setIsCapturingTrigger(false);
    setBufferedKeys({
      trigger: null,
      modifiers: {
        ctrl: false,
        alt: false,
        shift: false,
        win: false,
      },
    });
  };

  // Temporarily disable HyperKey during configuration
  const handleOpenDialog = async () => {
    if (!hyperKeyConfig) return;

    // Store current enabled state
    setWasEnabled(hyperKeyConfig.enabled);

    // Only disable if it was enabled
    if (hyperKeyConfig.enabled) {
      const updatedConfig: HyperKeyConfig = {
        ...hyperKeyConfig,
        enabled: false,
      };
      await updateHyperKeyConfig(updatedConfig);
    }
    setIsCapturingTrigger(true);
  };

  // Re-enable HyperKey only if it was enabled before
  const handleDialogCloseWithRestore = async () => {
    handleDialogClose();
    if (!hyperKeyConfig) return;

    // Only re-enable if it was enabled before configuration
    if (wasEnabled) {
      const updatedConfig: HyperKeyConfig = {
        ...hyperKeyConfig,
        enabled: true,
      };
      await updateHyperKeyConfig(updatedConfig);
    }
  };

  if (!hyperKeyConfig) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-background/50 backdrop-blur-md border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">HyperKey Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hyperkey-enabled">Enable HyperKey</Label>
            <Switch
              id="hyperkey-enabled"
              checked={hyperKeyConfig.enabled}
              onCheckedChange={handleEnableToggle}
            />
          </div>

          <div className="space-y-2">
            <Label>Trigger Key</Label>
            <Button
              variant="outline"
              className="justify-between w-full"
              onClick={handleOpenDialog}
              disabled={!isEnabled || isLoading}
            >
              {normalizeKeyName(hyperKeyConfig.trigger)}
              <Badge variant="secondary">Click to Change</Badge>
            </Button>
          </div>

          {!singleKeyMode && (
            <div className="space-y-2">
              <Label>Modifiers to Apply</Label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    hyperKeyConfig.modifiers.ctrl ? "default" : "secondary"
                  }
                  className="cursor-pointer"
                  onClick={() => handleModifierToggle("ctrl")}
                >
                  Ctrl
                </Badge>
                <Badge
                  variant={
                    hyperKeyConfig.modifiers.alt ? "default" : "secondary"
                  }
                  className="cursor-pointer"
                  onClick={() => handleModifierToggle("alt")}
                >
                  Alt
                </Badge>
                <Badge
                  variant={
                    hyperKeyConfig.modifiers.shift ? "default" : "secondary"
                  }
                  className="cursor-pointer"
                  onClick={() => handleModifierToggle("shift")}
                >
                  Shift
                </Badge>
                <Badge
                  variant={
                    hyperKeyConfig.modifiers.win ? "default" : "secondary"
                  }
                  className="cursor-pointer"
                  onClick={() => handleModifierToggle("win")}
                >
                  Win
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCapturingTrigger}
        onOpenChange={handleDialogCloseWithRestore}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Press Any Key</DialogTitle>
            <DialogDescription>
              {singleKeyMode
                ? "Press the key you want to use as the HyperKey trigger."
                : "Press the key combination you want to use as the trigger."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              {bufferedKeys.trigger ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selected Key:</p>
                  <KeyDisplay
                    currentKeys={[bufferedKeys.trigger]}
                    hyperKeyConfig={hyperKeyConfig}
                    modifiers={{
                      ctrlKey: bufferedKeys.modifiers.ctrl,
                      altKey: bufferedKeys.modifiers.alt,
                      shiftKey: bufferedKeys.modifiers.shift,
                      metaKey: bufferedKeys.modifiers.win,
                      hyperKeyActive: false,
                      capsLock: false,
                    }}
                    allowedKeys={allowedKeys}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for key press...
                </p>
              )}
            </div>
            {currentKeys.length > 0 &&
              !allowedKeys.includes(currentKeys[currentKeys.length - 1]) && (
                <div className="p-4 border rounded-lg bg-destructive/10 border-destructive/20">
                  <p className="text-sm font-medium text-destructive">
                    {currentKeys[currentKeys.length - 1]} cannot be used as a
                    trigger key
                  </p>
                  <p className="mt-1 text-xs text-destructive/80">
                    Only modifier keys (Ctrl, Alt, Shift, Win, etc.) can be used
                    as triggers
                  </p>
                </div>
              )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button
                onClick={handleTriggerCapture}
                disabled={!bufferedKeys.trigger}
              >
                Set Key
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
