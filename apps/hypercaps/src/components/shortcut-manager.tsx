import { useShortcuts } from "../hooks/use-shortcuts";
import { useHypercapsKeys } from "../hooks/use-hypercaps-keys";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

export function ShortcutManager() {
  const { shortcuts, isEnabled, addShortcut, toggleEnabled } = useShortcuts();
  const { pressedKeys, hyperKeyConfig } = useHypercapsKeys();

  const handleAddNotepadShortcut = async () => {
    if (!hyperKeyConfig) return;

    await addShortcut({
      name: "Open Notepad",
      triggerKey: "N",
      action: {
        type: "launch",
        program: "notepad.exe",
      },
      enabled: true,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Shortcut Manager</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm">Enabled</span>
          <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button onClick={handleAddNotepadShortcut} disabled={!hyperKeyConfig}>
            Add Notepad Shortcut (
            {hyperKeyConfig ? `${hyperKeyConfig.trigger} + N` : "Loading..."})
          </Button>
        </div>

        <div className="text-sm text-gray-500">
          Current pressed keys: {pressedKeys.join(", ")}
        </div>

        <div className="space-y-2">
          {shortcuts?.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between p-2 border rounded"
            >
              <div>
                <div className="font-medium">{shortcut.name}</div>
                <div className="text-sm text-gray-500">
                  Trigger:{" "}
                  {hyperKeyConfig
                    ? `${hyperKeyConfig.trigger} + ${shortcut.triggerKey}`
                    : shortcut.triggerKey}
                </div>
              </div>
              <Switch
                checked={shortcut.enabled}
                onCheckedChange={(enabled) => toggleEnabled(enabled)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
