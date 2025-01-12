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

export function HyperKeyConfig() {
  const {
    isEnabled,
    isLoading,
    currentKeys,
    modifiers,
    hyperKeyConfig,
    updateHyperKeyConfig,
  } = useKeyboardStore();
  const [isCapturingTrigger, setIsCapturingTrigger] = useState(false);

  const handleTriggerCapture = async () => {
    setIsCapturingTrigger(true);
    const firstKey = currentKeys[0];
    if (firstKey && hyperKeyConfig) {
      const updatedConfig = {
        ...hyperKeyConfig,
        trigger: firstKey,
      };
      await updateHyperKeyConfig(updatedConfig);
      setIsCapturingTrigger(false);
    }
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
              className="w-full justify-between"
              onClick={() => setIsCapturingTrigger(true)}
              disabled={!isEnabled || isLoading}
            >
              {normalizeKeyName(hyperKeyConfig.trigger)}
              <Badge variant="secondary">Click to Change</Badge>
            </Button>
          </div>

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
                variant={hyperKeyConfig.modifiers.alt ? "default" : "secondary"}
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
                variant={hyperKeyConfig.modifiers.win ? "default" : "secondary"}
                className="cursor-pointer"
                onClick={() => handleModifierToggle("win")}
              >
                Win
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCapturingTrigger} onOpenChange={setIsCapturingTrigger}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Press Any Key</DialogTitle>
            <DialogDescription>
              Press the key you want to use as the HyperKey trigger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <KeyDisplay
              currentKeys={currentKeys}
              hyperKeyConfig={hyperKeyConfig}
              modifiers={modifiers}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setIsCapturingTrigger(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleTriggerCapture}>Set Key</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
