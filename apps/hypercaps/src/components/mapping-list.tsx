import React, { useState, useEffect } from "react";

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

  if (loading) {
    return <div className="text-gray-400">Loading mappings...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Key Mappings</h2>
        <button
          onClick={handleAddMapping}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-md text-white"
        >
          Add Mapping
        </button>
      </div>

      {mappings.length === 0 ? (
        <p className="text-gray-400">No mappings configured yet.</p>
      ) : (
        <div className="space-y-4">
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              className="bg-gray-700 p-4 rounded-lg flex items-center justify-between"
            >
              <div>
                <span className="font-mono">
                  {mapping.sourceKey || "Click to set key"}
                </span>
                {" → "}
                <span className="font-mono">
                  {Object.entries(mapping.targetModifiers)
                    .filter(([_, value]) => value)
                    .map(([key]) => key.toUpperCase())
                    .join("+")}
                  {mapping.targetKey && `+${mapping.targetKey}`}
                  {mapping.command && ` (${mapping.command})`}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    handleUpdateMapping(mapping.id, {
                      enabled: !mapping.enabled,
                    })
                  }
                  className={`px-3 py-1 rounded ${
                    mapping.enabled
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-gray-500 hover:bg-gray-600"
                  }`}
                >
                  {mapping.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  onClick={() => handleDeleteMapping(mapping.id)}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
