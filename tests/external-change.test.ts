import { expect, test } from "bun:test";
import { resolveExternalChange } from "../src/hooks/use-file-session";

const base = {
  path: "/a.md",
  activePath: "/a.md",
  fresh: "from disk",
  source: "in editor",
  savedContent: "in editor",
};

test("reloads the active file when the buffer has no unsaved edits", () => {
  expect(resolveExternalChange(base)).toBe("reload");
});

test("prompts instead of reloading when the active buffer is dirty", () => {
  expect(resolveExternalChange({ ...base, source: "edited", savedContent: "in editor" }))
    .toBe("conflict");
});

test("does nothing when disk already matches the buffer", () => {
  // our own save echoes back through the watcher — must not loop
  expect(resolveExternalChange({ ...base, fresh: "in editor", source: "in editor" }))
    .toBe("none");
});

test("treats a non-focused file as a background tab", () => {
  expect(resolveExternalChange({ ...base, activePath: "/b.md" })).toBe("background");
});

test("treats a file with nothing focused as a background tab", () => {
  expect(resolveExternalChange({ ...base, activePath: null })).toBe("background");
});

// Regression: the read of the changed file is asynchronous, so the caller must
// pass the state as it is AFTER the await. An earlier version captured
// "is this active?" before awaiting; switching tabs mid-read then applied the
// changed file's content to the newly focused tab, and the next save committed
// it to that file on disk. Verified by cross-model review (Gemini), round 2.
test("a file that lost focus during the read is background, not active", () => {
  const duringRead = { ...base, path: "/a.md", activePath: "/a.md" };
  const afterRead = { ...duringRead, activePath: "/b.md" };

  expect(resolveExternalChange(duringRead)).toBe("reload");
  expect(resolveExternalChange(afterRead)).toBe("background");
});

test("a dirty background tab is still background — it never raises the active conflict", () => {
  // the conflict prompt targets the focused buffer; routing a background tab
  // there would prompt about a file the user isn't looking at
  expect(resolveExternalChange({
    ...base,
    activePath: "/b.md",
    source: "edited",
    savedContent: "in editor",
  })).toBe("background");
});
