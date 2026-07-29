<p align="center">
  <img src="./assets/readme-icon.png" width="180" alt="marka.md app icon" />
</p>

<h1 align="center">marka.md</h1>

<p align="center"><em>a local markdown editor for the notes you share with ai.</em></p>

<p align="center">
  <a href="https://markamd.vercel.app"><img src="https://img.shields.io/badge/site-markamd.vercel.app-orange?style=flat-square" alt="site" /></a>
  <a href="https://github.com/sashamerzliakov/markamd/releases/latest"><img src="https://img.shields.io/github/v/release/sashamerzliakov/markamd?style=flat-square&color=orange&label=fork%20release&include_prereleases" alt="fork release" /></a>
  <a href="https://github.com/mattenarle10/markamd/releases/latest"><img src="https://img.shields.io/github/v/release/mattenarle10/markamd?style=flat-square&color=black&label=upstream" alt="upstream release" /></a>
    <a href="https://github.com/mattenarle10/markamd/stargazers"><img src="https://img.shields.io/github/stars/mattenarle10/markamd?style=flat-square&color=black&label=stars" alt="stars" /></a>
  <a href="https://opencollective.com/markamd"><img src="https://img.shields.io/opencollective/all/markamd?style=flat-square&color=orange&label=open%20collective" alt="open collective" /></a>
  <img src="https://img.shields.io/badge/macOS-13%2B-black?style=flat-square" alt="macos" />
  <img src="https://img.shields.io/badge/Windows-10%2B-black?style=flat-square" alt="windows" />
  <img src="https://img.shields.io/badge/Linux-x86__64-black?style=flat-square" alt="linux" />
  <img src="https://img.shields.io/badge/license-MIT-black?style=flat-square" alt="mit" />
  <img src="https://img.shields.io/badge/fork%20build-unsigned-black?style=flat-square" alt="fork build unsigned" />
</p>

a cross-platform (**macOS · Windows · Linux**) markdown editor specialized for **ai context management**. live editor, rendered preview, file tabs, csv preview, grouped themes, smarter command palette, and a context tray for staging multiple notes into one AI-ready bundle.

> built around one loop: **collect notes → write → share with ai**. nothing leaves your machine until you copy.

works with claude, chatgpt, gemini, local agents, and anything that reads plain markdown.

## about this fork

