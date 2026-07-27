import { expect, test } from "bun:test";
import { isVisibleTreeEntryName, relativePath } from "../src/lib/files";

test("shows common dot-prefixed tool folders", () => {
  for (const name of [".agent", ".claude", ".codex", ".cursor", ".github", ".vscode"]) {
    expect(isVisibleTreeEntryName(name)).toBe(true);
  }
});

test("keeps noisy hidden entries filtered", () => {
  for (const name of [".git", ".DS_Store", ".cache", ".envrc-backup"]) {
    expect(isVisibleTreeEntryName(name)).toBe(false);
  }
});

// fork divergence from upstream: dotenv files are shown (and editable)
test("shows dotenv files", () => {
  for (const name of [".env", ".env.local", ".env.production"]) {
    expect(isVisibleTreeEntryName(name)).toBe(true);
  }
});

test("shows regular entries", () => {
  expect(isVisibleTreeEntryName("notes")).toBe(true);
  expect(isVisibleTreeEntryName("readme.md")).toBe(true);
});

test("formats relative paths only inside the selected root", () => {
  expect(relativePath("/notes/project/brief.md", "/notes/project")).toBe("brief.md");
  expect(relativePath("/notes/project-extra/brief.md", "/notes/project")).toBe("brief.md");
  expect(relativePath("C:\\notes\\project\\brief.md", "C:\\notes\\project")).toBe("brief.md");
});
