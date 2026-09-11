/**
 * `src/lib/timer.ts` — the `Delay` node's scheduler, emitted into the app (EXP-011 §39).
 *
 * The same shape as {@link ./idLib.ts}: constant text, shipped only where a component calls into
 * it, and a fourth module rather than a section of `util.ts` because an app that logs a line
 * should not ship a timer.
 *
 * It is a transcription of two runtime files:
 *
 * - `noodl-viewer-react/src/nodes/std-library/timer.ts` — the three verbs and their outcomes.
 *   `Start` begins only when nothing is running (`_isRunning === false`) and reports Unchanged
 *   otherwise; `Restart` stops whatever runs and begins again, always Done; `Stop` reports Done
 *   when there was a countdown to abandon and Unchanged when there was not.
 * - `noodl-runtime/src/timerscheduler.ts` — what a countdown is: `Started` once Start Delay has
 *   elapsed, `Finished` once Duration has elapsed after that, and neither for a stopped one
 *   (`_wasStopped` suppresses `onFinish`; `stop()` resets `_hasCalledOnStart`).
 *
 * The frame loop is two `setTimeout`s, which is the one liberty taken: the interpreter's timer
 * advances with the animation frame and a duration of 0 finishes on the first frame at or after
 * its start, so here it finishes on the next macrotask after `Started`. Nothing an author can wire
 * observes the difference — both are "later, in order".
 *
 * ⚠️ **One divergence, recorded in the ledger rather than reproduced.** The scheduler marks a
 * timer running at the end of the *next frame*, so a Stop in the same tick as a Start reads
 * Unchanged in the interpreter; here the handle exists from the call and it reads Done. Both
 * remove the countdown.
 */

/** Where the module lands in the exported app. */
export const TIMER_LIB_PATH = 'src/lib/timer.ts';

/** The exported helpers. Sorted — the import list is sorted too. */
export const TIMER_HELPERS = ['restartDelay', 'startDelay', 'stopDelay'] as const;

export type TimerHelper = (typeof TIMER_HELPERS)[number];

/**
 * The module's source.
 *
 * ⚠️ A plain string rather than a template literal, for `dateLib.ts`'s stated reason: the emitted
 * body needs no interpolation, and keeping it out of an interpolation context means a future edit
 * cannot accidentally interpolate the generator's own scope into the exported app.
 */
export function timerLibSource(): string {
  return [
    '//',
    "// The Delay node's countdown, transcribed from the interpreter it has to agree with:",
    '// noodl-viewer-react/src/nodes/std-library/timer.ts over noodl-runtime/src/timerscheduler.ts.',
    '//',
    '// A countdown is a handle in a ref the component owns. Start begins one only when the ref is',
    '// empty and answers whether it did; Restart begins again regardless; Stop abandons whatever',
    '// runs and answers whether there was anything to abandon. Started fires once the start delay',
    '// has elapsed, Finished once the duration has elapsed after that, and neither for a stopped',
    '// countdown.',
    '//',
    '',
    '/** A running countdown: the pending timeout, and which phase it belongs to. */',
    'export interface DelayHandle {',
    '  timeout: ReturnType<typeof setTimeout>;',
    "  phase: 'starting' | 'running';",
    '}',
    '',
    '/** The ref a component keeps one countdown in — `useRef<DelayHandle | null>(null)`. */',
    'export type DelayRef = { current: DelayHandle | null };',
    '',
    '/** Milliseconds as the scheduler reads them: whatever arrived, coerced, never negative. */',
    'const millis = (value: unknown): number => Math.max(0, Number(value) || 0);',
    '',
    'function begin(',
    '  ref: DelayRef,',
    '  startDelay: unknown,',
    '  duration: unknown,',
    '  onStart?: () => void,',
    '  onFinish?: () => void',
    '): void {',
    '  const handle: DelayHandle = {',
    "    phase: 'starting',",
    '    timeout: setTimeout(() => {',
    '      if (ref.current !== handle) return;',
    "      handle.phase = 'running';",
    '      onStart?.();',
    '      if (ref.current !== handle) return;',
    '      handle.timeout = setTimeout(() => {',
    '        if (ref.current !== handle) return;',
    '        ref.current = null;',
    '        onFinish?.();',
    '      }, millis(duration));',
    '    }, millis(startDelay))',
    '  };',
    '  ref.current = handle;',
    '}',
    '',
    '/**',
    ' * `Start` — begins a countdown if none is running. Answers `true` for Done and `false` for',
    ' * Unchanged, which is exactly the `_isRunning === false` test the node makes.',
    ' */',
    'export function startDelay(',
    '  ref: DelayRef,',
    '  startDelay: unknown,',
    '  duration: unknown,',
    '  onStart?: () => void,',
    '  onFinish?: () => void',
    '): boolean {',
    '  if (ref.current !== null) return false;',
    '  begin(ref, startDelay, duration, onStart, onFinish);',
    '  return true;',
    '}',
    '',
    '/** `Restart` — begins again from zero whether or not one was running. Always Done. */',
    'export function restartDelay(',
    '  ref: DelayRef,',
    '  startDelay: unknown,',
    '  duration: unknown,',
    '  onStart?: () => void,',
    '  onFinish?: () => void',
    '): void {',
    '  stopDelay(ref);',
    '  begin(ref, startDelay, duration, onStart, onFinish);',
    '}',
    '',
    '/**',
    ' * `Stop` — abandons the countdown so Finished never fires for it. Answers `true` for Done',
    ' * (there was one to stop) and `false` for Unchanged.',
    ' */',
    'export function stopDelay(ref: DelayRef): boolean {',
    '  const running = ref.current;',
    '  if (running === null) return false;',
    '  clearTimeout(running.timeout);',
    '  ref.current = null;',
    '  return true;',
    '}',
    ''
  ].join('\n');
}
