# fix(preview): wire open-as-text pref, guard preview size, reach unsupported text

`fix/preview-overlay-hardening` → `main`

*Transparency up front: I hit these as a user of the quick preview; the
root-cause tracing, fixes, and verification were done with AI assistance
(Claude — see the commit trailer). I've verified the behaviour on my own
machine (macOS, Apple Silicon) and I'm happy to answer questions — same tooling
in the loop.*

Three small, independent defects in the quick file preview (#120). Each stands
alone — happy to split into separate PRs if you'd prefer.

---

## 1. `open as text` never records the extension preference

`app.tsx` has a mechanism for exactly this case, with a comment saying so:

```ts
// Plain-text fallback files cannot render in preview, so they temporarily force
// editor-only without changing the user's persisted default view mode.
} else if (extPrefs.current.get(getExt(activePath)) === "text") {
  setPlainTextEditorOnly(true);
```

`extPrefs` is only written in the two `loadError` toast handlers. Non-markdown
files never reach `loadFile`, so they never raise a `loadError` — they route to
the preview overlay instead, and the overlay's handler doesn't set it:

```ts
onOpenAsText={(p) => {
  closePreview();
  void loadPlainTextFile(p);   // no extPrefs write
}}
```

So `plainTextEditorOnly` stays `false`, and since
`editorOnly = viewMode === "editor" || plainTextEditorOnly`, a user on the
default split view opens `file.py` and gets the Python source on the left and
**the Python file rendered as markdown** on the right.

**Repro:** split view → click any `.py` in the sidebar → "open as text".

**Fix:** one line — record the preference before opening, matching what the
toast handler already does.

## 2. Media previews read the whole file with no size guard

```ts
// image / video / audio / pdf — read bytes once.
const bytes = await readFile(path);
```

No `stat`, no cap. A large video or PDF is pulled into the JS heap in full.
PDFs additionally go through `bytesToBase64` into a data URL, which is roughly
2.4× the file size again, held as a string.

The `office`/`unsupported` branch above it already calls `stat` for its info
card, so the pattern is present — it just isn't applied to the branch that
actually reads bytes.

**Fix:** `stat` first, refuse over 128 MB with a readable message, and use a
blob URL for every binary kind including PDF. `bytesToBase64` becomes unused
and is removed. The cap is a judgement call — happy to change the number.

## 3. "Open as text" is unreachable for unsupported kinds

```ts
const showOpenAsText = kind === "text" && isSupportedTextPath(path) === false;
```

Gated on the extension already being classified as text. A file that is
textual but not on the `TEXT_EXT` list — `.tf`, `.hcl`, `.scala`, `.zig`,
`.nix` — classifies as `unsupported` and dead-ends at the info card with no
way to open it, **even though `validatePlainTextFile` — the guard the button's
own handler runs — would accept it happily**. The capability is already there;
only the button is missing.

**Repro:** create `main.tf`, click it. Info card, no "open as text".

**Fix:** also show the button for `unsupported`. `validatePlainTextFile` still
runs, so a genuine binary is refused with a reason as before.

---

## Testing

- `bun test` — 71 pass, 0 fail
- `bun run build` — clean
- Manual, macOS (Apple Silicon): `.py` opened as text now renders editor-only
  rather than through the markdown preview; a large PDF is refused instead of
  loaded; `main.tf` reaches the editor.

## Notes

- No new dependencies, no new i18n keys — the size message reuses the file's
  own `formatSize` helper. Say the word if you'd rather it were translated and
  I'll add the key across the locale files.
- All three are independent commits' worth of change bundled into one; splitting
  is trivial if you prefer them separate.
