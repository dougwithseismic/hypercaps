import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ShellLayout } from "../components/shell-layout";

function RootComponent() {
  return (
    <ShellLayout statusText={"HyperCaps Ready"}>
      <div className="flex h-full">
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
  beforeLoad: () => {
    console.log("Root route loading");
  },
  onError: ({ error }) => {
    console.error("Root route error:", error);
  },
  validateSearch: (search) => {
    // Ensure search params are valid, if any
    return search;
  },
});
