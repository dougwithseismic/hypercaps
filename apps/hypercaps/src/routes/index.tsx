import { createFileRoute } from "@tanstack/react-router";
import { useHypercapsKeys } from "../hooks/use-hypercaps-keys";
import { Badge } from "../components/ui/badge";

export const Route = createFileRoute("/")({
  component: Index,
  beforeLoad: () => {
    console.log("Index route loading");
  },
});

function Index() {
  const {
    modifierKeys,
    normalKeys,
    pressedKeys,
    isListening,
    isLoading,
    error,
    hyperKeyConfig,
    fullState,
  } = useHypercapsKeys();

  // Check if HyperKey trigger is being pressed
  const isTriggerPressed =
    hyperKeyConfig?.trigger && pressedKeys.includes(hyperKeyConfig.trigger);

  return (
    <div className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">HyperCaps Demo</h1>

      {/* Service Status */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl">Service Status</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isListening
                ? "bg-green-500"
                : isLoading
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <span>
            {isListening ? "Running" : isLoading ? "Starting..." : "Stopped"}
          </span>
        </div>
        {error && <div className="text-red-500">Error: {error}</div>}
      </div>

      {/* Pressed Keys */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl">Pressed Keys</h2>
        <div className="flex flex-wrap items-center gap-2 min-h-[2rem]">
          {modifierKeys.length === 0 && normalKeys.length === 0 ? (
            <span className="text-gray-500">No keys pressed</span>
          ) : (
            <>
              {/* Modifier Keys */}
              {modifierKeys.map((key) => (
                <Badge
                  key={key}
                  variant={
                    hyperKeyConfig?.trigger === key
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {key}
                </Badge>
              ))}

              {/* Plus sign if both types present */}
              {modifierKeys.length > 0 && normalKeys.length > 0 && (
                <span className="font-bold text-gray-500">+</span>
              )}

              {/* Normal Keys */}
              {normalKeys.map((key) => (
                <Badge
                  key={key}
                  variant={
                    hyperKeyConfig?.trigger === key ? "destructive" : "default"
                  }
                >
                  {key}
                </Badge>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Debug Window */}
      <div className="flex flex-col gap-2 p-4 mt-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl">Debug Info</h2>

        {/* HyperKey Status */}
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">HyperKey Status</h3>
          <div className="flex items-center gap-2">
            <Badge variant={isTriggerPressed ? "destructive" : "outline"}>
              {isTriggerPressed ? "TRIGGER PRESSED" : "TRIGGER RELEASED"}
            </Badge>
            <span>Trigger: {hyperKeyConfig?.trigger || "Not Set"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="font-medium">Modifiers:</span>
            {hyperKeyConfig?.modifiers.length === 0 ? (
              <span className="text-gray-500">None</span>
            ) : (
              hyperKeyConfig?.modifiers.map((mod: string) => (
                <Badge key={mod} variant="outline">
                  {mod}
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Current State */}
        <div className="flex flex-col gap-1 mt-2">
          <h3 className="font-semibold">Current State</h3>
          <div className="p-2 overflow-auto font-mono text-sm bg-white rounded max-h-48">
            <pre>
              {JSON.stringify(
                {
                  hyperKeyConfig,
                  fullState,
                  pressedKeys,
                  isListening,
                  isLoading,
                  error,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 mt-8 rounded-lg bg-gray-50">
        <h2 className="mb-2 text-xl">Instructions</h2>
        <ul className="flex flex-col gap-1 list-disc list-inside">
          <li>Press any keys to see them appear above</li>
          <li>The service status indicator shows real-time state</li>
          <li>Keys are processed in order and deduplicated</li>
          <li>HyperKey trigger will be highlighted in red when pressed</li>
        </ul>
      </div>
    </div>
  );
}
