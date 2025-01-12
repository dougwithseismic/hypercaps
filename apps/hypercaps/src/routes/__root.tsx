import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ShellLayout } from "../components/shell-layout";
import { Button } from "../components/ui/button";
import { Keyboard, Settings as SettingsIcon } from "lucide-react";
import { useKeyboardStore } from "@/store/keyboard-store";

function RootComponent() {
  const isEnabled = useKeyboardStore((state) => state.isEnabled);
  const statusText = isEnabled
    ? "Keyboard Service: Active"
    : "Keyboard Service: Inactive";

  return (
    <ShellLayout statusText={statusText}>
      <div className="flex h-full">
        <nav className="w-48 p-4 space-y-2 border-r">
          <Button asChild variant="ghost" className="justify-start w-full">
            <Link to="/">
              <Keyboard className="w-4 h-4 mr-2" />
              Mappings
            </Link>
          </Button>
          <Button asChild variant="ghost" className="justify-start w-full">
            <Link to="/settings">
              <SettingsIcon className="w-4 h-4 mr-2" />
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
  component: () => <RootComponent />,
});
