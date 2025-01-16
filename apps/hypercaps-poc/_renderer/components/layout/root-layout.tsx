import { Link, Outlet } from '@tanstack/react-router';

export function RootLayout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar border-sidebar-border">
        <nav className="p-4 space-y-2">
          <Link
            to="/"
            className="block px-4 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
            activeProps={{
              className: 'bg-sidebar-accent text-sidebar-accent-foreground',
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/settings"
            className="block px-4 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
            activeProps={{
              className: 'bg-sidebar-accent text-sidebar-accent-foreground',
            }}
          >
            Settings
          </Link>
          <Link
            to="/remapper"
            className="block px-4 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
            activeProps={{
              className: 'bg-sidebar-accent text-sidebar-accent-foreground',
            }}
          >
            Key Remapper
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="container p-6 mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
