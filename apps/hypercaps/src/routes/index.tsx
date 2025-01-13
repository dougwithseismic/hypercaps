import { useHyperCapsKeys } from "@/hooks/use-hypercaps-keys";
import { useHyperCapsStore } from "@/stores/use-hypercaps-store";
import { createFileRoute } from "@tanstack/react-router";
import { HyperKeyFeatureConfig } from "electron/services/types";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

// Available keys for selection
const AVAILABLE_TRIGGERS = ["CapsLock", "Tab", "ScrollLock"];
const AVAILABLE_MODIFIERS = [
  "LShiftKey",
  "RShiftKey",
  "LControlKey",
  "RControlKey",
  "LMenu",
  "RMenu",
  "LWin",
  "RWin",
];

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [hyperKeyConfig, setHyperKeyConfig] =
    useState<HyperKeyFeatureConfig | null>(null);
  const {
    state,
    getHyperKeyConfig,
    setHyperKeyConfig: updateHyperKeyConfig,
  } = useHyperCapsStore();
  const { pressedKeys } = useHyperCapsKeys();

  useEffect(() => {
    getHyperKeyConfig().then((config) => {
      setHyperKeyConfig(config);
    });
  }, []);

  const handleHyperKeyToggle = async () => {
    if (!hyperKeyConfig) return;
    const newConfig = {
      ...hyperKeyConfig,
      isHyperKeyEnabled: !hyperKeyConfig.isHyperKeyEnabled,
    };
    await updateHyperKeyConfig(newConfig);
    setHyperKeyConfig(newConfig);
  };

  const handleTriggerSelect = async (trigger: string) => {
    if (!hyperKeyConfig) return;
    const newConfig = {
      ...hyperKeyConfig,
      trigger,
    };
    await updateHyperKeyConfig(newConfig);
    setHyperKeyConfig(newConfig);
  };

  const handleModifierToggle = async (modifier: string) => {
    if (!hyperKeyConfig) return;
    const newModifiers = hyperKeyConfig.modifiers.includes(modifier)
      ? hyperKeyConfig.modifiers.filter((m) => m !== modifier)
      : [...hyperKeyConfig.modifiers, modifier];

    const newConfig = {
      ...hyperKeyConfig,
      modifiers: newModifiers,
    };
    await updateHyperKeyConfig(newConfig);
    setHyperKeyConfig(newConfig);
  };

  const isHyperKeyActive =
    hyperKeyConfig?.isHyperKeyEnabled &&
    pressedKeys.includes(hyperKeyConfig.trigger) &&
    hyperKeyConfig.modifiers.every((mod) => pressedKeys.includes(mod));

  return (
    <div className="max-w-6xl p-8 mx-auto">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">HyperCaps</h1>
        <p className="text-gray-600">
          Configure your keyboard shortcuts and mappings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* HyperKey Configuration */}
          <section className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">HyperKey Configuration</h2>
              <div
                className={`px-3 py-1 rounded-full transition-colors ${
                  isHyperKeyActive
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isHyperKeyActive ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {isHyperKeyActive ? "HyperKey Active" : "HyperKey Inactive"}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">HyperKey Status</span>
                <button
                  onClick={handleHyperKeyToggle}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    hyperKeyConfig?.isHyperKeyEnabled
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  {hyperKeyConfig?.isHyperKeyEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <div className="p-4 rounded-md bg-gray-50">
                <div className="mb-4">
                  <span className="block mb-2 font-medium">
                    Select Trigger Key:{" "}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TRIGGERS.map((trigger) => (
                      <Badge
                        key={trigger}
                        variant={
                          hyperKeyConfig?.trigger === trigger
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer hover:bg-primary/80 hover:text-primary-foreground"
                        onClick={() => handleTriggerSelect(trigger)}
                      >
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block mb-2 font-medium">
                    Select Modifiers:{" "}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_MODIFIERS.map((modifier) => (
                      <Badge
                        key={modifier}
                        variant={
                          hyperKeyConfig?.modifiers.includes(modifier)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer hover:bg-primary/80 hover:text-primary-foreground"
                        onClick={() => handleModifierToggle(modifier)}
                      >
                        {modifier}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Currently Pressed Keys */}
          <section className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">
              Currently Pressed Keys
            </h2>
            <div className="min-h-[100px] bg-gray-50 rounded-md p-4">
              <div className="flex flex-wrap gap-2">
                {pressedKeys.length > 0 ? (
                  pressedKeys.map((key) => (
                    <span
                      key={key}
                      className="px-3 py-1 font-mono text-sm text-blue-800 bg-blue-100 rounded-md"
                    >
                      {key}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">No keys pressed</span>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div>
          {/* Active Mappings */}
          <section className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Active Mappings</h2>
              <button className="px-4 py-2 text-white transition-colors bg-blue-500 rounded-md hover:bg-blue-600">
                Add Mapping
              </button>
            </div>
            <div className="space-y-3">
              {state?.mappings?.length ? (
                state.mappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between p-4 transition-colors rounded-md bg-gray-50 hover:bg-gray-100"
                  >
                    <div>
                      <div className="font-medium">{mapping.name}</div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="px-2 py-1 font-mono text-xs bg-gray-200 rounded">
                          {mapping.triggers.join(" + ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-sm text-gray-500 bg-gray-200 rounded">
                        {mapping.actionType}
                      </span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>No mappings configured</p>
                  <p className="mt-1 text-sm">
                    Click "Add Mapping" to create your first shortcut
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
