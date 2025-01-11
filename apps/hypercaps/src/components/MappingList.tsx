import { useState, useEffect } from "react";
import { MappingEditor } from "./MappingEditor";

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

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const loadedMappings = await window.electron.ipcRenderer.getMappings();
      setMappings(loadedMappings);
    } catch (error) {
      console.error("Failed to load mappings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async (mapping: KeyMapping) => {
    try {
      await window.electron.ipcRenderer.updateMapping(mapping.id, mapping);
      await loadMappings(); // Reload mappings to get the updated list
    } catch (error) {
      console.error("Failed to save mapping:", error);
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await window.electron.ipcRenderer.deleteMapping(id);
      await loadMappings(); // Reload mappings to get the updated list
    } catch (error) {
      console.error("Failed to delete mapping:", error);
    }
  };

  const handleAddMapping = async () => {
    try {
      const newMapping = {
        sourceKey: "CapsLock",
        targetModifiers: {
          ctrl: false,
          alt: false,
          shift: false,
          win: false,
        },
        enabled: true,
      };

      await window.electron.ipcRenderer.addMapping(newMapping);
      await loadMappings(); // Reload mappings to get the updated list
    } catch (error) {
      console.error("Failed to add mapping:", error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-400">Loading mappings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Key Mappings</h2>
        <button
          onClick={handleAddMapping}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
        >
          Add Mapping
        </button>
      </div>

      <div className="space-y-4">
        {mappings.length === 0 ? (
          <div className="bg-gray-900 rounded-md p-4">
            <p className="text-gray-400">No mappings configured yet.</p>
          </div>
        ) : (
          mappings.map((mapping) => (
            <MappingEditor
              key={mapping.id}
              mapping={mapping}
              onSave={handleSaveMapping}
              onDelete={handleDeleteMapping}
            />
          ))
        )}
      </div>
    </div>
  );
}
