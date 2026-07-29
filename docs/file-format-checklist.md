# File-format verification checklist

Manual pass over the file-type model. Work top to bottom, one file at a time.

**Setup**

1. Quit `marka.md.app` completely (⌘Q — not just close the window; a running instance keeps the old assets).
2. Relaunch it.
3. Add `~/work/ykeo/marka/test-fixtures` as a workspace root in the sidebar.

Regenerate the fixtures at any point with `scripts/local/make-fixtures.sh` — it wipes and rebuilds the folder.

**The four expected behaviours**

| State | What you should see |
|---|---|
| **Render** | File displayed in a tab, read-only. Current tab stays open behind it. |
| **Render ⇄ source** | Rendered, plus a control to edit the underlying text. |
| **Edit** | Opens straight into the editor. Typing works, ⌘S saves. |
| **Launcher** | A card with a button that hands the file to the OS default app. |

Anything that shows a **modal overlay** is a bug — everything opens in a tab.

---

## 1. Images → Render

Click each. Expect the image drawn in a tab.

| ☐ | File | Expect | Notes |
|---|---|---|---|
| ☐ | `01-images/testcard.png` | Colour test card | Baseline — if this fails, stop |
| ☐ | `01-images/photo.jpg` | Same card | |
| ☐ | `01-images/legacy.jfif` | Same card | Same decoder as jpg |
| ☐ | `01-images/animation.gif` | Same card | |
| ☐ | `01-images/bitmap.bmp` | Same card | |
| ☐ | `01-images/modern.webp` | Same card | |
| ☐ | `01-images/next-gen.avif` | Same card | **New** — verify WebKit decodes |
| ☐ | `01-images/favicon.ico` | Small 64×64 card | **New** |
| ☐ | `01-images/photo.heic` | Same card | **New, most likely to fail** — iPhone format |
| ☐ | `01-images/scan.tiff` | Same card | **New** — macOS system codec |
| ☐ | `01-images/vector.svg` | Red circle on navy | See the SVG round trip below |

If `heic`, `avif`, `tiff` or `ico` show a broken image, tell me which — they come out of the format table, not the routing, so it's a one-line revert each.

**SVG round trip** — SVG is the only format that is both rendered and editable, so it has its own path:

| ☐ | Step |
|---|---|
| ☐ | Open `01-images/vector.svg` — renders as an image |
| ☐ | Press **⌘E** — or click "edit as text" in the viewer bar (icon-only `</>` button, left of the ×). Both do the same thing |
| ☐ | **The SVG source opens in the editor**, editor-only, no preview pane. Until this fix the viewer just re-rendered over the top and the click looked like it did nothing |
| ☐ | Edit the `fill` colour, ⌘S |
| ☐ | Press **⌘E** again → back to the rendered SVG, showing your change. It's a toggle, not a one-way door |
| ☐ | Close the tab, click `vector.svg` again → renders. The source override is per-file and cleared on close |
| ☐ | Open a second SVG (any) → still renders. Choosing source for one file must not change how others open |

## 2. Video → Render

| ☐ | File | Expect |
|---|---|---|
| ☐ | `02-video/clip.mp4` | Player with controls, 3s test pattern, plays |
| ☐ | `02-video/clip.m4v` | Same |
| ☐ | `02-video/clip.mov` | Same |
| ☐ | `02-video/clip.webm` | Same |

`.ogv` has no fixture — the Theora encoder isn't installed locally. Untested, left in the table.

## 3. Audio → Render

Each is a 3-second 440 Hz tone. Expect native audio controls that actually play.

| ☐ | File | Notes |
|---|---|---|
| ☐ | `03-audio/tone.mp3` | Baseline |
| ☐ | `03-audio/tone.m4a` | |
| ☐ | `03-audio/tone.wav` | |
| ☐ | `03-audio/tone.flac` | |
| ☐ | `03-audio/tone.aac` | **New** |
| ☐ | `03-audio/tone.aiff` | **New** — macOS-native |
| ☐ | `03-audio/tone.caf` | **New** — most likely of these to fail |
| ☐ | `03-audio/tone.opus` | **New** — needs Safari 17.4+ |

