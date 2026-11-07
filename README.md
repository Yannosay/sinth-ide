# Sinth IDE

A desktop editor for [Sinth](https://github.com/Yannosay/sinth) projects, built with Tauri, Vue and Monaco.

## Features

- **Sinth-aware editor**: highlighting for markup, styles and scripts; completions for elements, `sinth:ui` components, attributes, events, modifiers and metadata; hover documentation; snippets; formatting.
- **Inline diagnostics**: every save runs the Sinth compiler (`sinth check`) and shows errors and warnings in the editor and the status bar.
- **One-click project actions**: the toolbar detects Sinth projects and offers Run dev, Build, Preview, Check and Deploy (using your package scripts when present).
- **Integrated terminal** backed by your system shell, with multiple tabs.
- **Compiler versions**: install any published Sinth version from npm, switch between them, and use the active one as `sinth` in the terminal. Downloads are verified against the registry's SHA-512 integrity hash.
- **Explorer, search and command palette**, recent folders, themes (dark, midnight, slate, light) and keyboard shortcuts.

## Install

Download the installer for your platform from [Releases](https://github.com/Yannosay/sinth-ide/releases): `.msi`/`.exe` for Windows, `.dmg` for macOS, `.AppImage`/`.deb` for Linux.

Requires [Node.js](https://nodejs.org) 18.17 or newer for the Sinth compiler.

## Develop

```bash
pnpm install
pnpm tauri dev      # run the app
pnpm build          # type-check and build the frontend
pnpm tauri build    # create installers
cd src-tauri && cargo test
```

Prerequisites: Rust (stable), Node.js 20+, pnpm, and the [Tauri system dependencies](https://tauri.app/start/prerequisites/).

## License

[AGPL-3.0](./LICENSE) © Yannosay Productions
