import { useEffect, useRef } from "react";
import { watchImmediate, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";

const WATCH_DEBOUNCE_MS = 250;

export function isFileContentChangeEvent(event: WatchEvent): boolean {
  if (event.type === "any") return true;
  if (typeof event.type === "string") return false;
  if ("create" in event.type || "remove" in event.type) return true;
  if ("modify" in event.type) {
    return event.type.modify.kind === "any" || event.type.modify.kind === "data";
  }
  return false;
}

type FileWatchFn = (
  path: string,
  onEvent: (event: WatchEvent) => void,
) => Promise<UnwatchFn>;

type ScheduleFn = (fn: () => void, ms: number) => unknown;
type CancelFn = (id: unknown) => void;

export type FileWatcherController = {
  /** Reconcile the watched set: only new paths gain watchers, only dropped
   *  paths lose them — unchanged paths keep theirs. */
  setPaths(paths: readonly string[]): void;
  dispose(): void;
};

export type FileWatcherControllerOptions = {
  /** Watcher factory — injectable for tests. Defaults to `watchImmediate`. */
  watch?: FileWatchFn;
  debounceMs?: number;
  isRelevant?: (event: WatchEvent) => boolean;
  schedule?: ScheduleFn;
  cancel?: CancelFn;
};

/**
 * Watches every open tab's file and reports which path changed.
 *
 * This is the folder-watcher registry (see use-folder-watcher.ts) narrowed to
 * individual files, with two differences that matter here:
 *
 *  - `onChange` receives the path. Folder watching only needs "something moved,
 *    re-read the tree"; tab reloading needs to know which buffer to refresh.
 *  - Coalescing windows are per-path, not global. An agent writing file A in a
 *    tight loop must not delay the reload of file B.
 *
 * `watchImmediate` rather than the plugin's debounced `watch`, for the reason
 * documented at length in use-folder-watcher.ts: with `delayMs` set,
 * tauri-plugin-fs routes through notify-debouncer-full, whose file-ID cache
 * stat-walks at watcher creation inside a synchronous Tauri command.
 */
export function createFileWatcherController(
  onChange: (path: string) => void,
  options: FileWatcherControllerOptions = {},
): FileWatcherController {
  const watch: FileWatchFn = options.watch ?? ((path, onEvent) => watchImmediate(path, onEvent));
  const debounceMs = options.debounceMs ?? WATCH_DEBOUNCE_MS;
  const isRelevant = options.isRelevant ?? isFileContentChangeEvent;
  const schedule: ScheduleFn = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const cancel: CancelFn = options.cancel
    ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  // path → pending watcher registration; promise identity doubles as the
  // "is this watcher still current?" token for stale callbacks.
  const registry = new Map<string, Promise<UnwatchFn | null>>();
  const timers = new Map<string, unknown>();
  let disposed = false;

  const clearTimer = (path: string) => {
    if (!timers.has(path)) return;
    cancel(timers.get(path));
    timers.delete(path);
  };

  const fire = (path: string) => {
    if (timers.has(path)) return; // window already open for this path — coalesce
    timers.set(path, schedule(() => {
      timers.delete(path);
      if (!disposed) onChange(path);
    }, debounceMs));
  };

  const add = (path: string) => {
    // `pending` is referenced inside its own initialiser — safe because the
    // whole const binding completes synchronously before any event callback
    // or rejection can run in a later task.
    const pending: Promise<UnwatchFn | null> = watch(path, (event) => {
      if (disposed || registry.get(path) !== pending) return; // stale watcher
      if (isRelevant(event)) fire(path);
    }).catch((error: unknown) => {
      console.warn(`marka.md: failed to watch file ${path}`, error);
      // evict so a later reconciliation retries — unless the path was dropped
      // or re-added (newer registration) in the meantime
      if (registry.get(path) === pending) registry.delete(path);
      return null;
    });
    registry.set(path, pending);
  };

  return {
    setPaths(paths) {
      if (disposed) return;
      const wanted = new Set(paths);
      for (const [path, pending] of registry) {
        if (wanted.has(path)) continue;
        registry.delete(path);
        clearTimer(path);
        void pending.then((unwatch) => unwatch?.());
      }
      for (const path of wanted) {
        if (!registry.has(path)) add(path);
      }
    },
    dispose() {
      disposed = true;
      for (const pending of registry.values()) {
        void pending.then((unwatch) => unwatch?.());
      }
      registry.clear();
      for (const path of Array.from(timers.keys())) clearTimer(path);
    },
  };
}

/** Watches every open tab's file and reports the path that changed on disk. */
export function useFileWatcher(
  paths: readonly string[],
  onChange: (path: string) => void,
): void {
  const onChangeRef = useRef(onChange);
  const controllerRef = useRef<FileWatcherController | null>(null);
  // sorted so the key depends on the *set* of open paths, not their order —
  // otherwise dragging a tab sideways re-runs the reconcile effect for nothing
  const pathsKey = Array.from(new Set(paths.filter((p) => p.length > 0))).sort().join("\0");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // controller per mount (not per render) — StrictMode's setup/cleanup/setup
  // gets a fresh controller each time, so dispose() can be terminal.
  useEffect(() => {
    const controller = createFileWatcherController((path) => onChangeRef.current(path));
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPaths(pathsKey ? pathsKey.split("\0") : []);
  }, [pathsKey]);
}
