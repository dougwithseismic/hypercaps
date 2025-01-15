import {
  RouterProvider,
  createRouter,
  createMemoryHistory,
} from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Create a memory history instance for Electron with explicit configuration
const memoryHistory = createMemoryHistory({
  initialEntries: ['/'], // Set initial route
  initialIndex: 0, // Start at the first entry
});

// Create a new router instance with memory history
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  history: memoryHistory,
  // Enable strict path matching for more predictable routing
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
