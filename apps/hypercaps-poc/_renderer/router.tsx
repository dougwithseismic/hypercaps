import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Using memory history for Electron since we're not in a traditional browser environment
const memoryHistory = createMemoryHistory({
  initialEntries: ['/'], // Start at the home page
});

export const router = createRouter({
  routeTree,
  history: memoryHistory,
  // Since we're in Electron, we want to handle external links differently
  defaultPreload: 'intent',
});

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
