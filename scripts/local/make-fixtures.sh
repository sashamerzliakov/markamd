#!/usr/bin/env bash
# Generate the file-format test fixtures used to verify viewer/editor routing.
#
# Everything here is a REAL file of its format (generated with macOS system
# tools + ffmpeg), not a stub with a renamed extension — a stub would prove the
# routing works while telling you nothing about whether WebKit can decode it.
#
# Usage: scripts/local/make-fixtures.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="test-fixtures"
rm -rf "$ROOT"
mkdir -p "$ROOT"/{01-images,02-video,03-audio,04-documents,05-text-edit,06-tables,07-opaque,08-should-refuse}

say() { printf "  %s\n" "$1"; }

# ── 01 images ────────────────────────────────────────────────────────────────
echo "images"
SRC="$ROOT/01-images/source.png"
# 640x400 test card via ffmpeg (deterministic, no external assets)
ffmpeg -loglevel error -y -f lavfi -i testsrc=size=640x400:rate=1 -frames:v 1 "$SRC"
sips -s format jpeg "$SRC" --out "$ROOT/01-images/photo.jpg"    >/dev/null
sips -s format gif  "$SRC" --out "$ROOT/01-images/animation.gif" >/dev/null
sips -s format bmp  "$SRC" --out "$ROOT/01-images/bitmap.bmp"   >/dev/null
sips -s format tiff "$SRC" --out "$ROOT/01-images/scan.tiff"    >/dev/null
sips -s format heic "$SRC" --out "$ROOT/01-images/photo.heic"   >/dev/null 2>&1 || say "heic: sips refused (skipped)"
cwebp -quiet "$SRC" -o "$ROOT/01-images/modern.webp"
avifenc --min 20 --max 30 "$SRC" "$ROOT/01-images/next-gen.avif" >/dev/null 2>&1 || say "avif: avifenc failed (skipped)"
ffmpeg -loglevel error -y -i "$SRC" -vf scale=64:64 "$ROOT/01-images/favicon.ico"
cp "$ROOT/01-images/photo.jpg" "$ROOT/01-images/legacy.jfif"
mv "$SRC" "$ROOT/01-images/testcard.png"

cat > "$ROOT/01-images/vector.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <rect width="320" height="200" fill="#1d3557"/>
  <circle cx="160" cy="100" r="64" fill="#e63946"/>
  <text x="160" y="180" fill="#f1faee" font-family="sans-serif" font-size="18" text-anchor="middle">vector.svg</text>
</svg>
SVG

# ── 02 video ─────────────────────────────────────────────────────────────────
echo "video"
ffmpeg -loglevel error -y -f lavfi -i testsrc=size=480x270:rate=24 -t 3 \
  -pix_fmt yuv420p -c:v libx264 "$ROOT/02-video/clip.mp4"
cp "$ROOT/02-video/clip.mp4" "$ROOT/02-video/clip.m4v"
ffmpeg -loglevel error -y -i "$ROOT/02-video/clip.mp4" -c copy "$ROOT/02-video/clip.mov"
ffmpeg -loglevel error -y -f lavfi -i testsrc=size=480x270:rate=24 -t 3 \
  -c:v libvpx-vp9 -b:v 300k "$ROOT/02-video/clip.webm" 2>/dev/null || say "webm: vp9 encoder missing (skipped)"
ffmpeg -loglevel error -y -f lavfi -i testsrc=size=320x180:rate=24 -t 2 \
  -c:v libtheora "$ROOT/02-video/clip.ogv" 2>/dev/null || say "ogv: theora encoder missing (skipped)"

# ── 03 audio ─────────────────────────────────────────────────────────────────
echo "audio"
TONE="$ROOT/03-audio/.tone.wav"
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=440:duration=3" "$TONE"
cp "$TONE" "$ROOT/03-audio/tone.wav"
ffmpeg -loglevel error -y -i "$TONE" "$ROOT/03-audio/tone.mp3"
ffmpeg -loglevel error -y -i "$TONE" -c:a aac "$ROOT/03-audio/tone.m4a"
ffmpeg -loglevel error -y -i "$TONE" -c:a aac -f adts "$ROOT/03-audio/tone.aac"
ffmpeg -loglevel error -y -i "$TONE" "$ROOT/03-audio/tone.flac"
ffmpeg -loglevel error -y -i "$TONE" -c:a libvorbis "$ROOT/03-audio/tone.ogg" 2>/dev/null || say "ogg: vorbis encoder missing (skipped)"
ffmpeg -loglevel error -y -i "$TONE" -c:a libopus "$ROOT/03-audio/tone.opus" 2>/dev/null || say "opus: encoder missing (skipped)"
afconvert -f AIFF -d BEI16 "$TONE" "$ROOT/03-audio/tone.aiff" 2>/dev/null || say "aiff: afconvert failed (skipped)"
afconvert -f caff -d LEI16 "$TONE" "$ROOT/03-audio/tone.caf"  2>/dev/null || say "caf: afconvert failed (skipped)"
rm -f "$TONE"

