import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ShellLayout } from "../components/shell-layout";
import { KeyboardProvider, useKeyboard } from "../contexts/keyboard-context";

function RootComponent() {
  const { state } = useKeyboard();
  const statusText = state.isEnabled
    ? "Keyboard Service: Active"
    : "Keyboard Service: Inactive";

  return (
    <ShellLayout statusText={statusText}>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
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
