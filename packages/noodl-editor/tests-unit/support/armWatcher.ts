/**
 * Arm a `ProjectFileWatcher` before you measure with it.
 *
 * 🔴 **`fs.watch(dir, { recursive: true })` is not live when `start()` returns.**
 * On macOS it is an FSEvents stream, and arming that stream is asynchronous: a
 * write that lands before the stream is live produces **no event, ever**. Not a
 * late event — no event.
 *
 * Both real-filesystem specs in this repo wrote immediately after `start()`, and
 * both have been "fixed" repeatedly by adjusting how long to wait *after* the
 * write — a 600ms sleep, then an event-wait, then a latch, then a bigger
 * ceiling. None of that can work, because the thing being waited for was never
 * coming. Measured 2026-09-10 with a 25-trial control pair on this machine:
 *
 * | write immediately after `start()` | wait for the stream first |
 * |---|---|
 * | **12 of 25 missed (48%)** under load | **0 of 25 missed** under load |
 * | 0 of 60 missed on an idle box | 0 of 60 missed on an idle box |
 *
 * ⚠️ **And when the event does fire it is fast** — 14ms idle, 208ms worst case
 * under load. So the ceiling was never the binding constraint at 4000ms and is
 * not at 30_000ms either. A miss is binary. **"Green alone, red under load" is
 * compatible with a small budget AND with an event that never fires, and only
 * the first one feels like an answer.**
 *
 * This pokes a sentinel until the watcher answers, which is the same principle
 * the specs already apply downstream: wait for the EVENT, never for a stopwatch.
 * Then it drains whatever the poking produced, so the caller measures only its
 * own write.
 *
 * @returns whether the watcher ever answered. **Assert it** — an unarmed
 * watcher is silent in exactly the way the original defect was.
 */
import * as fs from 'fs';
import * as path from 'path';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function armWatcher(options: {
  /** The watched root. */
  dir: string;
  /** The array the watcher's batch callback pushes into. Cleared before return. */
  batches: unknown[];
  /** A path under `dir`, relative, that this watcher's mapping accepts. */
  sentinel: string;
  /** The watcher's debounce, so the drain outlasts it. */
  debounceMs: number;
  attempts?: number;
  perAttemptMs?: number;
}): Promise<boolean> {
  const { dir, batches, sentinel, debounceMs, attempts = 40, perAttemptMs = 250 } = options;

  const file = path.join(dir, sentinel);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  let armed = false;
  for (let attempt = 0; attempt < attempts && !armed; attempt++) {
    fs.writeFileSync(file, JSON.stringify({ arming: attempt }));

    const deadline = Date.now() + perAttemptMs;
    while (batches.length === 0 && Date.now() < deadline) {
      await sleep(5);
    }
    armed = batches.length > 0;
  }

  // Outlast the debounce so a batch from the last poke cannot land after the
  // clear and contaminate the caller's purity assertions.
  await sleep(debounceMs * 4 + 100);
  batches.length = 0;

  return armed;
}
