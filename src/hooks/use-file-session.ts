import { useCallback, useEffect, useRef, useState } from "react";
import {
  basename,
  fileViewerKindForPath,
  joinPath,
  pathExists,
  pickSaveMarkdown,
  readMarkdown,
  STORAGE_KEYS,
  validatePlainTextFile,
  validateSupportedTextFile,
  writeMarkdown,
} from "@/lib";
import { DEMO_MARKDOWN } from "@/lib/demo";
import type { SaveStatus } from "@/components/chrome";
import { usePersistedState } from "./use-persisted-state";
import { useFileWatcher } from "./use-file-watcher";

const SAVED_FLASH_MS = 1200;
const RELOAD_TOAST_MS = 2400;
const INITIAL_TAB_ID = "tab-0";
const UNTITLED_TITLE = "untitled";

export type LoadError = { message: string; path?: string; canOpenAsText?: boolean };

export type ExternalChangeAction = "none" | "background" | "reload" | "conflict";

/**
 * Decide what a disk change to `path` means, given the session state at the
 * moment of the decision.
 *
 * Pure and separate from the hook on purpose. The dangerous version of this
 * logic reads "is this file active?" before awaiting the file read and trusts
 * it afterwards — by which point the user may have switched tabs, so the
 * reload lands in the wrong buffer and the next save writes it to the wrong
 * file. Taking every input as an argument makes that ordering explicit at the
 * call site rather than implicit in a closure.
 */
export function resolveExternalChange(input: {
  path: string;
  activePath: string | null;
  fresh: string;
  source: string;
  savedContent: string;
}): ExternalChangeAction {
  const { path, activePath, fresh, source, savedContent } = input;
  if (path !== activePath) return "background";
  if (fresh === source) return "none";
  return source === savedContent ? "reload" : "conflict";
}

/**
 * Keep only the reload tokens whose paths are still open.
 *
 * Returns the original object when nothing needs dropping — the identity check
 * is load-bearing, not an optimisation: this feeds a setState inside an effect,
 * and returning a fresh object every run would re-render forever.
 */
export function pruneReloadTokens(
  tokens: Record<string, number>,
  openPaths: readonly string[],
): Record<string, number> {
  const open = new Set(openPaths);
  const keys = Object.keys(tokens);
  if (keys.every((key) => open.has(key))) return tokens;
  const next: Record<string, number> = {};
  for (const key of keys) {
    if (open.has(key)) next[key] = tokens[key];
  }
  return next;
}
export type FileTab = {
  id: string;
  path: string | null;
  title: string;
  source: string;
  savedContent: string;
  waitMarkers: string[];
};

export type LoadFileOptions = {
  waitMarker?: string | null;
};

type UseFileSessionArgs = {
  onLoadError?: (err: LoadError) => void;
};

type UseFileSessionResult = {
  source: string;
  setSource: (v: string) => void;
  savedContent: string;
  activePath: string | null;
  setActivePath: (v: string | null | ((p: string | null) => string | null)) => void;
  tabs: FileTab[];
  activeTabId: string;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  reorderTabs: (from: number, to: number) => void;
  rootPath: string | null;
  setRootPath: (v: string | null | ((p: string | null) => string | null)) => void;
  saveStatus: SaveStatus;
  recentFiles: string[];
  setRecentFiles: (v: string[] | ((prev: string[]) => string[])) => void;
  externalReloadToast: boolean;
  dismissExternalReload: () => void;
  externalConflict: string | null;
  setExternalConflict: (v: string | null) => void;
  /** Accept fresh content from disk (external-change reload, "discard mine"). */
  acceptExternalChange: (fresh: string) => void;
  loadFile: (path: string, options?: LoadFileOptions) => Promise<void>;
  /** Open a non-text file (image / pdf / html) as a read-only viewer tab. */
  openViewerTab: (path: string) => void;
  /** Per-path counter bumped when a viewer tab's file changes on disk. */
  viewerReloadTokens: Record<string, number>;
  loadDemo: () => void;
  saveNow: (path: string, content: string) => Promise<void>;
  /** Picks save location + writes. Returns the chosen path (or null if cancelled). */
  saveAs: () => Promise<string | null>;
  /** Discard buffer, leave activePath null. Accepts optional initial text for OS-drop. */
  startNewBuffer: (initial?: string) => void;
  /** Load any file as plain text, bypassing extension validation. */
  loadPlainTextFile: (path: string) => Promise<void>;
  dirty: boolean;
};

