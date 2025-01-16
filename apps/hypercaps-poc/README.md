# HyperCaps

A powerful keyboard remapping tool designed exclusively for Windows that transforms your CapsLock key into a powerful modifier key combination. Built with Electron, React, TypeScript, and native C++ modules.

> **Note**: HyperCaps is a Windows-only application. It will not work on macOS or Linux due to its deep integration with the Windows API for keyboard handling.

## Why Native C++?

HyperCaps originally used PowerShell scripts with C# injection for keyboard monitoring. While functional, this approach had several limitations:

- **Process Overhead**: Each keyboard event required PowerShell process communication
- **Latency**: Event round-trip time was ~5-15ms due to process boundaries
- **Resource Usage**: PowerShell host consumed significant memory
- **Reliability**: Script execution could be blocked by security policies

The new C++ native module approach solves these issues:

- **Direct API Access**: No process boundary - direct Windows API calls
- **Ultra-Low Latency**: Event processing in microseconds (~0.1ms)
- **Minimal Overhead**: Small memory footprint (~2MB vs ~50MB)
- **Frame-Based**: Consistent 60fps state updates like a game engine
- **Type Safety**: Full TypeScript integration through N-API
- **Security**: No script execution or injection required

## Features

- **CapsLock Transformation**: Converts CapsLock into any modifier combination (Ctrl+Shift+Win by default)
- **Real-time Key Monitoring**: High-performance native key event tracking at ~60fps
- **Key Mapping Interface**: User-friendly interface to view and manage key mappings
- **Windows Native Integration**: Direct Windows API access through N-API for ultra-low latency
- **Type-Safe IPC**: Full TypeScript support across process boundaries
- **Frame-Based Event System**: Precise timing and state tracking for complex key combinations

## System Requirements

- Windows 10 or Windows 11
- Node.js (v18 or higher)
- pnpm (v8 or higher)
- Visual Studio Build Tools 2019 or newer (for native module compilation)
- Python 3.x (for node-gyp)

## Architecture

The application is built on four core services:

### 1. Native Keyboard Monitor

- Direct Windows API integration through C++
- Frame-based key state tracking (~60fps)
- Ultra-low latency event processing
- Memory-efficient key state management

### 2. Message Queue Service

- Handles real-time event processing
- Ensures ordered event delivery
- Manages transient state
- Provides priority-based message handling

### 3. IPC Service

- Bridges main and renderer processes
- Type-safe command and event system
- Uses contextBridge for security
- Reliable event delivery through MessageQueue

### 4. Store Service

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
└── packages/
    └── keyboard-monitor/    # Native keyboard monitoring module
        ├── src/            # C++ and TypeScript source
        ├── binding.gyp     # Native build configuration
        └── lib/            # Compiled output
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

## Native Module Usage

The keyboard monitor provides frame-based key state tracking:

```typescript
import KeyboardMonitor, { KeyboardFrame } from '@hypercaps/keyboard-monitor';

const monitor = new KeyboardMonitor((eventName, data: KeyboardFrame) => {
  console.log('Frame:', {
    justPressed: data.state.justPressed,    // Keys pressed this frame
    held: data.state.held,                  // Currently held keys
    justReleased: data.state.justReleased,  // Keys released this frame
    holdDurations: data.state.holdDurations // How long each key is held
  });
});

// Configure and start
monitor.setConfig({
  isEnabled: true,
  isHyperKeyEnabled: true,
  trigger: 'CapsLock',
  modifiers: ['Control', 'Alt', 'Shift']
});

monitor.start();
```

## Security Model

HyperCaps follows Electron's security best practices:

### Context Isolation

- Strict context isolation between main and renderer processes
- All IPC goes through the contextBridge
- No direct access to Node.js or Electron APIs from renderer

### Native Module Security

- Minimal Windows API surface exposure
- Safe key event handling through N-API
- No direct DLL imports or unsafe native code
- Memory-safe C++ implementation

## Debugging

### Main Process

Debug logs are available through several channels:

```typescript
// Keyboard Service logs
[KeyboardService] Frame received: {...}
[KeyboardService] Key state updated: {...}

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
[IPCClient] Setting up event listener: keyboard:frame
[IPCClient] Received frame data: { held: [...], justPressed: [...] }
[useHypercapsKeys] Frame update: {...}
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
