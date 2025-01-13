import { createFileRoute } from "@tanstack/react-router";
import { useHypercapsKeys } from "../hooks/use-hypercaps-keys";

export const Route = createFileRoute("/")({
  component: Index,
  beforeLoad: () => {
    console.log("Index route loading");
  },
});

function Index() {
  const { pressedKeys, isRunning, isLoading, error } = useHypercapsKeys();

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">HyperCaps Demo</h1>

      {/* Service Status */}
      <div className="space-y-2">
        <h2 className="text-xl">Service Status</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isRunning
                ? "bg-green-500"
                : isLoading
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <span>
            {isRunning ? "Running" : isLoading ? "Starting..." : "Stopped"}
          </span>
        </div>
        {error && <div className="text-red-500">Error: {error}</div>}
      </div>

      {/* Pressed Keys */}
      <div className="space-y-2">
        <h2 className="text-xl">Pressed Keys</h2>
        <div className="flex flex-wrap gap-2">
          {pressedKeys.length === 0 ? (
            <span className="text-gray-500">No keys pressed</span>
          ) : (
            pressedKeys.map((key) => (
              <span
                key={key}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded"
              >
                {key}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl mb-2">Instructions</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Press any keys to see them appear above</li>
          <li>The service status indicator shows real-time state</li>
          <li>Keys are processed in order and deduplicated</li>
        </ul>
      </div>
    </div>
  );
}