# ── 04 documents ─────────────────────────────────────────────────────────────
echo "documents"
cat > "$ROOT/.pdf-source.txt" <<'TXT'
marka.md fixture — PDF render check.

If you can read this inside the app, the PDF viewer works.
TXT
cupsfilter "$ROOT/.pdf-source.txt" > "$ROOT/04-documents/paper.pdf" 2>/dev/null
rm -f "$ROOT/.pdf-source.txt"

# ── 05 text / editable ───────────────────────────────────────────────────────
echo "text"
T="$ROOT/05-text-edit"
cat > "$T/notes.md" <<'MD'
# markdown fixture

Edit me, then press ⌘S. The **preview pane** should track edits live.
MD
cat > "$T/page.html" <<'HTML'
<h1 style="font-family: system-ui">html fixture</h1>
<p>This should render in the preview pane <em>and</em> stay editable.</p>
<p style="color:#e63946">Edit this line and watch the preview update.</p>
HTML
cat > "$T/config.json"   <<'JSON'
{ "fixture": "json", "editable": true, "nested": { "ok": 1 } }
JSON
cat > "$T/data.yaml"     <<'YAML'
fixture: yaml
editable: true
list:
  - one
  - two
YAML
cat > "$T/Cargo-ish.toml" <<'TOML'
[fixture]
name = "toml"
editable = true
TOML
cat > "$T/script.py"     <<'PY'
def fixture() -> str:
    return "python — editable"
