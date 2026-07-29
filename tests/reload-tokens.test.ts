import { expect, test } from "bun:test";
import { pruneReloadTokens } from "../src/hooks/use-file-session";

test("drops tokens for paths that are no longer open", () => {
  const tokens = { "/a.png": 3, "/b.pdf": 1, "/c.svg": 7 };
  expect(pruneReloadTokens(tokens, ["/a.png", "/c.svg"])).toEqual({ "/a.png": 3, "/c.svg": 7 });
});

test("keeps counters intact for paths that survive", () => {
  const tokens = { "/a.png": 12 };
  expect(pruneReloadTokens(tokens, ["/a.png", "/new.pdf"])["/a.png"]).toBe(12);
});

test("returns the same object when nothing needs dropping", () => {
  // Identity matters: this result feeds setState inside an effect keyed on the
  // open-path list. A fresh object every pass would re-render forever.
  const tokens = { "/a.png": 1 };
  expect(pruneReloadTokens(tokens, ["/a.png"])).toBe(tokens);
  expect(pruneReloadTokens(tokens, ["/a.png", "/b.pdf"])).toBe(tokens);
});

test("returns the same object when already empty", () => {
  const tokens = {};
  expect(pruneReloadTokens(tokens, [])).toBe(tokens);
  expect(pruneReloadTokens(tokens, ["/a.png"])).toBe(tokens);
});

test("empties out when every tab closes", () => {
  expect(pruneReloadTokens({ "/a.png": 4, "/b.pdf": 2 }, [])).toEqual({});
});

test("a closed and reopened path starts clean rather than resuming its count", () => {
  const afterClose = pruneReloadTokens({ "/a.png": 9 }, []);
  expect(afterClose["/a.png"]).toBeUndefined();
});
