import React from 'react';
import {
  RouterProvider,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router';
import { routeTree } from './routes/route-tree.gen';

// Create a memory history instance for Electron
const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
  initialIndex: 0,
});

// Create a new router instance with memory history
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  history: memoryHistory,
  defaultErrorComponent: ({ error }) => {
    console.error('Router error:', error);
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-red-500">Error</h1>
        <p>{error?.message || 'An unexpected error occurred'}</p>
      </div>
    );
  },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;
