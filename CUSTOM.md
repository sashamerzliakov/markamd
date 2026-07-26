# marka — Sasha's custom fork of markamd

Local fork of [mattenarle10/markamd](https://github.com/mattenarle10/markamd) (MIT).
Custom enhancements live on the `custom` branch; `upstream` remote tracks the original repo.

## Custom features (on top of upstream)

| Feature | Shortcut | Notes |
|---|---|---|
| View cycling | ⌘⇧B | Cycles the workspace panes: split → editor-only → preview-only → split. Sidebar unaffected (⌘B still toggles it). Adds a `"preview"` view mode alongside upstream's split/reading/editor. |
| In-app file viewer | click an image / PDF in the sidebar | Opens as a read-only viewer **tab** (current tab is preserved); Esc or × closes the tab. PDFs use WKWebView's native viewer. |
| Editable HTML with live preview | click a .html / .htm file | Edits like markdown: editor left, rendered preview right (sandboxed iframe — scripts run, relative assets don't resolve). ⌘⇧B cycling and reading mode work on it. |
| Editable code files | click a .js / .mjs / .cjs / .css / .py / .json / .log file | Opens directly in the editor as plain text (editor-only — no markdown preview), with normal save (⌘S). |
| Collapsed explorer at startup | — | Workspace root folders start collapsed instead of expanded (subfolders always did). |
| Folder favourites | star on folder rows, or drag a folder into Favourites | Folders can be favourited like files; clicking a favourite folder opens it as a workspace root in the sidebar. |
| App-wide zoom | ⌘= / ⌘- / ⌘0 | Webview-level zoom (everything scales), 50%–300% in 10% steps, persisted across restarts. |

## Workflow

- **Get upstream updates**: `scripts/local/update-from-upstream.sh` (fetches + merges `upstream/main` into `custom`), resolve any conflicts, then rebuild.
- **Build + install**: `scripts/local/build-install.sh` — builds the release bundle (updater artifacts disabled; they need upstream's signing key) and copies the app to `/Applications/marka.md.app`.
- **In-app update prompts**: decline them — they would replace the custom build with upstream's binary. Updates come via the merge script + rebuild instead.

## Files touched by the customisations

- `src/app.tsx` — view modes + cycling, zoom state, file-viewer state, folder-favourite state, shortcuts, render branches
- `src/components/editor/file-view.tsx` — new component (image / pdf / html viewer)
- `src/components/files/folder-node.tsx`, `favorites.tsx`, `sidebar.tsx` — folder favourite star + folder rows in Favourites
- `src/lib/media-assets.ts`, `src/lib/files.ts`, `src/lib/storage.ts`, `src/lib/index.ts` — viewer-kind + plain-text-edit + isDirectory helpers, storage key
- `src/styles/editor/panes.css`, `src/styles/files/sidebar.css` — solo-pane, viewer, folder-star styles
- `src-tauri/capabilities/default.json` — webview zoom permission

## Performance fixes over upstream

- `use-folder-watcher.ts` now uses `watchImmediate` + a JS-side debounce instead of the fs plugin's debounced `watch`. The debounced variant builds a file-ID cache by stat-walking the **entire** watched tree on watcher creation — on large roots this froze the app at startup and whenever a folder was added. Watchers are also managed incrementally (adding a folder no longer tears down and recreates every existing watcher).

Keeping the diff small and localised is deliberate — it keeps upstream merges low-conflict.
