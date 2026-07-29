import { expect, test } from "bun:test";
import { hasPreviewRenderer, isPlainTextEditPath, isSupportedTextPath } from "../src/lib/files";
import { fileViewerKindForPath } from "../src/lib/media-assets";
import { csvDelimiterForPath, isCsvPath, parseCsvPreview } from "../src/lib/csv";

// The model: media and opaque binaries are enumerated; text is what's left.
// These tests pin the "what's left" half, because that's the part a future
// extension to the format tables could silently break.

test("classifies media by extension", () => {
  expect(fileViewerKindForPath("/a/shot.png")).toBe("image");
  expect(fileViewerKindForPath("/a/photo.heic")).toBe("image");
  expect(fileViewerKindForPath("/a/icon.ico")).toBe("image");
  expect(fileViewerKindForPath("/a/scan.tiff")).toBe("image");
  expect(fileViewerKindForPath("/a/next-gen.avif")).toBe("image");
  expect(fileViewerKindForPath("/a/clip.mp4")).toBe("video");
  expect(fileViewerKindForPath("/a/take.aiff")).toBe("audio");
  expect(fileViewerKindForPath("/a/track.aac")).toBe("audio");
  expect(fileViewerKindForPath("/a/paper.pdf")).toBe("pdf");
});

test("classifies opaque binaries as launcher-card files", () => {
  for (const p of [
    "/a/report.docx", "/a/book.epub", "/a/deck.key", "/a/sheet.numbers",
    "/a/notes.rtf", "/a/bundle.zip", "/a/data.sqlite", "/a/font.woff2",
  ]) {
    expect(fileViewerKindForPath(p)).toBe("external");
  }
});

test("anything neither media nor opaque opens as text", () => {
  // The point of the inversion: no allowlist to fall off the end of.
  for (const p of [
    "/a/main.tf", "/a/infra.hcl", "/a/Build.scala", "/a/shader.zig",
    "/a/default.nix", "/a/paper.tex", "/a/build.gradle", "/a/subs.srt",
    "/a/messages.po", "/a/notebook.ipynb", "/a/App.csproj", "/a/Makefile",
    "/a/Dockerfile", "/a/LICENSE", "/a/.env.production",
  ]) {
    expect(isPlainTextEditPath(p)).toBe(true);
    expect(isSupportedTextPath(p)).toBe(true);
  }
});

test("media and opaque binaries are not text", () => {
  for (const p of ["/a/shot.png", "/a/clip.mp4", "/a/paper.pdf", "/a/report.docx", "/a/notes.rtf"]) {
    expect(isPlainTextEditPath(p)).toBe(false);
  }
});

test("rtf is a launcher-card file, not raw markup in the editor", () => {
  // Deliberate reversal of earlier fork behaviour: editing {\rtf1\ansi...} by
  // hand was worse than handing the file to the OS.
  expect(fileViewerKindForPath("/a/letter.rtf")).toBe("external");
  expect(isPlainTextEditPath("/a/letter.rtf")).toBe(false);
});

// Regression: making text the default turned isPlainTextEditPath() true for
// .html and .csv as well. The preview gate was written against that predicate,
// so both the HTML live preview and the CSV table view silently disappeared —
// the files still opened and saved, they just lost their right-hand pane.
test("files with a preview renderer keep their pane", () => {
  for (const p of [
    "/a/notes.md", "/a/notes.markdown", "/a/notes.mdx",
    "/a/data.csv", "/a/data.tsv",
    "/a/page.html", "/a/page.htm",
  ]) {
    expect(hasPreviewRenderer(p)).toBe(true);
  }
});

test("files with no renderer are edit-only", () => {
  // a markdown preview of a python file is meaningless — don't show one
  for (const p of ["/a/script.py", "/a/config.json", "/a/main.tf", "/a/Makefile", "/a/style.css"]) {
    expect(hasPreviewRenderer(p)).toBe(false);
  }
});

test("preview eligibility is not the same question as text editability", () => {
  // both true for html/csv, which is exactly how the regression got in
  expect(isPlainTextEditPath("/a/page.html")).toBe(true);
  expect(hasPreviewRenderer("/a/page.html")).toBe(true);
  expect(isPlainTextEditPath("/a/script.py")).toBe(true);
  expect(hasPreviewRenderer("/a/script.py")).toBe(false);
});

test("tsv rides the csv table view with a tab delimiter", () => {
  expect(isCsvPath("/a/data.tsv")).toBe(true);
  expect(isCsvPath("/a/data.csv")).toBe(true);
  expect(csvDelimiterForPath("/a/data.tsv")).toBe("\t");
  expect(csvDelimiterForPath("/a/data.csv")).toBe(",");
});

test("parses tab-separated rows when given a tab delimiter", () => {
  const tsv = "name\trole\nada\tengineer\ngrace\tadmiral";
  const preview = parseCsvPreview(tsv, 200, 20, "\t");
  expect(preview.headers).toEqual(["name", "role"]);
  expect(preview.rows).toEqual([["ada", "engineer"], ["grace", "admiral"]]);
});

test("comma parsing is unchanged by the delimiter parameter", () => {
  const csv = "name,role\nada,engineer";
  expect(parseCsvPreview(csv).headers).toEqual(["name", "role"]);
  expect(parseCsvPreview(csv).rows).toEqual([["ada", "engineer"]]);
});