this is [Sasha Merzliakov](https://github.com/sashamerzliakov)'s fork of [mattenarle10/markamd](https://github.com/mattenarle10/markamd) — all credit for the app itself to [Matt Enarle](https://github.com/mattenarle10).

built openly with AI assistance (Claude) — i find the problems, direct the work, and verify the results in daily use; the AI does the heavy lifting on implementation, root-cause tracing, and tests. commit trailers carry the co-author tag.

the `custom` branch adds, on top of upstream:

- **text-first file handling** — media formats and opaque binaries are enumerated; *everything else* opens straight in the editor. no extension allowlist to fall off the end of, so `.tf`, `.nix`, `.tex`, `Makefile`, `Dockerfile` and friends all just work. a NUL-byte sniff refuses actual binaries with a reason instead of opening them as mojibake
- **live update** — every open tab tracks its file on disk, not just the focused one. an agent rewriting a file you're reading updates it in place, cursor and scroll position intact
- **files open as tabs, not modals** — images (incl. heic / avif / tiff), PDFs, video and audio render in a tab; the file you were working on stays open behind it. office formats and archives get a launcher card
- **⌘E — show me the editable form** — cycles panes on markdown / html / csv, flips a rendered svg to its source and back
- **editable html with live preview** — edit left, rendered pane right, like markdown
- **dotenv files are visible** — `.env` and `.env.*` show in the explorer and open like any other text file
- **folder favourites** — star a folder, click it to open as a workspace root
- **app-wide zoom** — ⌘= / ⌘+ / ⌘- / ⌘0, persisted (merged upstream in [#123](https://github.com/mattenarle10/markamd/pull/123))
- **perf: non-scanning folder watchers** — fixes a startup / add-folder freeze on large folders (merged upstream in [#122](https://github.com/mattenarle10/markamd/pull/122))

details and the fork workflow live in [CUSTOM.md](./CUSTOM.md). generalisable pieces get PRed upstream; the personal ones stay here.

**getting this build:** the release badges and the install link below point at
[upstream's releases](https://github.com/mattenarle10/markamd/releases/latest) — downloading those gives you Matt's app, not this fork. to get the features listed above, build from source:

```bash
git clone https://github.com/sashamerzliakov/markamd.git
cd markamd && bun install
scripts/local/build-install.sh   # macOS — builds and copies to /Applications
```

the build script disables updater artifacts (they need upstream's signing key), so this build won't auto-update. decline any in-app update prompt — it would replace the fork with upstream's binary.

## what you get

| area | details |
|---|---|
| writing | live preview, shiki highlighting, mermaid diagrams, media previews, task lists, mark/strike syntax, reading mode, editor-only mode, opt-in vim |
| ai context | stage sidebar files, see file/token counts, copy one AI-ready bundle with relative paths |
| files | tabs, folder sidebar, favorites, search, drag-to-move, undo file ops, copy paths, reveal in file manager, useful dot-tool folders |
| data + export | capped CSV preview, rendered code copy buttons, mermaid-aware PDF export, stable print margins |
| desktop polish | grouped themes, transparency controls, platform-aware shortcuts, session restore, external file watching, signed updates |

## install

> **this fork builds for macOS (apple silicon) only.** upstream ships Windows,
> Linux and intel mac — if you want those, [get them from
> mattenarle10/markamd](https://github.com/mattenarle10/markamd/releases/latest)
> and note you'll be running the original app, without the fork features listed
> above.

[**download the latest fork release →**](https://github.com/sashamerzliakov/markamd/releases/latest)

### macOS (apple silicon)

grab `marka.md.dmg` → drag **marka.md.app** into `/Applications` → open.

first launch is unsigned, so macOS will block it: **right-click the app → Open**,
then confirm. or `xattr -dr com.apple.quarantine /Applications/marka.md.app`.

**no auto-update.** the in-app updater is disabled in this build — it needs
upstream's signing key, and pointing it at upstream's manifest would replace
this fork with the original app. decline any update prompt. to update, pull and
rebuild, or grab the next release here.

**not on homebrew.** `brew install --cask mattenarle10/tap/marka-md` installs
*upstream's* build, not this one.

### from source

requires bun, rust, and platform build tools. on Linux, install `libwebkit2gtk-4.1-dev libsoup-3.0-dev` and related Tauri deps.

```sh
bun install
bun run tauri dev      # native window with hmr
bun run tauri build    # produces .dmg / .exe / .AppImage / .deb / .rpm under src-tauri/target/release/bundle/
```

## keyboard

shortcuts shown with **macOS** modifiers below. on **Windows / Linux**, substitute `⌘` → `Ctrl`, `⌥` → `Alt`, `⇧` → `Shift`.

| key | does |
|---|---|
| ⌘K | command palette |
| ⌘O | open a `.md` file |
| ⌘⇧O | open a folder of notes |
| ⌘N | new untitled buffer |
| ⌘T | new untitled tab |
| ⌘S | save |
| ⌘⇧S | save as (also handles untitled buffers) |
| ⌘B | toggle sidebar |
| ⌘1…9 | switch to tab 1 through 9 |
| ⌘. | toggle reading mode (preview only) |
| ⌘⇧. | toggle editor-only mode (preview hidden) |
| ⌘F | find / replace in editor · or find in reading mode |
| ⌘G | find next match |
| ⌘⌥Z | undo last sidebar file op (move / rename / new / delete) |
| ⌘⇧C | copy markdown to clipboard |
| command palette → copy context bundle | copy the staged context bundle |
| ⌘P | export to pdf (also visible in the top file-action row) |
| ⌃⌘F | toggle fullscreen (macOS) · F11 on Windows/Linux |
| ⌘/ | help overlay |
| esc | close any popup |

## stack

| layer | choice |
|---|---|
| shell | tauri 2.11 (rust + webview), macOS universal (arm64 + x86_64) · Windows · Linux |
| frontend | react 19 · vite 7 · typescript 5.9 · bun |
| editor | codemirror 6 + `@codemirror/lang-markdown` + `@codemirror/search` · opt-in vim via `@replit/codemirror-vim` |
| markdown | markdown-it + markdown-it-mark + markdown-it-task-lists + shiki (lazy themes + langs) + mermaid (lazy) |
| icons | lucide-react |
| styling | css variables, no framework |

## roadmap

Per-release detail lives on the [changelog](https://markamd.vercel.app/changelog).

- [x] v1.5 core loop: context tray, file tabs, CSV preview, grouped themes, interface languages, PDF/export polish, file workflow improvements, preview link handling, and scroll memory
- [x] v1.5.12 polish: smoother preview scrolling, cleaner sidebar, refreshed demo doc, quickstart tutorial updates, and smarter command palette search
- [x] v1.5.18 polish: playable media previews and faster tab shortcuts
- [x] v1.6.0 workflow: separate preview windows, command-palette markdown insertions, and Traditional Chinese localization
- [x] v1.6.1 workflow: automatic folder monitoring, native file watching, and lazy markdown highlighting
- [ ] next: native/silent PDF generation
- [ ] next: context handoff presets for bring-your-own-ai workflows, starting with markdown and XML-tag bundle formats

Release work follows the [release checklist](docs/release-checklist.md), including the post-release site refresh check.

## contributors

Thanks to everyone helping shape marka.md through PRs, issues, testing, and feedback.

<p>
  <a href="https://github.com/mattenarle10/markamd/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=mattenarle10/markamd" alt="marka.md contributors" />
  </a>
</p>

Small, focused PRs are easiest to review and ship. Good places to help:

- bug fixes from the [issue tracker](https://github.com/mattenarle10/markamd/issues)
- platform polish for Windows, Linux, and Intel macOS
- markdown, mermaid, PDF, and translation edge cases
- small UX improvements with screenshots or short screen recordings

Before opening a PR:

- keep one behavior change per PR when possible
- include screenshots for UI changes
- update help/about/readme copy when the user-facing surface changes
- run `bun test`, `bun run build`, and `cargo check --release` from `src-tauri`

## privacy

local-first. no telemetry, no accounts, no cloud sync. your `.md` files stay on disk, and clipboard transfers happen only when you copy.

see [the full privacy notice](https://markamd.vercel.app/privacy) for the website analytics caveat (vercel speed insights, cookieless).

## feedback

ideas, bugs, or just want to say hi?

- **structured form (GitHub)** — [feedback](https://github.com/mattenarle10/markamd/issues/new?template=feedback.yml) · [bug report](https://github.com/mattenarle10/markamd/issues/new?template=bug-report.yml)
- **prefer email?** → [enarlem10@gmail.com](mailto:enarlem10@gmail.com?subject=marka.md%20feedback)
- **landing page hub** → [markamd.vercel.app/feedback](https://markamd.vercel.app/feedback)
- **security issues** → [SECURITY.md](./SECURITY.md)

## support

marka.md is free + MIT. if it saves you time, [star the repo](https://github.com/mattenarle10/markamd), share it with another dev, or support ongoing development through [Open Collective](https://opencollective.com/markamd).

## license

mit · matt enarle ([@mattenarle10](https://github.com/mattenarle10))
