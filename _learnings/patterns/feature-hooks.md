# Feature Hooks Pattern

A type-safe pattern for managing feature state and configuration in Electron apps. This pattern provides a consistent interface for features to interact with the store while maintaining type safety and providing feature-specific functionality.

## File Structure

```
src/main/
├── infrastructure/
│   └── store/
│       └── create-feature-hook.ts    # Base hook creator utility
└── features/
    ├── hooks.ts                      # Central hooks index
    ├── remapper/
    │   └── hooks.ts                  # Remapper-specific hooks
    └── shortcuts/
        └── hooks.ts                  # Shortcuts-specific hooks
```

## Key Components

1. **Base Hook Creator** (`infrastructure/store/create-feature-hook.ts`)

   ```typescript
   export const createFeatureHook = <K extends keyof Features>(feature: K) => {
     const store = StoreManager.getInstance();
     
     return {
       getConfig: () => store.getFeatureConfig(feature),
       setConfig: (config: Partial<Features[K]['config']>) => {
         store.setFeatureConfig(feature, config)
       },
       isEnabled: () => store.getFeatureConfig(feature).isFeatureEnabled,
       setEnabled: (enabled: boolean) => {
         store.setFeatureEnabled(feature, enabled)
       },
       onConfigChange: (callback: (config: Features[K]['config']) => void) => {
         return store.events.on('feature:config:changed', (payload) => {
           if (payload.feature === feature) {
             callback(payload.config as Features[K]['config'])
           }
         })
       },
       onEnabledChange: (callback: (enabled: boolean) => void) => {
         return store.events.on('feature:enabled:changed', (payload) => {
           if (payload.feature === feature) {
             callback(payload.enabled)
         })
       }
     }
   }
   ```

2. **Feature-Specific Hooks** (`features/[feature]/hooks.ts`)

   ```typescript
   // Example: Shortcuts Feature Hook
   export const shortcutHooks = {
     ...createFeatureHook('shortcuts'),
     
     // Feature-specific methods
     addShortcut: (shortcut: Omit<Shortcut, 'id'>) => {
       const store = StoreManager.getInstance();
       const config = store.getFeatureConfig('shortcuts').config;
       const id = crypto.randomUUID();
       
       store.setFeatureConfig('shortcuts', {
         shortcuts: [...config.shortcuts, { ...shortcut, id }]
       });
       
       return id;
     }
   }
   ```

3. **Central Hooks Index** (`features/hooks.ts`)

   ```typescript
   import { remapperHooks } from './remapper/hooks'
   import { shortcutHooks } from './shortcuts/hooks'

   export const featureHooks = {
     remapper: remapperHooks,
     shortcuts: shortcutHooks
   } as const

   export { remapperHooks, shortcutHooks }
   ```

## Usage Examples

1. **Using the Central Hooks**

   ```typescript
   import { featureHooks } from '../features/hooks'
   
   // Access any feature
   const remapperConfig = featureHooks.remapper.getConfig()
   featureHooks.shortcuts.setEnabled(true)
   ```

2. **Using Specific Feature Hooks**

   ```typescript
   import { shortcutHooks } from '../features/shortcuts/hooks'
   
   // Add a new shortcut
   const id = shortcutHooks.addShortcut({
     name: 'Launch Chrome',
     trigger: { type: 'key', key: 'F4' },
     action: {
       type: 'launch',
       program: 'chrome.exe'
     },
     enabled: true,
     cooldown: 1000
   })
   
   // Subscribe to changes
   const cleanup = shortcutHooks.onConfigChange((config) => {
     console.log('Shortcuts config changed:', config)
   })
   ```

## Benefits

- **Feature Encapsulation**
  - Each feature owns its hooks and state management
  - Feature-specific logic stays with the feature
  - Clear boundaries between features

- **Type Safety**
  - Full TypeScript inference
  - Feature-specific type checking
  - Compile-time validation

- **Maintainability**
  - Hooks are close to feature implementation
  - Features can evolve independently
  - Easy to add new features

- **Scalability**
  - New features just add their own hooks
  - No central file modifications needed
  - Prevents monolithic hook files

## Best Practices

1. **File Organization**
   - Keep base hook creator in infrastructure/store
   - Place feature hooks in their feature directory
   - Use central hooks index for convenience

2. **Hook Implementation**
   - Extend base hook with feature-specific methods
   - Keep feature-specific logic in feature hooks
   - Use proper TypeScript types

3. **State Management**
   - Use the store through hooks only
   - Keep feature state isolated
   - Handle cleanup properly

4. **Event Handling**
   - Clean up event listeners
   - Use typed event payloads
   - Filter events by feature

## Integration with Store Events

The feature hooks system integrates with these store events:

```typescript
export interface StoreEventMap {
  'feature:config:changed': {
    feature: keyof Features;
    config: Features[keyof Features]['config'];
  };
  'feature:enabled:changed': {
    feature: keyof Features;
    enabled: boolean;
  };
}
