# marka — Sasha's custom fork of markamd

Local fork of [mattenarle10/markamd](https://github.com/mattenarle10/markamd) (MIT).
Custom enhancements live on the `custom` branch; `upstream` remote tracks the original repo.

## Custom features (on top of upstream)

| Feature | Shortcut | Notes |
|---|---|---|
| Preview-only mode | ⌘⇧B | Hides the markdown editor pane, leaving the preview (sidebar unaffected — ⌘B still toggles it). New `"preview"` view mode alongside upstream's split/reading/editor. |
| In-app image viewer | click an image in the sidebar | Renders the image in place of the editor/preview panes. Esc or × closes it. |
| App-wide zoom | ⌘= / ⌘- / ⌘0 | Webview-level zoom (everything scales), 50%–300% in 10% steps, persisted across restarts. |

## Workflow

- **Get upstream updates**: `scripts/local/update-from-upstream.sh` (fetches + merges `upstream/main` into `custom`), resolve any conflicts, then rebuild.
- **Build + install**: `scripts/local/build-install.sh` — builds the release bundle (updater artifacts disabled; they need upstream's signing key) and copies the app to `/Applications/marka.md.app`.
- **In-app update prompts**: decline them — they would replace the custom build with upstream's binary. Updates come via the merge script + rebuild instead.

## Files touched by the customisations

- `src/app.tsx` — view mode, zoom state, image-view state, shortcuts, render branches
- `src/components/editor/image-view.tsx` — new component
- `src/lib/media-assets.ts`, `src/lib/storage.ts`, `src/lib/index.ts` — helpers + storage key
- `src/styles/editor/panes.css` — preview-solo + image-view styles
- `src-tauri/capabilities/default.json` — webview zoom permission

Keeping the diff small and localised is deliberate — it keeps upstream merges low-conflict.
