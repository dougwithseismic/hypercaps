import { useEffect, useState } from "react";
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
import { useKeyboardStore } from "../store/keyboard-store";
import { ModifierDisplay, KeyDisplay } from "./key-state-visualizer";
import { Switch } from "./ui/switch";
import { useKeyBuffer } from "../hooks/use-key-buffer";

interface KeyMapping {
  id: string;
  sourceKey: string;
  targetModifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    win?: boolean;
  };
  targetKey?: string;
  command?: string;
  enabled: boolean;
}

export function MappingList() {
  const { currentKeys, modifiers, hyperKeyConfig } = useKeyboardStore();
  const [mappings, setMappings] = useState<KeyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [editingMapping, setEditingMapping] = useState<KeyMapping | null>(null);

  const { buffer, isComplete, addKeys, resetBuffer } = useKeyBuffer({
    completionDelay: 750,
    onComplete: (keys) => {
      // Optional: Auto-add mapping when buffer completes
      // handleAddMapping();
    },
  });

  // Update buffer when keys change during capture
  useEffect(() => {
    if (isCapturing) {
      addKeys(currentKeys);
    }
  }, [currentKeys, isCapturing, addKeys]);

  // Reset buffer when stopping capture
  useEffect(() => {
    if (!isCapturing) {
      resetBuffer();
    }
  }, [isCapturing, resetBuffer]);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      const mappings = await window.api.getMappings();
      setMappings(mappings);
      setError(null);
    } catch (err) {
      setError("Failed to load mappings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async () => {
    if (buffer.length === 0) return;

    const newMapping: Omit<KeyMapping, "id"> = {
      sourceKey: buffer.join("+"),
      targetModifiers: {
        ctrl: modifiers.ctrlKey,
        alt: modifiers.altKey,
        shift: modifiers.shiftKey,
        win: modifiers.metaKey,
      },
      enabled: true,
    };

    try {
      const mapping = await window.api.addMapping(newMapping);
      setMappings((prev) => [...prev, mapping]);
      setIsCapturing(false);
      resetBuffer();
    } catch (err) {
      console.error("Failed to add mapping:", err);
    }
  };

  const handleUpdateMapping = async (
    id: string,
    updates: Partial<KeyMapping>
  ) => {
    try {
      const updatedMapping = await window.api.updateMapping(id, updates);
      setMappings((prev) =>
        prev.map((m) => (m.id === id ? updatedMapping : m))
      );
    } catch (err) {
      console.error("Failed to update mapping:", err);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await window.api.deleteMapping(id);
      setMappings((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete mapping:", err);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-background/50 backdrop-blur-md border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Key Mappings</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCapturing(true)}
            >
              Add Mapping
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No mappings yet. Click "Add Mapping" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{mapping.sourceKey}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex gap-1">
                        {mapping.targetModifiers.ctrl && (
                          <Badge variant="secondary">Ctrl</Badge>
                        )}
                        {mapping.targetModifiers.alt && (
                          <Badge variant="secondary">Alt</Badge>
                        )}
                        {mapping.targetModifiers.shift && (
                          <Badge variant="secondary">Shift</Badge>
                        )}
                        {mapping.targetModifiers.win && (
                          <Badge variant="secondary">Win</Badge>
                        )}
                        {mapping.targetKey && (
                          <Badge variant="secondary">{mapping.targetKey}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mapping.enabled}
                      onCheckedChange={(enabled) =>
                        handleUpdateMapping(mapping.id, { enabled })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMapping(mapping.id)}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCapturing}
        onOpenChange={(open) => {
          setIsCapturing(open);
          if (!open) resetBuffer();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Press Key Combination</DialogTitle>
            <DialogDescription>
              Press the keys you want to create a mapping for. Release all keys
              to complete the combination.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Current Buffer:</div>
              <KeyDisplay
                currentKeys={currentKeys}
                hyperKeyConfig={hyperKeyConfig}
                modifiers={modifiers}
                buffer={{
                  keys: buffer,
                  isComplete: isComplete,
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCapturing(false);
                  resetBuffer();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddMapping} disabled={buffer.length === 0}>
                Add Mapping
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
