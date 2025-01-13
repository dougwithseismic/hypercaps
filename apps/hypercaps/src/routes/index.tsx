import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useKeyboardService } from "../stores/keyboard-service-store";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const {
    isEnabled,
    isLoading,
    hyperKeyConfig,
    lastKeyboardEvent,
    mappings,
    startListening,
    stopListening,
    restartWithConfig,
  } = useKeyboardService();

  const toggleService = async () => {
    if (isEnabled) {
      await stopListening();
    } else {
      await startListening();
    }
  };

  const toggleHyperKey = async () => {
    await restartWithConfig({
      ...hyperKeyConfig,
      enabled: !hyperKeyConfig.enabled,
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">HyperCaps</h1>
          <p className="text-muted-foreground">
            {isLoading ? "Starting..." : isEnabled ? "Running" : "Stopped"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={isEnabled}
              onCheckedChange={toggleService}
              disabled={isLoading}
            />
            <span>Service {isEnabled ? "On" : "Off"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={hyperKeyConfig.enabled}
              onCheckedChange={toggleHyperKey}
              disabled={!isEnabled || isLoading}
            />
            <span>HyperKey {hyperKeyConfig.enabled ? "On" : "Off"}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <div>
                <span className="font-medium">Trigger Key: </span>
                <Badge variant="secondary">{hyperKeyConfig.trigger}</Badge>
              </div>
              <div>
                <span className="font-medium">Modifiers: </span>
                {hyperKeyConfig.modifiers.length > 0 ? (
                  hyperKeyConfig.modifiers.map((mod) => (
                    <Badge key={mod} variant="secondary" className="mr-2">
                      {mod}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
              <div>
                <span className="font-medium">Pressed Keys: </span>
                {lastKeyboardEvent?.pressedKeys.length ? (
                  lastKeyboardEvent.pressedKeys.map((key) => (
                    <Badge key={key} variant="secondary" className="mr-2">
                      {key}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Mappings</CardTitle>
            <Button variant="outline" size="sm">
              Add Mapping
            </Button>
          </CardHeader>
          <CardContent>
            {mappings.length > 0 ? (
              <div className="grid gap-4">
                {mappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="grid gap-1">
                      <div className="font-medium">
                        {mapping.triggers.join(" + ")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {mapping.action || "No command"}
                      </div>
                    </div>
                    <Switch checked={mapping.enabled} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No mappings configured
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug: Store State</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[400px] text-xs">
              {JSON.stringify(
                {
                  isEnabled,
                  isLoading,
                  hyperKeyConfig,
                  lastKeyboardEvent,
                  mappings,
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
