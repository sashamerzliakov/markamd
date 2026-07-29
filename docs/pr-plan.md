# PR plan — upstream and fork

Two tracks running in parallel:

- **Upstream** → `mattenarle10/markamd`. Three PRs, ordered by landability.
- **Fork** → `sashamerzliakov/markamd`. Same work, landed on our own `custom`
  branch and cut as a GitHub release, so the fork is a first-class package
  rather than an unreleased pile of local commits.

The tracks are **not** a 1:1 mirror, and pretending otherwise would be
misleading. Folder favourites and ⌘E view cycling already exist on `custom`
(shipped in `ae45afa` / `49b541f`), so on the fork side they are not new
features — they are already-landed work that the upstream PR is proposing for
the first time. The genuinely new fork work is the file-type model, live
update, the ⌘E rename, and four bug fixes. The fork split below reflects what
is actually new here.

---

## Upstream track

### PR 1 — `fix/preview-overlay-hardening` ✅ built, tested, committed

**Status:** ready to push. Branch off `upstream/main` @ `8722c07`.

Three independent defects in the quick file preview (#120), merged 2026-07-27.

| # | Defect | Fix |
|---|---|---|
| 1 | `onOpenAsText` never set `extPrefs`, so the `plainTextEditorOnly` guard written for this exact case never fired — a `.py` opened as text renders through the *markdown* preview in split view | Record the extension preference before opening |
| 2 | Media preview reads the whole file into the JS heap with no size check; PDF additionally base64-encoded into a data URL (~2.4× as a string) | `stat` first, refuse over 128 MB, blob URL for every binary kind |
| 3 | "Open as text" only shown for already-classified text extensions, so `.tf` / `.hcl` / `.scala` dead-end at the info card | Also offer it for `unsupported`, which `validatePlainTextFile` already accepts |

**Why it lands:** pure hardening of someone else's freshly merged feature. No
design disagreement, no new surface. Same posture that got #122 and #123 merged
without friction.

**Verification:** `bun test` 71 pass / 0 fail; `bun run build` clean.

---

### PR 2 — UX enhancement package

**Status:** to build. Branch off `upstream/main`.

| Piece | What it does | Upstream today |
|---|---|---|
| Live update for every open tab | Watch all tab paths, not just the focused one, and report which path changed | Only the active file is watched (#127) |
| Cursor-preserving reload | Apply external changes as a minimal diff (common prefix/suffix trimmed) | Full `0..len` replace — cursor jumps to end, scroll jumps |
| ⌘E view cycling | Adds a `preview` view mode and cycles split → editor → preview | Has split/reading/editor, no cycle, no preview-only |
| Folder favourites | Star folders as well as files; clicking one opens it as a workspace root | Files only |

**The risk, stated plainly:** this is a grab-bag. Reviewers generally prefer one
concern per PR, and a maintainer may ask for it to be split. Bundled here
because that is how it was scoped; if it stalls, splitting the watcher work out
on its own is the obvious rescue.

**The one genuine design question:** background tabs. Ours reloads them
silently, discarding unsaved edits, so a stale buffer can never clobber an
agent's work on a later save. That is a deliberate product call for this fork
and upstream may want the opposite. Flag it in the PR body rather than burying
it — it is the thing most likely to draw an objection, and it is isolated to
one branch of `handleExternalChange`.

---

### PR 3 — File-type enhancement package

**Status:** to build. Branch off `upstream/main`. **Conflicts with PR 1 by design.**

The UX branch: non-markdown files open as **tabs**, not a modal overlay.

| Piece | What it does |
|---|---|
| Text as the default | Media and opaque binaries are enumerated; everything else opens in the editor. No allowlist to fall off the end of |
| NUL-byte sniff | The backstop that makes text-as-default safe — how `file(1)` and git decide |
| Format breadth | +`avif` `ico` `heic` `heif` `tif` `tiff` `apng` `jfif`, +`aac` `aiff` `aif` `caf` `opus`, 40-entry opaque set (office, archives, fonts, databases) |
| Viewer tabs | Rendered in a tab; the current file stays open behind it |
| `.tsv` | Through the CSV table view with a tab delimiter |

**Sequencing:** PR 1 hardens the overlay; PR 3 replaces it. If PR 3 lands, PR 1's
fixes become moot — but PR 1 improves the shipped release in the meantime and
costs nothing if PR 3 stalls. Submit PR 1 first regardless.

**How to argue it:** lead with the three defects from PR 1 as *symptoms*, not as
criticism. "Here is a class of defect the current model produces, and a model
that does not produce it" invites a design conversation. "I prefer tabs" does
not. Concede `.rtf` — their launcher card beats our raw-markup editing.

---

## Fork track

Same work, but the fork is where it actually ships, so it gets released rather
than merely merged.

### Fork PR A — `feat/live-update` → `custom`

Auto-refresh of open files, plus the ⌘E rename.

- Multi-path watcher: every open tab watched, per-path coalescing
- Viewer tabs reload via a per-path token (images/PDF/SVG)
- Minimal-diff editor dispatch so the cursor holds position
- `resolveExternalChange()` extracted pure — the shape prevents the
  tab-switch race from being reintroduced
- ⌘⇧B → ⌘E for view cycling

### Fork PR B — `feat/file-types` → `custom`

Text-as-default classification, format breadth, `.tsv`, viewer-tab routing.

### Fork PR C — `fix/ui-regressions` → `custom`

Four fixes, three of which only a manual pass would have caught:

| Fix | Found by |
|---|---|
| Folder star vanished when hovered (CSS specificity) | Sasha, using it |
| HTML live preview and CSV table view silently disabled | Sasha, using it |
| SVG "edit as text" had no visible effect — never worked since `ae45afa` | Sasha, using it |
| Reload-token leak, tab-switch race, toast timer stacking | Gemini cross-review |

### Fork release

Cut a GitHub release on `sashamerzliakov/markamd` once A–C are merged and the
manual checklist has been run.

- **Version:** upstream is at 1.7.1 and we are still reporting 1.6.2. Version
  the fork independently so the two can't be confused — `1.7.1-fork.1` reads
  clearly as "upstream 1.7.1 plus fork work".
- **Artefacts:** macOS arm64 `.dmg`. The build script disables updater
  artefacts (they need upstream's signing key), so the release is
  download-and-install, not auto-updating.
- **Gate:** `docs/file-format-checklist.md` run end to end first. Three
  regressions this session were invisible to 92 unit tests and a type check.

---

## Order of operations

1. Push PR 1, open it upstream. Smallest, most likely to land, earns the right
   to propose PR 3 later.
2. Run the manual checklist on the fork build.
3. Land fork PRs A–C, cut the fork release.
4. Build upstream PR 2 from the merged fork work.
5. Build upstream PR 3 last, referencing PR 1's defects as evidence.

Nothing is pushed to GitHub until you say so — every branch above is local.