export function useFileSession({ onLoadError }: UseFileSessionArgs = {}): UseFileSessionResult {
  const [source, setSource] = useState<string>(DEMO_MARKDOWN);
  const [savedContent, setSavedContent] = useState<string>(DEMO_MARKDOWN);
  const [activePath, setActivePath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFile,
    null,
  );
  const [rootPath, setRootPath] = usePersistedState<string | null>(
    STORAGE_KEYS.lastFolder,
    null,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [recentFiles, setRecentFiles] = usePersistedState<string[]>(
    STORAGE_KEYS.recentFiles,
    [],
  );
  const [externalReloadToast, setExternalReloadToast] = useState(false);
  const reloadToastTimer = useRef<number | null>(null);
  const [externalConflict, setExternalConflict] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const tabSeq = useRef(1);
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB_ID);
  const [tabs, setTabs] = useState<FileTab[]>([
    {
      id: INITIAL_TAB_ID,
      path: null,
      title: UNTITLED_TITLE,
      source: DEMO_MARKDOWN,
      savedContent: DEMO_MARKDOWN,
      waitMarkers: [],
    },
  ]);

  const sourceRef = useRef(source);
  const savedRef = useRef(savedContent);
  const activePathRef = useRef(activePath);

  // Bumped per viewer-tab path when its file changes on disk — FileView keys
  // its read on this, since a rendered image/pdf has no text buffer to diff.
  const [viewerReloadTokens, setViewerReloadTokens] = useState<Record<string, number>>({});

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(() => {
    savedRef.current = savedContent;
  }, [savedContent]);
  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  // Every open tab is watched, not just the focused one: a background tab that
  // silently went stale is the case where a later save clobbers an agent's work.
  const watchedTabPaths = tabs
    .map((tab) => tab.path)
    .filter((path): path is string => path != null);
  const watchedTabPathsKey = watchedTabPaths.join("\0");

  // Drop reload tokens for paths that are no longer open. Reconciled against
  // the open set rather than hooked into closeTab, because a tab can leave the
  // set several ways (close, close-others, replaced blank buffer) and a token
  // map that only ever grows is a slow leak across a long session.
  useEffect(() => {
    setViewerReloadTokens((prev) => pruneReloadTokens(prev, watchedTabPathsKey.split("\0")));
    // watchedTabPaths is a fresh array each render; the joined key is the stable dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedTabPathsKey]);

  const makeTabId = useCallback(() => {
    const next = tabSeq.current;
    tabSeq.current += 1;
    return `tab-${Date.now()}-${next}`;
  }, []);

  const titleForPath = useCallback((path: string | null) => (
    path ? basename(path) : UNTITLED_TITLE
  ), []);

  const appendWaitMarker = useCallback((markers: string[], marker?: string | null) => {
    if (!marker || markers.includes(marker)) return markers;
    return [...markers, marker];
  }, []);

  useEffect(() => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== activeTabId) return tab;
      if (activePath === null) return { ...tab, path: null, title: UNTITLED_TITLE };
      if (!tab.path) return tab;
      return { ...tab, path: activePath, title: titleForPath(activePath) };
    }));
  }, [activePath, activeTabId, titleForPath]);

  const snapshotActiveTab = useCallback((items: FileTab[]) =>
    items.map((tab) => (
      tab.id === activeTabId
        ? {
            ...tab,
            path: tab.path ? activePathRef.current : null,
            title: titleForPath(tab.path ? activePathRef.current : null),
            source: sourceRef.current,
            savedContent: savedRef.current,
          }
        : tab
    )), [activeTabId, titleForPath]);

  const setSourceAndTab = useCallback((next: string) => {
    setSource(next);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId ? { ...tab, source: next } : tab
    )));
  }, [activeTabId]);

  const dismissExternalReload = useCallback(() => {
    if (reloadToastTimer.current !== null) {
      window.clearTimeout(reloadToastTimer.current);
      reloadToastTimer.current = null;
    }
    setExternalReloadToast(false);
  }, []);

  /** Show the reload toast for a full window, restarting rather than stacking.
   *  Back-to-back external changes previously each queued their own timeout, so
   *  the first to expire cleared a toast the later ones had just raised. */
  const flashExternalReload = useCallback(() => {
    if (reloadToastTimer.current !== null) window.clearTimeout(reloadToastTimer.current);
    setExternalReloadToast(true);
    reloadToastTimer.current = window.setTimeout(() => {
      reloadToastTimer.current = null;
      setExternalReloadToast(false);
    }, RELOAD_TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (reloadToastTimer.current !== null) window.clearTimeout(reloadToastTimer.current);
  }, []);

  const acceptExternalChange = useCallback((fresh: string) => {
    setSource(fresh);
    setSavedContent(fresh);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId ? { ...tab, source: fresh, savedContent: fresh } : tab
    )));
    setSaveStatus("idle");
  }, [activeTabId]);

  const switchTab = useCallback((id: string) => {
    const next = snapshotActiveTab(tabs).find((tab) => tab.id === id);
    if (!next) return;
    setTabs((prev) => snapshotActiveTab(prev));
    setActiveTabId(next.id);
    setSource(next.source);
    setSavedContent(next.savedContent);
    setActivePath(next.path);
    setSaveStatus(next.source === next.savedContent ? "idle" : "dirty");
  }, [snapshotActiveTab, setActivePath, tabs]);

  const reorderTabs = useCallback((from: number, to: number) => {
    setTabs((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    const current = snapshotActiveTab(tabs);
    const closingIndex = current.findIndex((tab) => tab.id === id);
    if (closingIndex === -1) return;

    const remaining = current.filter((tab) => tab.id !== id);
    if (remaining.length === 0) {
      const blank: FileTab = {
        id: makeTabId(),
        path: null,
        title: UNTITLED_TITLE,
        source: "",
        savedContent: "",
        waitMarkers: [],
      };
      setTabs([blank]);
      setActiveTabId(blank.id);
      setSource("");
      setSavedContent("");
      setActivePath(null);
      setSaveStatus("idle");
      return;
    }

    setTabs(remaining);
    if (id !== activeTabId) return;
    const next = remaining[Math.min(closingIndex, remaining.length - 1)];
    setActiveTabId(next.id);
    setSource(next.source);
    setSavedContent(next.savedContent);
    setActivePath(next.path);
    setSaveStatus(next.source === next.savedContent ? "idle" : "dirty");
  }, [activeTabId, makeTabId, setActivePath, snapshotActiveTab, tabs]);

  const loadFile = useCallback(
    async (path: string, options: LoadFileOptions = {}) => {
      const seq = ++loadSeq.current;
      const existing = snapshotActiveTab(tabs).find((tab) => tab.path === path);
      if (existing) {
        if (options.waitMarker) {
          setTabs((prev) => snapshotActiveTab(prev).map((tab) => (
            tab.id === existing.id
              ? { ...tab, waitMarkers: appendWaitMarker(tab.waitMarkers, options.waitMarker) }
              : tab
          )));
        }
        if (activePathRef.current !== path) switchTab(existing.id);
        return;
      }
      const check = await validateSupportedTextFile(path);
      if (seq !== loadSeq.current) return;
      if (!check.ok) {
        // Check if it might be openable as plain text despite unsupported extension
        const plainCheck = await validatePlainTextFile(path);
        const canOpenAsText = plainCheck.ok;
        onLoadError?.({ message: check.reason, path, canOpenAsText });
        console.warn("marka.md: refused to open", path, "·", check.reason);
        return;
      }
      try {
        const content = await readMarkdown(path);
        if (seq !== loadSeq.current) return;
        setSource(content);
        setSavedContent(content);
        setActivePath(path);
        const tab: FileTab = {
          id: makeTabId(),
          path,
          title: titleForPath(path),
          source: content,
          savedContent: content,
          waitMarkers: options.waitMarker ? [options.waitMarker] : [],
        };
        setTabs((prev) => [...snapshotActiveTab(prev), tab]);
        setActiveTabId(tab.id);
        setSaveStatus("idle");
        setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 8));
      } catch (err) {
        console.error("marka.md: readMarkdown failed", err);
        onLoadError?.({ message: String(err), path });
      }
    },
    [
      makeTabId,
      setActivePath,
      setRecentFiles,
      onLoadError,
      snapshotActiveTab,
      switchTab,
      tabs,
      titleForPath,
      appendWaitMarker,
    ],
  );

  // Open a non-text file (image / pdf / html) as a viewer tab. The tab carries
  // empty source/savedContent so it can never be dirty; the app shell renders
  // a FileView for it instead of the editor, keyed off the tab's path.
  const openViewerTab = useCallback((path: string) => {
    const existing = snapshotActiveTab(tabs).find((tab) => tab.path === path);
    if (existing) {
      if (activePathRef.current !== path) switchTab(existing.id);
      return;
    }
    const tab: FileTab = {
      id: makeTabId(),
      path,
      title: titleForPath(path),
      source: "",
      savedContent: "",
      waitMarkers: [],
    };
    setSource("");
    setSavedContent("");
    setActivePath(path);
    setTabs((prev) => [...snapshotActiveTab(prev), tab]);
    setActiveTabId(tab.id);
    setSaveStatus("idle");
  }, [makeTabId, setActivePath, snapshotActiveTab, switchTab, tabs, titleForPath]);

  const loadDemo = useCallback(() => {
    setSource(DEMO_MARKDOWN);
    setSavedContent(DEMO_MARKDOWN);
    setActivePath(null);
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTabId
        ? {
            ...tab,
            path: null,
            title: UNTITLED_TITLE,
            source: DEMO_MARKDOWN,
            savedContent: DEMO_MARKDOWN,
            waitMarkers: [],
          }
        : tab
    )));
    setSaveStatus("idle");
  }, [activeTabId, setActivePath]);

  const startNewBuffer = useCallback((initial: string = "") => {
    const tab: FileTab = {
      id: makeTabId(),
      path: null,
      title: UNTITLED_TITLE,
      source: initial,
      savedContent: initial,
      waitMarkers: [],
    };
    setSource(initial);
    setSavedContent(initial);
    setActivePath(null);
    setTabs((prev) => [...snapshotActiveTab(prev), tab]);
    setActiveTabId(tab.id);
    setSaveStatus("idle");
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(".mdv-editor .cm-content");
      editor?.focus();
    });
  }, [makeTabId, setActivePath, snapshotActiveTab]);

  const saveNow = useCallback(async (path: string, content: string) => {
    setSaveStatus("saving");
    try {
      await writeMarkdown(path, content);
      setSavedContent(content);
      setTabs((prev) => prev.map((tab) => (
        tab.id === activeTabId
          ? { ...tab, path, title: titleForPath(path), source: content, savedContent: content }
          : tab
      )));
      setSaveStatus("saved");
      window.setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_FLASH_MS);
    } catch (err) {
      console.error("marka.md: writeMarkdown failed", err);
      setSaveStatus("dirty");
    }
  }, [activeTabId, titleForPath]);

  const loadPlainTextFile = useCallback(async (path: string) => {
    const seq = ++loadSeq.current;
    const existing = snapshotActiveTab(tabs).find((tab) => tab.path === path);
    if (existing) {
      if (activePathRef.current !== path) switchTab(existing.id);
      return;
    }
    const check = await validatePlainTextFile(path);
    if (seq !== loadSeq.current) return;
    if (!check.ok) {
      onLoadError?.({ message: check.reason, path });
      return;
    }
    try {
      const content = await readMarkdown(path);
      if (seq !== loadSeq.current) return;
      setSource(content);
      setSavedContent(content);
      setActivePath(path);
      const tab: FileTab = {
        id: makeTabId(),
        path,
        title: titleForPath(path),
        source: content,
        savedContent: content,
        waitMarkers: [],
      };
      setTabs((prev) => [...snapshotActiveTab(prev), tab]);
      setActiveTabId(tab.id);
      setSaveStatus("idle");
      setRecentFiles((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 8));
    } catch (err) {
      console.error("marka.md: loadPlainTextFile failed", err);
      onLoadError?.({ message: String(err), path });
    }
  }, [makeTabId, setActivePath, setRecentFiles, onLoadError, snapshotActiveTab, switchTab, tabs, titleForPath]);

  const saveAs = useCallback(async (): Promise<string | null> => {
    const defaultPath = activePath
      ?? (rootPath ? joinPath(rootPath, "untitled.md") : "untitled.md");
    const target = await pickSaveMarkdown(defaultPath);
    if (!target) return null;
    await saveNow(target, source);
    setActivePath(target);
    return target;
  }, [activePath, rootPath, source, saveNow, setActivePath]);

  const handleExternalChange = useCallback(async (path: string) => {
    // Viewer tabs hold no text buffer — bump a token and let FileView re-read.
    if (fileViewerKindForPath(path) !== null) {
      setViewerReloadTokens((prev) => ({ ...prev, [path]: (prev[path] ?? 0) + 1 }));
      return;
    }
    try {
      const fresh = await readMarkdown(path);

      // Every input to the decision is read AFTER the await, deliberately. The
      // user can switch tabs while the read is in flight, and setSource /
      // setSavedContent below write to whichever tab is focused *now* — so
      // deciding "is this the active file?" beforehand would pour this file's
      // content into a different tab, and the next save would commit it to
      // that file on disk.
      const action = resolveExternalChange({
        path,
        activePath: activePathRef.current,
        fresh,
        source: sourceRef.current,
        savedContent: savedRef.current,
      });

      if (action === "none") return;

      if (action === "background") {
        // Adopt disk content outright. Unsaved edits in a tab you aren't
        // looking at are discarded — deliberate, so an agent's work is never
        // silently clobbered by a stale buffer on a later save. Flip this
        // branch to a per-tab conflict flag if that trade stops paying.
        setTabs((prev) => prev.map((tab) => (
          tab.path === path && tab.source !== fresh
            ? { ...tab, source: fresh, savedContent: fresh }
            : tab
        )));
        return;
      }

      if (action === "conflict") {
        setExternalConflict(fresh);
        return;
      }

      setSource(fresh);
      setSavedContent(fresh);
      // matched by path, not by active-tab id — paths are unique across tabs
      setTabs((prev) => prev.map((tab) => (
        tab.path === path ? { ...tab, source: fresh, savedContent: fresh } : tab
      )));
      flashExternalReload();
    } catch (err) {
      console.error("marka.md: external change reload failed", path, err);
    }
  }, []);
  useFileWatcher(watchedTabPaths, handleExternalChange);

  // mount-only: restore last open file from persisted activePath.
  useEffect(() => {
    if (!activePath) return;
    let cancelled = false;
    void (async () => {
      try {
        const exists = await pathExists(activePath);
        if (cancelled) return;
        if (exists) {
          void loadFile(activePath);
        } else {
          setActivePath(null);
        }
      } catch (err) {
        console.warn("marka.md: session restore failed", err);
        if (!cancelled) setActivePath(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mark dirty as soon as content diverges from disk
  useEffect(() => {
    if (!activePath) {
      setSaveStatus("idle");
      return;
    }
    if (source !== savedContent) {
      setSaveStatus((s) => (s === "saving" ? s : "dirty"));
    }
  }, [source, savedContent, activePath]);

  const dirty = source !== savedContent;

  return {
    source,
    setSource: setSourceAndTab,
    savedContent,
    activePath,
    setActivePath,
    tabs,
    activeTabId,
    switchTab,
    closeTab,
    reorderTabs,
    rootPath,
    setRootPath,
    saveStatus,
    recentFiles,
    setRecentFiles,
    externalReloadToast,
    dismissExternalReload,
    externalConflict,
    setExternalConflict,
    acceptExternalChange,
    loadFile,
    openViewerTab,
    viewerReloadTokens,
    loadDemo,
    saveNow,
    saveAs,
    startNewBuffer,
    loadPlainTextFile,
    dirty,
  };
}
