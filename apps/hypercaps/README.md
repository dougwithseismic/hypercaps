# HyperCaps

A powerful keyboard remapping tool designed exclusively for Windows that transforms your CapsLock key into a powerful modifier key combination. Built with Electron, React, and TypeScript.

> **Note**: HyperCaps is a Windows-only application. It will not work on macOS or Linux due to its deep integration with the Windows API for keyboard handling.

## Features

- **CapsLock Transformation**: Converts CapsLock into Ctrl+Shift+Win modifier combination
- **Real-time Key Monitoring**: Displays all currently pressed keys and modifier states
- **Key Mapping Interface**: User-friendly interface to view and manage key mappings
- **Windows Native Integration**: Uses Windows API through PowerShell for reliable key detection
- **Type-Safe IPC**: Full TypeScript support across process boundaries
- **Reliable Event Ordering**: Message queue system for consistent event handling

## System Requirements

- Windows 10 or Windows 11
- PowerShell with execution policy that allows running scripts
- Node.js (v18 or higher)
- pnpm (v8 or higher)

## Architecture

The application is built on three core services:

### 1. Message Queue Service

- Handles real-time event processing
- Ensures ordered event delivery
- Manages transient state
- Provides priority-based message handling

### 2. IPC Service

- Bridges main and renderer processes
- Type-safe command and event system
- Uses contextBridge for security
- Reliable event delivery through MessageQueue

### 3. Store Service

- Manages persistent configuration
- Handles feature flags and settings
- Version-controlled state migrations
- Type-safe state management

## Project Structure

```
apps/hypercaps/
├── electron/                    # Electron main process code
│   ├── features/               # Feature-specific implementations
│   │   └── hyperkeys/         # Keyboard handling feature
│   │       ├── scripts/       # PowerShell scripts
│   │       ├── services/      # Feature services
│   │       └── types/         # Type definitions
│   └── services/              # Core services
│       ├── ipc/              # IPC system
│       ├── queue/            # Message queue
│       └── store/            # Persistent storage
├── src/                       # React application source
│   ├── components/           # React components
│   ├── hooks/               # Custom React hooks
│   └── lib/                # Shared utilities
└── dist-electron/            # Compiled Electron code
```

## Development

1. Clone and install:

```bash
git clone [your-repo-url]
cd hypercaps
pnpm install
```

2. Start development:

```bash
pnpm dev
```

3. Build for production:

```bash
pnpm build
```

## IPC Communication

The application uses a custom IPC system for type-safe communication:

```typescript
// In React component
const { pressedKeys } = useHypercapsKeys();

// Commands
await ipc.run(createCommand('keyboard', 'start'));

// Events
ipc.on('keyboard', 'keyPressed', (event) => {
  console.log('Keys pressed:', event.data.pressedKeys);
});
```

## Security Model

HyperCaps follows Electron's security best practices:

### Context Isolation

- Strict context isolation between main and renderer processes
- All IPC goes through the contextBridge
- No direct access to Node.js or Electron APIs from renderer

### IPC Security

```typescript
// Preload script exposes safe APIs
contextBridge.exposeInMainWorld('api', {
  ipc: {
    run: async <T>(command) => ipcRenderer.invoke('ipc:command', command),
    on: <T>(service, event, callback) => {
      // Safe event handling
    },
  },
});
```

### Windows API Access

- PowerShell scripts run with minimal privileges
- Keyboard monitoring uses safe Windows API calls
- No direct DLL imports or unsafe native code

## Debugging

### Main Process

Debug logs are available through several channels:

```typescript
// Keyboard Service logs
[KeyboardService] Parsed keyboard state: {...}
[KeyboardService] Enqueueing keyboard event: {...}

// IPC Service logs
[IPCService] Emitting event: {...}
[IPCService] Processing queued event: {...}

// Message Queue logs
[MessageQueue] Processing message: {...}
[MessageQueue] Handler completed: {...}
```

### Renderer Process

React DevTools and Console provide debugging information:

```typescript
[IPCClient] Setting up event listener: keyboard:keyPressed
[IPCClient] Received event data: { pressedKeys: [...] }
[useHypercapsKeys] Key pressed: {...}
```

### PowerShell Script

Debug output from the keyboard monitor:

```powershell
[DEBUG] Starting keyboard monitor...
[DEBUG] Config: { isEnabled: true, ... }
[DEBUG] Key Event - Key: LControlKey, IsDown: True
```

## Advanced Usage

### Custom Key Mappings

```typescript
// Define a custom mapping
const mapping: KeyMapping = {
  trigger: 'CapsLock',
  modifiers: ['Control', 'Shift', 'Win'],
  action: 'hyperkey',
};

// Apply the mapping
await ipc.run(createCommand('keyboard', 'setMapping', mapping));
```

### Event Priority System

Messages are processed based on priority:

1. Keyboard Events (Priority 1)
2. Command Execution (Priority 2)
3. State Updates (Priority 3)

```typescript
// High priority event
queue.enqueue('keyboardEvent', data, 1);

// Normal priority command
queue.enqueue('setState', updates, 2);
```

### State Management

The Store service provides versioned state management:

```typescript
// Update state with automatic versioning
await store.update((draft) => {
  draft.features.hyperKey.config = newConfig;
});

// State migrations
const migrations = [
  {
    version: '0.2.0',
    migrate: (state) => {
      // Migration logic
    },
  },
];
```

## Error Handling

The application implements comprehensive error handling:

### IPC Errors

```typescript
try {
  await ipc.run(command);
} catch (error) {
  if (error.code === 'SERVICE_NOT_FOUND') {
    // Handle service not found
  } else if (error.code === 'HANDLER_NOT_FOUND') {
    // Handle missing handler
  }
}
```

### Queue Errors

```typescript
queue.on('message:failed', (message) => {
  if (message.type === 'setState') {
    // Handle state update failure
  }
});
```

### PowerShell Errors

```powershell
try {
  Start-KeyboardMonitor -Config $Config
} catch {
  Write-Error "Failed to start keyboard monitor: $_"
  exit 1
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Electron and React
- Uses Windows API for low-level keyboard access
- Inspired by the need for better keyboard customization on Windows
