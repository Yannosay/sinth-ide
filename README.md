# Sinth IDE

The desktop editor for [Sinth](https://github.com/Yannosay/sinth) projects, built with Tauri, Vue and Monaco.

> Sinth IDE is in early development (0.x). Features may change between versions, and installed copies update themselves.

## Features

- **Open any folder and press Run.** The title bar detects Sinth projects (a `sinth.config.json`, the `@yannosay/sinth` dependency, or just a `.sinth` file) and offers Run, Build, Preview, Check and Deploy. Each runs in its own terminal tab with the right compiler and `--root`, and Run turns into **Stop** while the server runs.
- **Built-in preview.** Run shows the page next to the editor and updates it on every save, with phone and tablet sizes (Ctrl+Shift+V). Settings can send Run to your browser instead.
- **Desktop apps.** Projects set up with `sinth desktop init` get Run app and Build app, for native installers on Windows, macOS and Linux.
- **New project** from the welcome screen, and **quick open** (Ctrl+P) for every file in the folder.
- **Safe with outside edits.** Open files pick up changes from git, formatters or AI agents, and closing a tab or the window asks before unsaved work is lost.
- **Zero setup compiler.** Sinth IDE uses the project's own `node_modules` compiler first, then a version installed from the Compilers panel, then a global install. If none exists, the status bar offers a one-click install of the latest release (verified against the npm registry's SHA-512 hash), and it offers an update when the project's Sinth is outdated.
- **Sinth-aware editor**: highlighting for markup, styles and scripts; completions for elements, all 28 `sinth:ui` components, `sinth:ui`, `sinth:env` and `sinth:desktop` imports, attributes, events, modifiers and metadata; hover documentation; snippets; formatting.
- **Inline diagnostics**: every save runs `sinth check`; errors and warnings show in the editor, and the Problems list in the status bar jumps to each one.
- **Command palette for everything** (Ctrl+Shift+P): Run, Build, Preview, Check, Deploy and **Install AI Agent Skill**, which teaches Claude Code, Codex, Cursor and other agents to write Sinth for this project.
- **Integrated terminal** backed by your shell (PowerShell, cmd, bash, zsh), with tabs, search, Ctrl+click links and correct Unicode output.
- **Real file icons** for Sinth, TypeScript, JavaScript, React, Vue, Rust, JSON, CSS, Markdown and more.
- **Signed automatic updates** from GitHub releases. Updates are only installed when their signature matches the key built into the app.
- Explorer, search, command palette, recent folders, themes (Sinth, midnight, slate, light) and keyboard shortcuts.

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

Installers are built by the Release workflow when a version tag (for example `v0.1.1`) is pushed. It signs every update bundle, so installed copies only accept updates published from this repository.

## Credits

File type icons from [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) (MIT).

## License

[AGPL-3.0](./LICENSE) © Yannosay Productions