PY
cat > "$T/app.ts"        <<'TS'
export const fixture = (): string => "typescript — editable";
TS
cat > "$T/style.css"     <<'CSS'
.fixture { color: #e63946; font-weight: 600; }
CSS
cat > "$T/run.sh"        <<'SH'
#!/usr/bin/env bash
echo "shell — editable"
SH
cat > "$T/feed.xml"      <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<fixture editable="true"><item>xml</item></fixture>
XML
cat > "$T/server.log"    <<'LOG'
2026-07-29T09:00:00Z INFO  fixture log line one
2026-07-29T09:00:01Z WARN  fixture log line two
LOG
cat > "$T/plain.txt"     <<'TXT'
plain text fixture — editable
TXT
cat > "$T/.env"          <<'ENV'
FIXTURE=dotenv
EDITABLE=true
ENV
cat > "$T/.env.production" <<'ENV'
FIXTURE=dotenv-suffixed
ENV

# the tail — formats neither implementation enumerates
cat > "$T/main.tf"       <<'TF'
resource "fixture" "terraform" { editable = true }
TF
cat > "$T/infra.hcl"     <<'HCL'
fixture "hcl" { editable = true }
HCL
cat > "$T/default.nix"   <<'NIX'
{ fixture = "nix"; editable = true; }
NIX
cat > "$T/paper.tex"     <<'TEX'
\documentclass{article}
\begin{document}fixture --- latex\end{document}
TEX
cat > "$T/subtitles.srt" <<'SRT'
1
00:00:00,000 --> 00:00:02,000
fixture — subtitle track
SRT
cat > "$T/notebook.ipynb" <<'IPYNB'
{ "cells": [], "metadata": { "fixture": "ipynb" }, "nbformat": 4, "nbformat_minor": 5 }
IPYNB
cat > "$T/build.gradle"  <<'GRADLE'
plugins { id 'fixture' }
GRADLE
printf 'all:\n\t@echo "fixture — makefile"\n' > "$T/Makefile"
cat > "$T/Dockerfile"    <<'DOCKER'
FROM scratch
LABEL fixture="dockerfile"
DOCKER
cat > "$T/LICENSE"       <<'LIC'
Fixture licence file — no extension, should still open as text.
LIC

# ── 06 tables ────────────────────────────────────────────────────────────────
echo "tables"
cat > "$ROOT/06-tables/people.csv" <<'CSV'
name,role,location
ada,engineer,london
grace,admiral,new york
katherine,mathematician,virginia
CSV
printf 'name\trole\tlocation\nada\tengineer\tlondon\ngrace\tadmiral\tnew york\n' \
  > "$ROOT/06-tables/people.tsv"

# ── 07 opaque (launcher card expected) ───────────────────────────────────────
echo "opaque"
O="$ROOT/07-opaque"
cat > "$ROOT/.doc-source.txt" <<'TXT'
marka.md fixture — this is a real word-processing document.
TXT
textutil -convert docx "$ROOT/.doc-source.txt" -output "$O/report.docx" 2>/dev/null || say "docx: textutil failed"
textutil -convert doc  "$ROOT/.doc-source.txt" -output "$O/legacy.doc"  2>/dev/null || say "doc: textutil failed"
textutil -convert odt  "$ROOT/.doc-source.txt" -output "$O/open.odt"    2>/dev/null || say "odt: textutil failed"
textutil -convert rtf  "$ROOT/.doc-source.txt" -output "$O/letter.rtf"  2>/dev/null || say "rtf: textutil failed"
rm -f "$ROOT/.doc-source.txt"
printf 'fixture archive contents\n' > "$ROOT/.arch.txt"
(cd "$ROOT" && zip -q "07-opaque/bundle.zip" ".arch.txt")
(cd "$ROOT" && tar czf "07-opaque/bundle.tar.gz" ".arch.txt")
rm -f "$ROOT/.arch.txt"
cp /System/Library/Fonts/Geneva.ttf "$O/typeface.ttf" 2>/dev/null || say "ttf: system font not found"

# minimal but valid epub (mimetype must be first and stored uncompressed)
EPUB=$(mktemp -d)
printf 'application/epub+zip' > "$EPUB/mimetype"
mkdir -p "$EPUB/META-INF" "$EPUB/OEBPS"
cat > "$EPUB/META-INF/container.xml" <<'X'
<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
X
cat > "$EPUB/OEBPS/content.opf" <<'X'
<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">marka-fixture</dc:identifier>
    <dc:title>marka.md fixture</dc:title><dc:language>en</dc:language>
  </metadata>
  <manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c1"/></spine>
</package>
X
cat > "$EPUB/OEBPS/ch1.xhtml" <<'X'
<?xml version="1.0"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>fixture</title></head>
<body><h1>marka.md epub fixture</h1></body></html>
X
( cd "$EPUB" && zip -q -X -0 book.epub mimetype && zip -q -X -r book.epub META-INF OEBPS )
cp "$EPUB/book.epub" "$O/book.epub"
rm -rf "$EPUB"

# ── 08 should refuse (binary with no entry in any table) ─────────────────────
echo "refusals"
R="$ROOT/08-should-refuse"
# NUL bytes inside an extension nobody enumerates — the sniff must catch it
printf 'MZ\x00\x00\x00binary payload\x00\x00not text at all\x00' > "$R/mystery.dat"
head -c 2048 /dev/urandom > "$R/noise.unknownext"
# a real image renamed to something unlisted — signature check should catch it
cp "$ROOT/01-images/testcard.png" "$R/disguised.wat"

cat > "$ROOT/README.md" <<'MD'
# file-format fixtures

Generated by `scripts/local/make-fixtures.sh` — regenerate any time, it wipes
and rebuilds this folder. Every file is a real file of its format.

Work through `docs/file-format-checklist.md` with this folder open as a
workspace root in the sidebar.

| Folder | Expected behaviour |
|---|---|
| `01-images` | Rendered image in a tab; `.svg` also offers "edit as text" |
| `02-video` | Native player with controls |
| `03-audio` | Native audio controls |
| `04-documents` | PDF renders in WKWebView's viewer |
| `05-text-edit` | Opens straight into the editor, editable, ⌘S saves |
| `06-tables` | Table view (`.tsv` must split on tabs, not commas) |
| `07-opaque` | Launcher card → opens in the OS default app |
| `08-should-refuse` | Refused with a reason — must NOT open as garbage text |
MD

echo
echo "Fixtures written to $ROOT/"
find "$ROOT" -type f | wc -l | xargs printf "%s files\n"
