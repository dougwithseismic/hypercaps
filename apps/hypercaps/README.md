# HyperCaps

A powerful keyboard remapping tool for Windows that transforms your CapsLock key into a powerful modifier key combination. Built with Electron, React, and TypeScript.

## Features

- **CapsLock Transformation**: Converts CapsLock into Ctrl+Shift+Win modifier combination
- **Real-time Key Monitoring**: Displays all currently pressed keys and modifier states
- **Key Mapping Interface**: User-friendly interface to view and manage key mappings
- **Windows Native Integration**: Uses Windows API through PowerShell for reliable key detection

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- Windows 10/11
- PowerShell with execution policy that allows running scripts

## Installation

1. Clone the repository:

```bash
git clone [your-repo-url]
cd hypercaps
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

## Development

The project is structured as follows:

```
apps/hypercaps/
├── electron/               # Electron main process code
│   ├── scripts/           # PowerShell scripts for keyboard monitoring
│   └── services/          # Core services (keyboard handling, etc.)
├── src/                   # React application source
│   ├── components/        # React components
│   └── assets/           # Static assets
└── dist-electron/         # Compiled Electron code
```

### Key Components

- `keyboard-monitor.ps1`: PowerShell script that monitors keyboard events using Windows API
- `keyboard.ts`: Electron service that manages keyboard events and mappings
- `MappingList.tsx`: React component for displaying and managing key mappings
- `MappingEditor.tsx`: React component for editing individual key mappings

## Building

To build the application:

```bash
pnpm build
```

This will create a distributable in the `dist` directory.

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
