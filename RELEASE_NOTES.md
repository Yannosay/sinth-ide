Sinth IDE 0.2.0 is a redesign around the way you build with Sinth: write, press Run, and see the page next to your code.

## New

- **Built-in preview.** Run opens the page beside the editor and updates it on every save, with phone and tablet sizes, an address bar and a reload button. Settings, Run and terminal lets you send Run to your browser instead.
- **Quick open.** `Ctrl+P` finds any file by name; type `>` for commands.
- **New project** from the welcome screen, with the starter, minimal or blank template.
- **Desktop apps.** Projects set up with `sinth desktop init` get Run app and Build app.
- The status bar offers to update Sinth when the project uses an older version.
- A project menu in the title bar with recent folders, and a Clear button in the terminal.

## Better

- A new look in the Sinth design: one title bar for the project, actions and search, the Unbounded and JetBrains Mono fonts, and calmer panels.
- Open files pick up changes made outside the IDE, for example by git or an AI agent, and the explorer keeps its expanded folders when it refreshes.
- The explorer shows dotfiles such as `.env` and `.gitignore`.
- Release notes like these are shown in the update dialog.

## Fixed

- Installing an update failed with "Cannot read private member from an object whose class did not declare it".
- Closing a tab, closing all tabs or closing the window discarded unsaved changes without asking.
- Saving while typing could mark unsent text as saved, and save errors were not shown.
- Opening a folder on Windows could show the path as `\?\C:\...`.
- Ctrl+Shift+O switched to the explorer instead of opening a folder.

Requires Node.js 18 or newer for the Sinth compiler.
