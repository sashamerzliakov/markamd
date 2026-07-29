import { expect, test } from "bun:test";
import type { UnwatchFn, WatchEvent } from "@tauri-apps/plugin-fs";
import { createFileWatcherController } from "../src/hooks/use-file-watcher";

const RELEVANT: WatchEvent = { type: { modify: { kind: "data", mode: "content" } }, paths: [], attrs: null };
const IRRELEVANT: WatchEvent = { type: { access: { kind: "open", mode: "read" } }, paths: [], attrs: null };

/** Test double for watchImmediate: records registrations, exposes each
 *  watcher's event callback, resolves/rejects on demand. */
function fakeWatchFactory() {
  type Registration = {
    path: string;
    emit: (event: WatchEvent) => void;
    resolve: () => void;
    reject: (err: unknown) => void;
    unwatchCalls: number;
  };
  const registrations: Registration[] = [];
  const watch = (path: string, onEvent: (event: WatchEvent) => void): Promise<UnwatchFn> => {
    return new Promise<UnwatchFn>((resolve, reject) => {
      const reg: Registration = {
        path,
        emit: onEvent,
        resolve: () => resolve((() => { reg.unwatchCalls += 1; }) as UnwatchFn),
        reject,
        unwatchCalls: 0,
      };
      registrations.push(reg);
    });
  };
  const find = (path: string) => registrations.filter((r) => r.path === path);
  return { watch, registrations, find };
}

/** Manual scheduler — captured timers fire only when run() is called. */
function fakeScheduler() {
  const timers = new Map<number, () => void>();
  let nextId = 1;
  let scheduleCalls = 0;
  return {
    schedule: (fn: () => void) => {
      scheduleCalls += 1;
      const id = nextId++;
      timers.set(id, fn);
      return id;
    },
    cancel: (id: unknown) => { timers.delete(id as number); },
    run: () => {
      const pending = [...timers.values()];
      timers.clear();
      for (const fn of pending) fn();
    },
    get scheduleCalls() { return scheduleCalls; },
    get size() { return timers.size; },
  };
}

function harness(onChange: (path: string) => void) {
  const watcher = fakeWatchFactory();
  const clock = fakeScheduler();
  const controller = createFileWatcherController(onChange, {
    watch: watcher.watch,
    schedule: clock.schedule,
    cancel: clock.cancel,
  });
  return { watcher, clock, controller };
}

test("reports which path changed, not merely that something did", async () => {
  const changed: string[] = [];
  const { watcher, clock, controller } = harness((p) => changed.push(p));

  controller.setPaths(["/a.md", "/b.md"]);
  watcher.find("/a.md")[0].resolve();
  watcher.find("/b.md")[0].resolve();
  await Promise.resolve();

  watcher.find("/b.md")[0].emit(RELEVANT);
  clock.run();

  expect(changed).toEqual(["/b.md"]);
  controller.dispose();
});

test("coalesces per path — a burst on one file does not delay another", async () => {
  const changed: string[] = [];
  const { watcher, clock, controller } = harness((p) => changed.push(p));

  controller.setPaths(["/a.md", "/b.md"]);
  watcher.find("/a.md")[0].resolve();
  watcher.find("/b.md")[0].resolve();
  await Promise.resolve();

  // five writes to /a.md collapse into one reload...
  for (let i = 0; i < 5; i += 1) watcher.find("/a.md")[0].emit(RELEVANT);
  // ...and /b.md still gets its own window rather than riding /a.md's
  watcher.find("/b.md")[0].emit(RELEVANT);
  expect(clock.scheduleCalls).toBe(2);

  clock.run();
  expect(changed.sort()).toEqual(["/a.md", "/b.md"]);
  controller.dispose();
});

test("ignores irrelevant events", async () => {
  const changed: string[] = [];
  const { watcher, clock, controller } = harness((p) => changed.push(p));

  controller.setPaths(["/a.md"]);
  watcher.find("/a.md")[0].resolve();
  await Promise.resolve();

  watcher.find("/a.md")[0].emit(IRRELEVANT);
  clock.run();

  expect(changed).toEqual([]);
  controller.dispose();
});

test("reconciles incrementally — unchanged paths keep their watcher", async () => {
  const { watcher, controller } = harness(() => {});

  controller.setPaths(["/a.md", "/b.md"]);
  watcher.find("/a.md")[0].resolve();
  watcher.find("/b.md")[0].resolve();
  await Promise.resolve();

  // opening a third tab must not tear down and recreate the first two
  controller.setPaths(["/a.md", "/b.md", "/c.md"]);
  await Promise.resolve();

  expect(watcher.find("/a.md").length).toBe(1);
  expect(watcher.find("/b.md").length).toBe(1);
  expect(watcher.find("/c.md").length).toBe(1);
  expect(watcher.find("/a.md")[0].unwatchCalls).toBe(0);
  controller.dispose();
});

test("unwatches a path dropped from the set (tab closed)", async () => {
  const { watcher, controller } = harness(() => {});

  controller.setPaths(["/a.md", "/b.md"]);
  watcher.find("/a.md")[0].resolve();
  watcher.find("/b.md")[0].resolve();
  await Promise.resolve();

  controller.setPaths(["/a.md"]);
  await Promise.resolve();
  await Promise.resolve();

  expect(watcher.find("/b.md")[0].unwatchCalls).toBe(1);
  expect(watcher.find("/a.md")[0].unwatchCalls).toBe(0);
  controller.dispose();
});

test("suppresses events from a stale watcher after its path is dropped", async () => {
  const changed: string[] = [];
  const { watcher, clock, controller } = harness((p) => changed.push(p));

  controller.setPaths(["/a.md"]);
  const first = watcher.find("/a.md")[0];
  first.resolve();
  await Promise.resolve();

  controller.setPaths([]);
  await Promise.resolve();

  // a late event from the closed tab's watcher must not fire a reload
  first.emit(RELEVANT);
  clock.run();

  expect(changed).toEqual([]);
  controller.dispose();
});

test("evicts a failed registration so a later reconciliation retries it", async () => {
  const { watcher, controller } = harness(() => {});

  controller.setPaths(["/a.md"]);
  watcher.find("/a.md")[0].reject(new Error("permission denied"));
  await Promise.resolve();
  await Promise.resolve();

  // same path requested again — a live registry would skip it as already-known
  controller.setPaths(["/a.md"]);
  await Promise.resolve();

  expect(watcher.find("/a.md").length).toBe(2);
  controller.dispose();
});

test("dispose stops pending reloads and unwatches everything", async () => {
  const changed: string[] = [];
  const { watcher, clock, controller } = harness((p) => changed.push(p));

  controller.setPaths(["/a.md"]);
  watcher.find("/a.md")[0].resolve();
  await Promise.resolve();

  watcher.find("/a.md")[0].emit(RELEVANT);
  controller.dispose();
  await Promise.resolve();
  clock.run();

  expect(changed).toEqual([]);
  expect(watcher.find("/a.md")[0].unwatchCalls).toBe(1);
});

test("unwatches a registration that resolves after dispose", async () => {
  const { watcher, controller } = harness(() => {});

  controller.setPaths(["/a.md"]);
  controller.dispose();
  watcher.find("/a.md")[0].resolve();
  await Promise.resolve();
  await Promise.resolve();

  expect(watcher.find("/a.md")[0].unwatchCalls).toBe(1);
});
