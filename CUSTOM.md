# marka — Sasha's custom fork of markamd

Local fork of [mattenarle10/markamd](https://github.com/mattenarle10/markamd) (MIT).
Custom enhancements live on the `custom` branch; `upstream` remote tracks the original repo.

## Custom features (on top of upstream)

| Feature | Shortcut | Notes |
|---|---|---|
| View cycling / show source | ⌘E | One meaning everywhere: *show me the editable form of this file*. On markdown, HTML and CSV it cycles the panes (split → editor-only → preview-only → split). On a rendered SVG it flips to the source and back — the same thing the viewer's "edit as text" button does. Sidebar unaffected (⌘B still toggles it). Adds a `"preview"` view mode alongside upstream's split/reading/editor. Was ⌘⇧B until 2026-07-29; ⌘V and ⌃V are unusable because `mod` collapses to Ctrl off macOS, making them the paste key on Windows and Linux. |
| In-app file viewer | click an image / PDF / video / audio file in the sidebar | Opens as a read-only viewer **tab** (current tab is preserved); Esc or × closes the tab. Images incl. avif/ico/heic/tiff; PDFs use WKWebView's native viewer; video (.mp4/.m4v/.mov/.webm/.ogv) and audio (.mp3/.m4a/.wav/.ogg/.flac/.aac/.aiff/.caf/.opus) play with native controls (512MB cap, checked via `stat` before the read). SVG viewer has an "edit as text" button. Opaque binaries — office formats, archives, fonts, databases — get a launcher card → default app. |
| Editable HTML with live preview | click a .html / .htm file | Edits like markdown: editor left, rendered preview right (sandboxed iframe — scripts run, relative assets don't resolve). ⌘E cycling and reading mode work on it. |
| Editable text files — **text is the default** | click any file that isn't media or an opaque binary | Media formats and opaque binaries are enumerated in `media-assets.ts`; *everything else* opens directly in the editor as plain text (editor-only — no markdown preview), with normal save (⌘S). No extension allowlist to fall off the end of, so `.tf`, `.hcl`, `.nix`, `.tex`, `.gradle`, `Makefile`, `Dockerfile` and friends all just work. The backstop is a NUL-byte sniff over the first 8 KB plus the binary-signature check, so an unlisted binary is refused with a reason rather than opening as mojibake. `.env` / `.env.*` are also made **visible** in the explorer (upstream hides all dotfiles — a deliberate fork divergence, incl. the adjusted upstream test in tests/files.test.ts). |
| Collapsed explorer at startup | — | Workspace root folders start collapsed instead of expanded (subfolders always did). |
| Folder favourites | star on folder rows, or drag a folder into Favourites | Folders can be favourited like files; clicking a favourite folder opens it as a workspace root in the sidebar. |
| App-wide zoom | ⌘= / ⌘- / ⌘0 | Webview-level zoom (everything scales), 50%–300% in 10% steps, persisted across restarts. |

## Workflow

- **Get upstream updates**: `scripts/local/update-from-upstream.sh` (fetches + merges `upstream/main` into `custom`), resolve any conflicts, then rebuild.
- **Build + install**: `scripts/local/build-install.sh` — builds the release bundle (updater artifacts disabled; they need upstream's signing key) and copies the app to `/Applications/marka.md.app`.
- **In-app update prompts**: decline them — they would replace the custom build with upstream's binary. Updates come via the merge script + rebuild instead.

## Files touched by the customisations

- `src/app.tsx` — view modes + ⌘E cycling/source toggle, zoom state, file-viewer state, per-path source overrides, folder-favourite state, shortcuts, render branches
- `src/components/editor/file-view.tsx` — new component (image / pdf / video / audio viewer), size guard, reload token
- `src/components/editor/editor.tsx` — minimal-diff dispatch so external reloads keep the cursor
- `src/components/editor/preview.tsx`, `csv-preview.tsx` — `.tsv` delimiter threading
- `src/components/files/folder-node.tsx`, `favorites.tsx`, `sidebar.tsx` — folder favourite star + folder rows in Favourites
- `src/hooks/use-file-watcher.ts` — multi-path watcher registry (every open tab)
- `src/hooks/use-file-session.ts` — external-change resolution, reload tokens, in-place viewer→source conversion
- `src/lib/media-assets.ts`, `src/lib/files.ts`, `src/lib/csv.ts`, `src/lib/storage.ts`, `src/lib/index.ts` — format tables, text-as-default classification + binary sniff, preview-renderer predicate, `.tsv`, isDirectory helper, storage key
- `src/styles/editor/panes.css`, `src/styles/files/sidebar.css` — solo-pane, viewer, folder-star styles
- `src-tauri/capabilities/default.json` — webview zoom permission, dotenv fs scope
- `tests/` — classification, watcher-controller lifecycle, external-change resolution, reload-token pruning
- `docs/file-format-checklist.md`, `scripts/local/make-fixtures.sh` — the manual verification pass and its fixtures

## Performance fixes over upstream

- `use-folder-watcher.ts` now uses `watchImmediate` + a JS-side debounce instead of the fs plugin's debounced `watch`. The debounced variant builds a file-ID cache by stat-walking the **entire** watched tree on watcher creation — on large roots this froze the app at startup and whenever a folder was added. Watchers are also managed incrementally (adding a folder no longer tears down and recreates every existing watcher).

## Live update

- `use-file-watcher.ts` is the same registry narrowed to individual files: **every open tab is watched**, not just the focused one, and `onChange` reports which path changed. Coalescing windows are per-path, so an agent writing one file in a loop can't delay another's reload.
- The active tab reloads silently when clean and raises a conflict prompt when dirty. Background tabs adopt disk content outright — unsaved edits in an unfocused tab are discarded, deliberately, so a stale buffer can't clobber an agent's work on a later save. One branch in `handleExternalChange` if that trade ever stops paying.
- Viewer tabs (images/PDF/SVG) re-read via a per-path reload token, since a rendered file has no text buffer to diff.
- The editor applies external changes as a **minimal diff** (common prefix/suffix trimmed) rather than replacing the whole document, so the cursor and scroll position survive a reload.
- `resolveExternalChange()` is a pure function taking every input as an argument. That shape is load-bearing: reading "is this file active?" *before* awaiting the file read let a mid-read tab switch pour one file's content into another's buffer, which the next save committed to disk. Found by cross-model review, pinned by a regression test.

Keeping the diff small and localised is deliberate — it keeps upstream merges low-conflict.
