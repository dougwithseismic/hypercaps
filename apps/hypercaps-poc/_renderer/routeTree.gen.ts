/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as SettingsImport } from './routes/settings'
import { Route as RootImport } from './routes/root'
import { Route as RemapperImport } from './routes/remapper'
import { Route as IndexImport } from './routes/index'
import { Route as RouteTreeGenImport } from './routes/route-tree.gen'

// Create/Update Routes

const SettingsRoute = SettingsImport.update({
  id: '/settings',
  path: '/settings',
  getParentRoute: () => rootRoute,
} as any)

const RootRoute = RootImport.update({
  id: '/root',
  path: '/root',
  getParentRoute: () => rootRoute,
} as any)

const RemapperRoute = RemapperImport.update({
  id: '/remapper',
  path: '/remapper',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const RouteTreeGenRoute = RouteTreeGenImport.update({
  id: '/route-tree/gen',
  path: '/route-tree/gen',
  getParentRoute: () => rootRoute,
} as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/remapper': {
      id: '/remapper'
      path: '/remapper'
      fullPath: '/remapper'
      preLoaderRoute: typeof RemapperImport
      parentRoute: typeof rootRoute
    }
    '/root': {
      id: '/root'
      path: '/root'
      fullPath: '/root'
      preLoaderRoute: typeof RootImport
      parentRoute: typeof rootRoute
    }
    '/settings': {
      id: '/settings'
      path: '/settings'
      fullPath: '/settings'
      preLoaderRoute: typeof SettingsImport
      parentRoute: typeof rootRoute
    }
    '/route-tree/gen': {
      id: '/route-tree/gen'
      path: '/route-tree/gen'
      fullPath: '/route-tree/gen'
      preLoaderRoute: typeof RouteTreeGenImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/remapper': typeof RemapperRoute
  '/root': typeof RootRoute
  '/settings': typeof SettingsRoute
  '/route-tree/gen': typeof RouteTreeGenRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/remapper': typeof RemapperRoute
  '/root': typeof RootRoute
  '/settings': typeof SettingsRoute
  '/route-tree/gen': typeof RouteTreeGenRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexRoute
  '/remapper': typeof RemapperRoute
  '/root': typeof RootRoute
  '/settings': typeof SettingsRoute
  '/route-tree/gen': typeof RouteTreeGenRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/remapper' | '/root' | '/settings' | '/route-tree/gen'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/remapper' | '/root' | '/settings' | '/route-tree/gen'
  id: '__root__' | '/' | '/remapper' | '/root' | '/settings' | '/route-tree/gen'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  RemapperRoute: typeof RemapperRoute
  RootRoute: typeof RootRoute
  SettingsRoute: typeof SettingsRoute
  RouteTreeGenRoute: typeof RouteTreeGenRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  RemapperRoute: RemapperRoute,
  RootRoute: RootRoute,
  SettingsRoute: SettingsRoute,
  RouteTreeGenRoute: RouteTreeGenRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/remapper",
        "/root",
        "/settings",
        "/route-tree/gen"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/remapper": {
      "filePath": "remapper.tsx"
    },
    "/root": {
      "filePath": "root.tsx"
    },
    "/settings": {
      "filePath": "settings.tsx"
    },
    "/route-tree/gen": {
      "filePath": "route-tree.gen.ts"
    }
  }
}
ROUTE_MANIFEST_END */
