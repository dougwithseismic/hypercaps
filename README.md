# HyperCaps 🚀

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/dougwithseismic/hypercaps/issues)
[![Windows Support](https://img.shields.io/badge/Windows-0078D6?style=flat&logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-47848F?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Star](https://img.shields.io/github/stars/dougwithseismic/hypercaps?style=social)](https://github.com/dougwithseismic/hypercaps)

The Street Fighter of Shortcut Managers. The Keyboard Hack for Windows Users Living at Mach 10 🥋

Transform your keyboard into a productivity powerhouse with frame-perfect execution and combo mastery. Born from the frustration of Windows users who needed more speed, more control, and more power than PowerToys could deliver. If you've ever felt held back by your keyboard, this is your nitro boost.

Built with ❤️ by [Seismic](https://withseismic.com) • [Doug Silkstone](https://linkedin.com/in/dougsilkstone)

## Why HyperCaps?

Mac users have their Hyperkey. Windows users have... PowerToys? Not anymore. We started with a simple mission to rebind Caps Lock, then realized Windows power users deserved more. Much more. HyperCaps is built for those who type at the speed of thought and need their tools to keep up.

## Features

### 🥋 Combo System

- **Frame-Perfect Execution**: ⌨️ ➔ ⌨️ + 200ms ➔ 🚀
- **Multi-Key Sequences**: Chain commands like fighting game moves

  ```
  CapsLock ➔ H, G (200ms) ➔ H, G (200ms) = 🎯
  ```

- **Timing Windows**: Execute your combos with precision timing
- **Strict Mode**: Perfect execution for power users

### ⚡ Turbocharged Engine

- **32-Frame Buffer**: Just like a fighting game, but for your keyboard
- **Zero Input Lag**: Built for speed with low-level optimizations
- **Local Processing**: All combos executed on your machine

### 🎮 Power User Features

- **Smart CapsLock**: Your new command center
  - Block Toggle: Pure speed, no accidents
  - Double Press: Quick CapsLock when you need it
  - Combo Mode: Chain it like a special move
- **Zero-Friction Integration**:
  - Silent startup with Windows
  - Instant tray access
  - Lightning-fast keyboard shortcuts

## Installation

```bash
# Coming soon to:
winget install hypercaps
# or
scoop install hypercaps
```

## Quick Start Your Combo Journey

1. Launch HyperCaps
2. Choose your trigger key (default: CapsLock)
3. Configure your first combo
4. Master the execution ⌨️💪

## Roadmap

- [x] Core combo system and frame-perfect execution
- [x] Basic settings UI
- [ ] Advanced Combo Manager
- [ ] LUA Scripting Support
  - Custom combos and macros
  - Clipboard manipulation
  - Voice/Video control
  - LLM integration
- [ ] Profile System
- [ ] Cloud Sync

## Development

HyperCaps is built with:

- Electron for cross-Windows-version compatibility
- React + TypeScript for the UI
- PowerShell for low-level Windows keyboard hooks
- Turborepo for monorepo management

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build
```

## Contributing

We welcome contributions! Whether it's:

- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation
- 🎨 UI/UX improvements

Please check our contributing guidelines before submitting a PR.

## License

MIT - See [LICENSE](LICENSE) for details.

## Security

HyperCaps takes security seriously:

- No keylogging
- No network communication (except for future opt-in cloud sync)
- All keyboard processing happens locally
- Open source for transparency

## FAQ

### "Isn't this basically a keylogger?"

Yes, technically speaking. HyperCaps needs to monitor keyboard input to provide its functionality - that's exactly why:

1. We're 100% open source - every line of code is here for you to audit
2. Zero network activity - your keystrokes never leave your machine
3. Minimal data retention - we only track active keys for remapping
4. Local processing only - everything happens on your PC
5. You can build it yourself - clone, audit, and compile your own version

### "Why not just use PowerToys?"

PowerToys is great, but it's limited. HyperCaps offers:

- More flexible key combinations
- Better CapsLock handling
- Faster response time
- Upcoming scripting support
- Focus on speed and power users

### "Will this slow down my PC?"

No. HyperCaps is designed for speed demons - we use:

- Efficient low-level Windows APIs
- Minimal memory footprint
- Optimized event processing
- No background tasks when idle

### "What about gaming?"

HyperCaps can be instantly toggled off with a hotkey, and automatically disables itself when games are in focus (coming soon). No interference with your gaming sessions.

## Support

- [Report Issues](https://github.com/withseismic/hypercaps/issues)
- [Documentation](https://docs.hypercaps.dev)
- [Discord Community](https://discord.gg/hypercaps)
