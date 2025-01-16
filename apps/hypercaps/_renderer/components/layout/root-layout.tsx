import React from 'react';
import { Link, Outlet } from '@tanstack/react-router';

export function RootLayout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border">
        <nav className="p-4 space-y-2">
          <Link
            to="/"
            className="block px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-md"
            activeProps={{
              className: 'bg-sidebar-accent text-sidebar-accent-foreground',
            }}
          >
            Dashboard
          </Link>
          <Link
            to="/settings"
            className="block px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-md"
            activeProps={{
              className: 'bg-sidebar-accent text-sidebar-accent-foreground',
            }}
          >
            Settings
          </Link>
          <Link
            to="/remapper"
            className="block px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent rounded-md"
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
        <div className="container mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
