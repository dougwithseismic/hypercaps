import { useEffect, useState } from "react";

interface StartupSettings {
  startupOnBoot: boolean;
  enableOnStartup: boolean;
}

export function Settings() {
  const [settings, setSettings] = useState<StartupSettings>({
    startupOnBoot: false,
    enableOnStartup: true,
  });

  useEffect(() => {
    // Load initial settings
    window.api.getStartupSettings().then(setSettings);
  }, []);

  const handleStartupOnBootChange = async (enabled: boolean) => {
    await window.api.setStartupOnBoot(enabled);
    setSettings((prev) => ({ ...prev, startupOnBoot: enabled }));
  };

  const handleEnableOnStartupChange = async (enabled: boolean) => {
    await window.api.setEnableOnStartup(enabled);
    setSettings((prev) => ({ ...prev, enableOnStartup: enabled }));
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2">
            <span>Start HyperCaps on system boot</span>
            <input
              type="checkbox"
              checked={settings.startupOnBoot}
              onChange={(e) => handleStartupOnBootChange(e.target.checked)}
              className="form-checkbox h-4 w-4"
            />
          </label>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2">
            <span>Enable keyboard remapping on startup</span>
            <input
              type="checkbox"
              checked={settings.enableOnStartup}
              onChange={(e) => handleEnableOnStartupChange(e.target.checked)}
              className="form-checkbox h-4 w-4"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