`.ogg` / `.oga` have no fixture — no Vorbis encoder locally. Untested, left in the table.

## 4. Documents → Render

| ☐ | File | Expect |
|---|---|---|
| ☐ | `04-documents/paper.pdf` | WKWebView's PDF viewer, readable text, scroll/zoom works |

## 5. Text → Edit

**This is the section that matters most.** Every one of these should open *directly* in the editor on a single click — no intermediate step. Type a character in each and press ⌘S.

Familiar formats:

| ☐ | File | Extra check |
|---|---|---|
| ☐ | `05-text-edit/notes.md` | Preview pane tracks edits live |
| ☐ | `05-text-edit/page.html` | **Preview pane renders the HTML live** while editable |
| ☐ | `05-text-edit/config.json` | |
| ☐ | `05-text-edit/data.yaml` | |
| ☐ | `05-text-edit/Cargo-ish.toml` | |
| ☐ | `05-text-edit/script.py` | |
| ☐ | `05-text-edit/app.ts` | |
| ☐ | `05-text-edit/style.css` | |
| ☐ | `05-text-edit/run.sh` | |
| ☐ | `05-text-edit/feed.xml` | |
| ☐ | `05-text-edit/server.log` | |
| ☐ | `05-text-edit/plain.txt` | |
| ☐ | `05-text-edit/.env` | Visible in sidebar at all, then editable + saveable |
| ☐ | `05-text-edit/.env.production` | Same |

**The tail** — formats no version enumerates. These are the proof that text-as-default works; under the old model every one would have needed a toast and a second click, and under upstream's model several are unreachable entirely:

| ☐ | File | |
|---|---|---|
| ☐ | `05-text-edit/main.tf` | Dead end in upstream v1.7.1 |
| ☐ | `05-text-edit/infra.hcl` | Dead end in upstream v1.7.1 |
| ☐ | `05-text-edit/default.nix` | Dead end in upstream v1.7.1 |
| ☐ | `05-text-edit/paper.tex` | |
| ☐ | `05-text-edit/subtitles.srt` | |
| ☐ | `05-text-edit/notebook.ipynb` | |
| ☐ | `05-text-edit/build.gradle` | |
| ☐ | `05-text-edit/Makefile` | No extension |
| ☐ | `05-text-edit/Dockerfile` | No extension |
| ☐ | `05-text-edit/LICENSE` | No extension |

## 6. Tables → Edit + table view

| ☐ | File | Expect |
|---|---|---|
| ☐ | `06-tables/people.csv` | Table view: 3 columns (name / role / location), 3 rows |
| ☐ | `06-tables/people.tsv` | **Same 3 columns.** If you see one column with tabs in it, the delimiter didn't take |

## 7. Opaque → Launcher card

Expect a card with an "open in default app" button, **not** an editor full of binary garbage. Click through on at least one to confirm the handoff works.

| ☐ | File | |
|---|---|---|
| ☐ | `07-opaque/report.docx` | |
| ☐ | `07-opaque/legacy.doc` | |
| ☐ | `07-opaque/open.odt` | **New** |
| ☐ | `07-opaque/letter.rtf` | **Behaviour change** — used to open as raw `{\rtf1\ansi…}` markup |
| ☐ | `07-opaque/book.epub` | **New** |
| ☐ | `07-opaque/bundle.zip` | **New** |
| ☐ | `07-opaque/bundle.tar.gz` | **New** |
| ☐ | `07-opaque/typeface.ttf` | **New** |

`.xlsx` `.pptx` `.key` `.pages` `.numbers` `.xlsm` `.odp` and friends have no fixtures — they resolve to the identical `external` code path as `.docx`, so verifying docx covers them. Called out so the gap is explicit rather than implied.

## 8. Refusals → must NOT open as text

The risk of making text the default is that a binary slips through into the editor. These three probe the backstop.

