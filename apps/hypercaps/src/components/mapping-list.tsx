import { useEffect, useState, useCallback, useRef } from "react";
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
  const [keyBuffer, setKeyBuffer] = useState<string[]>([]);
  const [isBufferCompleted, setIsBufferCompleted] = useState(false);
  const timeoutRef = useRef<number>();

  // Update key buffer when currentKeys change
  useEffect(() => {
    if (!isCapturing) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // If no keys are pressed
    if (currentKeys.length === 0) {
      // If we had keys in buffer, mark it as completed
      if (keyBuffer.length > 0 && !isBufferCompleted) {
        setIsBufferCompleted(true);
      }
      return;
    }

    // If buffer is completed and new keys are pressed, start fresh
    if (isBufferCompleted && currentKeys.length > 0) {
      setKeyBuffer(currentKeys);
      setIsBufferCompleted(false);
      return;
    }

    // If buffer is open, update it with current keys
    if (!isBufferCompleted) {
      setKeyBuffer(currentKeys);
    }
  }, [currentKeys, isCapturing, keyBuffer.length, isBufferCompleted]);

  // Clear buffer when stopping capture
  useEffect(() => {
    if (!isCapturing) {
      setKeyBuffer([]);
      setIsBufferCompleted(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    }
  }, [isCapturing]);

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
    if (keyBuffer.length === 0) return;

    const newMapping: Omit<KeyMapping, "id"> = {
      sourceKey: keyBuffer.join("+"),
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
      setKeyBuffer([]);
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

      <Dialog open={isCapturing} onOpenChange={setIsCapturing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Press Key Combination</DialogTitle>
            <DialogDescription>
              Press the keys you want to create a mapping for. The keys will be
              buffered together.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">Current Buffer:</div>
              <div className="flex flex-wrap gap-2">
                {keyBuffer.length > 0 ? (
                  keyBuffer.map((key, index) => (
                    <Badge key={index} variant="secondary">
                      {key}
                    </Badge>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No keys pressed yet
                  </div>
                )}
              </div>
            </div>
            <KeyDisplay
              currentKeys={currentKeys}
              hyperKeyConfig={hyperKeyConfig}
              modifiers={modifiers}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCapturing(false);
                  setKeyBuffer([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMapping}
                disabled={keyBuffer.length === 0}
              >
                Add Mapping
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
