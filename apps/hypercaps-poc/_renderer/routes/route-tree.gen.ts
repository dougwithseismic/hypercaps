import { Route as rootRoute } from './root';
import { Route as indexRoute } from './index';
import { Route as settingsRoute } from './settings';
import { Route as remapperRoute } from './remapper';

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      parentRoute: typeof rootRoute;
    };
    '/settings': {
      parentRoute: typeof rootRoute;
    };
    '/remapper': {
      parentRoute: typeof rootRoute;
    };
  }
}

export const routeTree = rootRoute.addChildren([
  indexRoute,
  settingsRoute,
  remapperRoute,
]); 