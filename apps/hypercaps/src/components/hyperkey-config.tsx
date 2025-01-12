import { useEffect, useState } from "react";
import { KeyDisplay } from "./key-state-visualizer";
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
}

interface HyperKeyConfig {
  enabled: boolean;
  trigger: string;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
}

interface BufferedKeys {
  trigger: string | null;
  modifiers: {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    win: boolean;
  };
}

// Key name mappings to match Windows.Forms.Keys enum names
const KEY_NAME_MAPPINGS: Record<string, string> = {
  Capital: "CapsLock",
};

// Helper to normalize key names - only handle special cases
const normalizeKeyName = (key: string): string => {
  return KEY_NAME_MAPPINGS[key] || key;
};

export function HyperKeyConfig({ singleKeyMode = false }: HyperKeyConfigProps) {
  const {
    isEnabled,
    isLoading,
    currentKeys,
    modifiers,
    hyperKeyConfig,
    updateHyperKeyConfig,
  } = useKeyboardStore();
  const [isCapturingTrigger, setIsCapturingTrigger] = useState(false);
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

    if (singleKeyMode) {
      // In single key mode, just take the last pressed key
      const lastKey = currentKeys[currentKeys.length - 1];
      if (lastKey) {
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
      // In combo mode, separate modifiers from the trigger key
      const nonModifierKeys = currentKeys.filter(
        (key) => !Object.values(KEY_NAME_MAPPINGS).includes(key)
      );
      const lastNonModifierKey = nonModifierKeys[nonModifierKeys.length - 1];

      if (lastNonModifierKey) {
        setBufferedKeys({
          trigger: lastNonModifierKey,
          modifiers: {
            ctrl: modifiers.ctrlKey,
            alt: modifiers.altKey,
            shift: modifiers.shiftKey,
            win: modifiers.metaKey,
          },
        });
      }
    }
  }, [currentKeys, modifiers, isCapturingTrigger, singleKeyMode]);

  const handleTriggerCapture = async () => {
    if (!hyperKeyConfig || !bufferedKeys.trigger) return;

    const updatedConfig = {
      ...hyperKeyConfig,
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
              onClick={() => setIsCapturingTrigger(true)}
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

      <Dialog open={isCapturingTrigger} onOpenChange={handleDialogClose}>
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
              <p className="text-sm font-medium">
                {bufferedKeys.trigger
                  ? `${
                      [
                        bufferedKeys.modifiers.ctrl && "Ctrl",
                        bufferedKeys.modifiers.alt && "Alt",
                        bufferedKeys.modifiers.shift && "Shift",
                        bufferedKeys.modifiers.win && "Win",
                      ]
                        .filter(Boolean)
                        .join(" + ") +
                      (bufferedKeys.modifiers.ctrl ||
                      bufferedKeys.modifiers.alt ||
                      bufferedKeys.modifiers.shift ||
                      bufferedKeys.modifiers.win
                        ? " + "
                        : "") +
                      normalizeKeyName(bufferedKeys.trigger)
                    }`
                  : "Waiting for key press..."}
              </p>
            </div>
            <KeyDisplay
              currentKeys={currentKeys}
              hyperKeyConfig={hyperKeyConfig}
              modifiers={modifiers}
            />
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
