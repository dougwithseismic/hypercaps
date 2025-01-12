import { useEffect, useState } from "react";
import { useKeyboard } from "../contexts/keyboard-context";
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
  const { state: keyboardState } = useKeyboard();
  const [config, setConfig] = useState<HyperKeyConfig>();
  const [isCapturingTrigger, setIsCapturingTrigger] = useState(false);

  // Load initial config
  useEffect(() => {
    loadConfig();
  }, []);

  // Effect to capture trigger key
  useEffect(() => {
    if (!isCapturingTrigger || !config) return;

    const { currentKeys } = keyboardState;
    if (currentKeys.length === 1) {
      const newTrigger = normalizeKeyName(currentKeys[0]);
      handleTriggerUpdate(newTrigger);
      setIsCapturingTrigger(false);
    }
  }, [keyboardState, isCapturingTrigger, config]);

  const loadConfig = async () => {
    try {
      const config = await window.api.getHyperKeyConfig();
      setConfig(config);
    } catch (err) {
      console.error("Failed to load HyperKey config:", err);
    }
  };

  const handleTriggerCapture = () => {
    setIsCapturingTrigger(true);
  };

  const handleTriggerUpdate = async (newTrigger: string) => {
    if (!config) return;

    try {
      const newConfig = {
        ...config,
        trigger: newTrigger,
      };
      await window.api.updateHyperKeyConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      console.error("Failed to update trigger key:", err);
    }
  };

  const handleModifierToggle = async (
    modifier: keyof HyperKeyConfig["modifiers"]
  ) => {
    if (!config) return;

    try {
      const newConfig = {
        ...config,
        modifiers: {
          ...config.modifiers,
          [modifier]: !config.modifiers[modifier],
        },
      };
      await window.api.updateHyperKeyConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      console.error("Failed to update HyperKey config:", err);
    }
  };

  const handleEnableToggle = async () => {
    if (!config) return;

    try {
      const newConfig = {
        ...config,
        enabled: !config.enabled,
      };
      await window.api.updateHyperKeyConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      console.error("Failed to update HyperKey config:", err);
    }
  };

  return (
    <Card className="bg-background/50 backdrop-blur-md border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>HyperKey Configuration</span>
          <Switch
            checked={config?.enabled ?? false}
            onCheckedChange={handleEnableToggle}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trigger Key Section */}
        <div className="space-y-2">
          <Label>Trigger Key</Label>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-4 py-2 text-lg">
              {config?.trigger || "Not Set"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerCapture}
              className="ml-2"
            >
              Change
            </Button>
          </div>
        </div>

        {/* Modifier Mappings Section */}
        <div className="space-y-2">
          <Label>When pressed, simulate:</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="ctrl"
                checked={config?.modifiers.ctrl ?? false}
                onCheckedChange={() => handleModifierToggle("ctrl")}
              />
              <Label htmlFor="ctrl">Control</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="alt"
                checked={config?.modifiers.alt ?? false}
                onCheckedChange={() => handleModifierToggle("alt")}
              />
              <Label htmlFor="alt">Alt</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="shift"
                checked={config?.modifiers.shift ?? false}
                onCheckedChange={() => handleModifierToggle("shift")}
              />
              <Label htmlFor="shift">Shift</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="win"
                checked={config?.modifiers.win ?? false}
                onCheckedChange={() => handleModifierToggle("win")}
              />
              <Label htmlFor="win">Windows</Label>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="pt-4 space-y-2 border-t">
          <Label>Preview</Label>
          <div className="p-4 rounded-lg bg-muted/50">
            <KeyDisplay
              currentKeys={[config?.trigger || ""]}
              modifiers={{
                ctrlKey: config?.modifiers.ctrl ?? false,
                altKey: config?.modifiers.alt ?? false,
                shiftKey: config?.modifiers.shift ?? false,
                metaKey: config?.modifiers.win ?? false,
                hyperKeyActive: false,
              }}
              hyperKeyConfig={config}
            />
          </div>
        </div>
      </CardContent>

      {/* Trigger Key Capture Dialog */}
      <Dialog open={isCapturingTrigger} onOpenChange={setIsCapturingTrigger}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Press New Trigger Key</DialogTitle>
            <DialogDescription>
              Press the key you want to use as your HyperKey trigger.
              {keyboardState.currentKeys.length > 0 && (
                <div className="mt-2 font-mono">
                  Detected:{" "}
                  {keyboardState.currentKeys.map(normalizeKeyName).join(" + ")}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <KeyDisplay
              currentKeys={keyboardState.currentKeys}
              modifiers={keyboardState.modifiers}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
