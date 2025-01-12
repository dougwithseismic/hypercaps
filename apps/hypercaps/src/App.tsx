import React from "react";
import { KeyboardProvider, useKeyboard } from "./contexts/keyboard-context";
import { MappingList } from "./components/mapping-list";
import { Settings } from "./components/settings";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { ShellLayout } from "./components/shell-layout";
import "./app.css";

function KeyboardStatus() {
  const { state, toggleService } = useKeyboard();

  return (
    <Card className="bg-background/50 backdrop-blur-md border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xl">Keyboard Status</CardTitle>
        <Button
          onClick={toggleService}
          variant={state.isEnabled ? "default" : "destructive"}
          className="backdrop-blur-sm"
          disabled={state.isLoading}
        >
          {state.isLoading ? (
            <span className="flex items-center gap-2">
              <span className="border-2 border-current rounded-full size-4 border-r-transparent animate-spin" />
              Loading...
            </span>
          ) : state.isEnabled ? (
            "Enabled"
          ) : (
            "Disabled"
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-4 mb-4">
          {Object.entries(state.modifiers).map(([key, value]) => (
            <Badge
              key={key}
              variant={value ? "default" : "secondary"}
              className="justify-center"
            >
              {key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}
            </Badge>
          ))}
        </div>

        <Separator className="my-4" />

        <div>
          <h3 className="mb-2 text-lg font-semibold">Pressed Keys</h3>
          <div className="flex flex-wrap gap-2">
            {state.currentKeys.map((key) => (
              <Badge key={key} variant="default">
                {key}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppContent() {
  const { state } = useKeyboard();
  const statusText = state.isEnabled
    ? "Keyboard Service: Active"
    : "Keyboard Service: Inactive";

  return (
    <ShellLayout statusText={statusText}>
      <div className="space-y-6">
        <KeyboardStatus />
        <MappingList />
        <Settings />
      </div>
    </ShellLayout>
  );
}

function App() {
  return (
    <KeyboardProvider>
      <AppContent />
    </KeyboardProvider>
  );
}

export default App;