| ☐ | File | Expect |
|---|---|---|
| ☐ | `08-should-refuse/mystery.dat` | Refused: "looks like a binary file". Caught by the **NUL-byte sniff** |
| ☐ | `08-should-refuse/noise.unknownext` | Refused. 2 KB of random bytes, unlisted extension |
| ☐ | `08-should-refuse/disguised.wat` | Refused: "looks like a png image". Caught by **signature**, not extension |

If any of these opens a buffer of mojibake, that's the one real regression risk in this change — flag it immediately.

## 9. Live update

Every open tab is now watched, not just the focused one. Drive these from a second terminal — the point is that changes arrive from outside the app.

**Active tab, no unsaved edits** — the case that already worked:

| ☐ | Step |
|---|---|
| ☐ | Open `05-text-edit/notes.md`. Run `echo "agent line" >> test-fixtures/05-text-edit/notes.md` |
| ☐ | Content appears within ~250 ms, brief toast confirms the reload |

**Cursor position** — the new part:

| ☐ | Step |
|---|---|
| ☐ | With `notes.md` open, click into the **middle** of the first line |
| ☐ | Append a line from the terminal again |
| ☐ | **Cursor stays where you put it** and the view doesn't jump. Before this change it would land at the end of the document |

**Active tab with unsaved edits** — must still prompt, never silently discard:

| ☐ | Step |
|---|---|
| ☐ | Type something in `notes.md` but do **not** save |
| ☐ | Append a line from the terminal |
| ☐ | Conflict prompt appears. Your edits are intact until you choose |

**Background tabs** — the gap that could lose an agent's work:

| ☐ | Step |
|---|---|
| ☐ | Open `notes.md` and `config.json`, leave `notes.md` focused |
| ☐ | `echo '{"agent":true}' > test-fixtures/05-text-edit/config.json` |
| ☐ | Switch to the `config.json` tab — it shows the **new** content |
| ☐ | Press ⌘S there. The agent's content is what gets written, not a stale buffer |

Note: a background tab with unsaved edits is reloaded silently and those edits are discarded — your call, and isolated to one branch in `handleExternalChange` if you want it changed later.

**Viewer tabs** — images and PDFs had no watcher at all before:

| ☐ | Step |
|---|---|
| ☐ | Open `01-images/testcard.png`. Run `sips -s format png test-fixtures/01-images/photo.jpg --out test-fixtures/01-images/testcard.png` |
| ☐ | The displayed image updates without reopening the tab |
| ☐ | Same for `01-images/vector.svg` — edit its text from the terminal and watch the render change |

**Rapid writes** — an agent mid-stream:

| ☐ | Step |
|---|---|
| ☐ | `for i in $(seq 1 20); do echo "line $i" >> test-fixtures/05-text-edit/notes.md; sleep 0.1; done` |
| ☐ | The tab keeps up without flickering or freezing. Coalescing is per-path at 250 ms |

**Atomic writes** — how most agents and editors actually save:

| ☐ | Step |
|---|---|
| ☐ | `cp test-fixtures/05-text-edit/notes.md /tmp/n.md && echo "atomic" >> /tmp/n.md && mv /tmp/n.md test-fixtures/05-text-edit/notes.md` |
| ☐ | The tab still updates. This replaces the file rather than writing into it, which is the classic way to go deaf to a watcher — worth confirming rather than assuming |

## 10. Regressions to spot-check

Unrelated to formats, but in the same blast radius:

| ☐ | Check |
|---|---|
| ☐ | Hover a folder row → star appears. **Hover the star itself → it stays visible** (the fix from earlier) |
| ☐ | Hover a child row inside an expanded, favourited folder → its star stays lit |
| ☐ | Tab to a folder star with the keyboard → focus ring visible |
| ☐ | Opening a viewer file keeps your current editor tab open behind it |
| ☐ | Sidebar search still finds files (it now indexes every text file, not just markdown) |
| ☐ | ⌘E view cycling still works on markdown and HTML |

---

## Report back

For anything that fails, the useful detail is: **file, what you expected, what happened.** Most failures here will be one of two kinds — a format table entry WebKit can't actually decode (one-line fix), or a routing mistake (a real bug). I can tell which from the symptom.
