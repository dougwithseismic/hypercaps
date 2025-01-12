import React, { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "./ui/table";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Plus, Trash2, Keyboard } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

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
  const [mappings, setMappings] = useState<KeyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      const data = await window.api.getMappings();
      setMappings(data);
      setError(null);
    } catch (err) {
      setError("Failed to load mappings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMapping = async (
    id: string,
    updates: Partial<KeyMapping>
  ) => {
    try {
      const updatedMapping = await window.api.updateMapping(id, updates);
      setMappings(mappings.map((m) => (m.id === id ? updatedMapping : m)));
    } catch (err) {
      console.error("Failed to update mapping:", err);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await window.api.deleteMapping(id);
      setMappings(mappings.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete mapping:", err);
    }
  };

  const handleAddMapping = async () => {
    try {
      const newMapping = await window.api.addMapping({
        sourceKey: "",
        targetModifiers: {},
        enabled: true,
      });
      setMappings([...mappings, newMapping]);
    } catch (err) {
      console.error("Failed to add mapping:", err);
    }
  };

  const formatShortcut = (mapping: KeyMapping) => {
    const modifiers = Object.entries(mapping.targetModifiers)
      .filter(([_, value]) => value)
      .map(([key]) => key.toUpperCase())
      .join(" + ");

    const key = mapping.targetKey ? mapping.targetKey.toUpperCase() : "";
    return [modifiers, key].filter(Boolean).join(" + ") || "Click to set";
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading mappings...</div>;
  }

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <Card className="bg-background/50 backdrop-blur-md border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Keyboard className="size-5" />
          Keyboard Shortcuts
        </CardTitle>
        <Button onClick={handleAddMapping} className="gap-2">
          <Plus className="size-4" />
          Add Shortcut
        </Button>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No shortcuts configured yet.</p>
            <p className="text-sm">
              Click the Add Shortcut button to create your first shortcut.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shortcut</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className="font-mono">
                    {formatShortcut(mapping)}
                  </TableCell>
                  <TableCell>{mapping.command || "No action set"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={mapping.enabled ? "default" : "secondary"}
                      className="cursor-pointer hover:opacity-80"
                      onClick={() =>
                        handleUpdateMapping(mapping.id, {
                          enabled: !mapping.enabled,
                        })
                      }
                    >
                      {mapping.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:text-destructive"
                      onClick={() => handleDeleteMapping(mapping.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
