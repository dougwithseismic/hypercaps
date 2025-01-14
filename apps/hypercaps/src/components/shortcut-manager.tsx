import { useShortcuts } from "../hooks/use-shortcuts";
import { useHypercapsKeys } from "../hooks/use-hypercaps-keys";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState, useEffect } from "react";
import { Action } from "@electron/features/shortcut-manager/types/input-buffer";

interface AddShortcutFormData {
  name: string;
  keys: string[];
  action: Action;
}

export function ShortcutManager() {
  const {
    shortcuts,
    isEnabled,
    addShortcut,
    removeShortcut,
    toggleEnabled,
    updateShortcut,
  } = useShortcuts();

  const { pressedKeys } = useHypercapsKeys();
  const [isAddingShortcut, setIsAddingShortcut] = useState(false);
  const [formData, setFormData] = useState<AddShortcutFormData>({
    name: "",
    keys: [],
    action: {
      type: "launch",
      program: "notepad.exe",
    },
  });

  // Update keys when pressed keys change
  useEffect(() => {
    if (isAddingShortcut && pressedKeys.length > 0) {
      setFormData((prev) => ({
        ...prev,
        // Append new keys to preserve sequence
        keys: [...prev.keys, ...pressedKeys],
      }));
    }
  }, [pressedKeys, isAddingShortcut]);

  const handleAddShortcut = async () => {
    try {
      // Create pattern based on number of simultaneous keys
      const pattern = {
        sequence:
          pressedKeys.length > 1
            ? [{ keys: formData.keys, window: 200 }] // Chord
            : formData.keys.map((key) => ({ keys: [key], window: 200 })), // Sequence
        window: 500,
      };

      await addShortcut({
        name: formData.name,
        pattern,
        action: formData.action,
        enabled: true,
      });

      setIsAddingShortcut(false);
      setFormData({
        name: "",
        keys: [],
        action: { type: "launch", program: "notepad.exe" },
      });
    } catch (error) {
      console.error("Failed to add shortcut:", error);
    }
  };

  const handleToggleShortcut = (id: string, enabled: boolean) => {
    updateShortcut(id, { enabled });
  };

  const renderShortcutPattern = (shortcut: (typeof shortcuts)[0]) => {
    const sequence = shortcut.pattern.sequence;
    return sequence.map((item, i) => {
      const keys = typeof item === "string" ? [item] : item.keys;
      return (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-400">→</span>}
          <span className="flex gap-1">
            {keys.map((key, j) => (
              <Badge key={j} variant="secondary">
                {key}
              </Badge>
            ))}
          </span>
        </span>
      );
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shortcut Manager</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Enabled</span>
            <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
          </div>
          <Dialog open={isAddingShortcut} onOpenChange={setIsAddingShortcut}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Shortcut
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Shortcut</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Keys</Label>
                  <div className="flex flex-wrap gap-2 p-2 min-h-[2.5rem] border rounded">
                    {formData.keys.map((key, i) => (
                      <Badge key={i} variant="secondary">
                        {key}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">
                    Press keys to record your shortcut. Multiple keys at once
                    for a chord, or press keys in sequence.
                    <br />
                    Current: {pressedKeys.join(" + ")}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, keys: [] }))
                    }
                  >
                    Clear Keys
                  </Button>
                </div>
                <Button onClick={handleAddShortcut}>Add Shortcut</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        {shortcuts?.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex items-center justify-between p-4 border rounded"
          >
            <div className="space-y-1">
              <div className="font-medium">{shortcut.name}</div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Pattern:</span>
                {renderShortcutPattern(shortcut)}
              </div>
              <div className="text-sm text-gray-500">
                Action: {shortcut.action.type} -{" "}
                {shortcut.action.type === "launch"
                  ? shortcut.action.program
                  : shortcut.action.command}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Switch
                checked={shortcut.enabled}
                onCheckedChange={(enabled) =>
                  handleToggleShortcut(shortcut.id, enabled)
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeShortcut(shortcut.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
