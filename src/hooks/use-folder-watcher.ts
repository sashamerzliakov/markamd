import { useEffect, useRef } from "react";
import { watchImmediate, type UnwatchFn, type WatchEvent } from "@tauri-apps/plugin-fs";
import { isFilesystemRoot } from "@/lib/storage";

const WATCH_DEBOUNCE_MS = 350;

export function watchableFolderPaths(paths: readonly string[]): string[] {
  return Array.from(new Set(
    paths.filter((path) => path.length > 0 && !isFilesystemRoot(path)),
  ));
}

export function isDirectoryChangeEvent(event: WatchEvent): boolean {
  if (event.type === "any") return true;
  if (typeof event.type === "string") return false;
  if ("create" in event.type || "remove" in event.type) return true;
  if ("modify" in event.type) {
    return event.type.modify.kind === "any" || event.type.modify.kind === "rename";
  }
  return false;
}

/**
 * Watches each opened root recursively and refreshes the visible tree on
 * structure changes.
 *
 * Perf-critical details (custom fork):
 *  - `watchImmediate` + a JS-side debounce, NOT the plugin's debounced `watch`.
 *    The debounced variant builds a file-ID cache by stat-walking the entire
 *    tree on watcher creation — on large roots that froze the app at startup.
 *  - Watchers are managed incrementally: adding a folder only creates the new
 *    watcher instead of tearing down and re-creating every existing one.
 */
export function useFolderWatcher(paths: readonly string[], onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  const pathsKey = watchableFolderPaths(paths).join("\0");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // path → pending watcher; persists across effect runs so unchanged paths keep their watcher
  const registryRef = useRef(new Map<string, Promise<UnwatchFn | null>>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const registry = registryRef.current;
    const wanted = new Set(pathsKey ? pathsKey.split("\0") : []);

    for (const [path, pending] of registry) {
      if (wanted.has(path)) continue;
      registry.delete(path);
      void pending.then((unwatch) => unwatch?.());
    }

    const fire = (event: WatchEvent) => {
      if (!isDirectoryChangeEvent(event)) return;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onChangeRef.current();
      }, WATCH_DEBOUNCE_MS);
    };

    for (const path of wanted) {
      if (registry.has(path)) continue;
      const pending = watchImmediate(
        path,
        (event) => {
          // ignore events from watchers that have been removed since
          if (registry.get(path) === pending) fire(event);
        },
        { recursive: true },
      ).catch((error) => {
        console.warn(`marka.md: failed to watch folder ${path}`, error);
        return null;
      });
      registry.set(path, pending);
    }
  }, [pathsKey]);

  useEffect(() => {
    const registry = registryRef.current;
    return () => {
      for (const pending of registry.values()) {
        void pending.then((unwatch) => unwatch?.());
      }
      registry.clear();
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);
}
