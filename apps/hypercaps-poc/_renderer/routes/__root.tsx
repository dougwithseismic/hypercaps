import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
        <Link to="/" className="mt-4 text-blue-500 hover:underline">
          Go Home
        </Link>
      </div>
    );
  },
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
      {process.env.NODE_ENV === 'development' && <TanStackRouterDevtools />}
    </div>
  );
}
