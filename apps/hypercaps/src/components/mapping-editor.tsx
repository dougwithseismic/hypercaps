import { useState, useEffect } from "react";

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

interface MappingEditorProps {
  mapping: KeyMapping;
  onSave: (mapping: KeyMapping) => void;
  onDelete: (id: string) => void;
}

export function MappingEditor({
  mapping,
  onSave,
  onDelete,
}: MappingEditorProps) {
  const [editedMapping, setEditedMapping] = useState<KeyMapping>(mapping);

  const handleModifierChange = (
    modifier: keyof KeyMapping["targetModifiers"]
  ) => {
    setEditedMapping((prev) => ({
      ...prev,
      targetModifiers: {
        ...prev.targetModifiers,
        [modifier]: !prev.targetModifiers[modifier],
      },
    }));
  };

  const handleSave = () => {
    onSave(editedMapping);
  };

  return (
    <div className="bg-gray-900 rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Mapping: {editedMapping.sourceKey}
        </h3>
        <div className="space-x-2">
          <button
            onClick={() =>
              setEditedMapping((prev) => ({ ...prev, enabled: !prev.enabled }))
            }
            className={`px-3 py-1 rounded ${
              editedMapping.enabled ? "bg-green-600" : "bg-gray-600"
            }`}
          >
            {editedMapping.enabled ? "Enabled" : "Disabled"}
          </button>
          <button
            onClick={() => onDelete(editedMapping.id)}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-4">
          <span className="text-gray-400">When pressing:</span>
          <span className="px-2 py-1 bg-gray-700 rounded">
            {editedMapping.sourceKey}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-gray-400">Trigger modifiers:</span>
          <div className="space-x-2">
            <button
              onClick={() => handleModifierChange("ctrl")}
              className={`px-2 py-1 rounded ${
                editedMapping.targetModifiers.ctrl
                  ? "bg-blue-600"
                  : "bg-gray-700"
              }`}
            >
              Ctrl
            </button>
            <button
              onClick={() => handleModifierChange("alt")}
              className={`px-2 py-1 rounded ${
                editedMapping.targetModifiers.alt
                  ? "bg-blue-600"
                  : "bg-gray-700"
              }`}
            >
              Alt
            </button>
            <button
              onClick={() => handleModifierChange("shift")}
              className={`px-2 py-1 rounded ${
                editedMapping.targetModifiers.shift
                  ? "bg-blue-600"
                  : "bg-gray-700"
              }`}
            >
              Shift
            </button>
            <button
              onClick={() => handleModifierChange("win")}
              className={`px-2 py-1 rounded ${
                editedMapping.targetModifiers.win
                  ? "bg-blue-600"
                  : "bg-gray-700"
              }`}
            >
              Win
            </button>
          </div>
        </div>

        {editedMapping.targetKey && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Target key:</span>
            <span className="px-2 py-1 bg-gray-700 rounded">
              {editedMapping.targetKey}
            </span>
          </div>
        )}

        {editedMapping.command && (
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Run command:</span>
            <span className="px-2 py-1 bg-gray-700 rounded font-mono text-sm">
              {editedMapping.command}
            </span>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
