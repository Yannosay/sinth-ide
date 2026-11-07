# Sinth IDE

The desktop editor for [Sinth](https://github.com/Yannosay/sinth) projects, built with Tauri, Vue and Monaco.

> Sinth IDE is in early development (0.0.x). Features may change between versions, and installed copies update themselves.

## Features

- **Open any folder and press Run.** The toolbar detects Sinth projects (a `sinth.config.json`, the `@yannosay/sinth` dependency, or just a `.sinth` file) and offers Run, Build, Preview, Check and Deploy. Commands run in the integrated terminal with the right compiler and `--root`, so they work from any directory.
- **Zero setup compiler.** Sinth IDE uses the project's own `node_modules` compiler first, then a version installed from the Compilers panel, then a global install. If none exists, the status bar offers a one-click install of the latest release (verified against the npm registry's SHA-512 hash).
- **Sinth-aware editor**: highlighting for markup, styles and scripts; completions for elements, `sinth:ui` components, attributes, events, modifiers and metadata; hover documentation; snippets; formatting.
- **Inline diagnostics**: every save runs `sinth check`; errors and warnings show in the editor, and the Problems list in the status bar jumps to each one.
- **Integrated terminal** backed by your shell (PowerShell, cmd, bash, zsh), with tabs, search and correct Unicode output.
- **Real file icons** for Sinth, TypeScript, JavaScript, React, Vue, Rust, JSON, CSS, Markdown and more.
- **Signed automatic updates** from GitHub releases. Updates are only installed when their signature matches the key built into the app.
- Explorer, search, command palette, recent folders, themes (dark, midnight, slate, light) and keyboard shortcuts.

## Install

Download the installer for your platform from [Releases](https://github.com/Yannosay/sinth-ide/releases): `.msi` or `-setup.exe` for Windows, `.dmg` (Apple Silicon and Intel) for macOS, `.AppImage`, `.deb` or `.rpm` for Linux.

The macOS app is not notarized yet. The first time, right-click Sinth IDE in Applications and choose **Open**. On Windows, SmartScreen may ask you to confirm with **More info → Run anyway**.

Requires [Node.js](https://nodejs.org) 18 or newer for the Sinth compiler. On macOS and Linux the IDE reads your login shell's `PATH`, so Node from Homebrew, nvm, fnm or Volta is found.

## Develop

```bash
pnpm install
pnpm tauri dev                 # run the app with hot reload
pnpm build                     # type-check and build the frontend
cd src-tauri && cargo test     # backend tests
```

Prerequisites: Rust (stable), Node.js 20+, pnpm, and the [Tauri system dependencies](https://tauri.app/start/prerequisites/).

Installers are built by the Release workflow when a version tag (for example `v0.0.2`) is pushed. It signs every update bundle, so installed copies only accept updates published from this repository.

## Credits

File type icons from [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT).

## License

[AGPL-3.0](./LICENSE) © Yannosay Productions
