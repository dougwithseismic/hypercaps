import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ShellLayout } from "../components/shell-layout";
import { KeyboardProvider, useKeyboard } from "../contexts/keyboard-context";
import { Button } from "../components/ui/button";
import { Keyboard, Settings as SettingsIcon } from "lucide-react";

function RootComponent() {
  const { state } = useKeyboard();
  const statusText = state.isEnabled
    ? "Keyboard Service: Active"
    : "Keyboard Service: Inactive";

  return (
    <ShellLayout statusText={statusText}>
      <div className="flex h-full">
        <nav className="border-r p-4 space-y-2 w-48">
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link to="/mappings">
              <Keyboard className="mr-2 h-4 w-4" />
              Mappings
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link to="/settings">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </nav>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {process.env.NODE_ENV === "development" && <TanStackRouterDevtools />}
    </ShellLayout>
  );
}

export const Route = createRootRoute({
  component: () => (
    <KeyboardProvider>
      <RootComponent />
    </KeyboardProvider>
  ),
});
