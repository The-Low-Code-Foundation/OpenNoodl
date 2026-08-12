/**
 * LGC-003 §2, §3 and §5 — what the badges say, which blocks are hollow, and which run you are
 * looking at. No DOM, no Blockly, no socket: everything here is a decision, and every decision
 * this feature makes is graded in `tests-unit/lgc-003/`.
 *
 * ## The research constraint this file exists to obey
 *
 * NuzzleBug validated an omniscient debugger for Scratch *and* found that "systematic
 * debugging requires dedicated training", and that learners struggled to comprehend a fault
 * even when the tool answered it correctly (register L8). **Values alone do not close the
 * loop, and a wall of numbers is the named failure mode.** So the rules here are biased
 * towards fewer, better-placed marks:
 *
 *  - a block that emitted no code is **neutral**, never hollow and never badged — it is not
 *    part of the program, and marking it would be a mark that means nothing;
 *  - before the first run everything is **neutral** — hollow must mean "this run did not reach
 *    it", not "we have no data";
 *  - a block that ran many times gets **one** badge with a count, not a flicker.
 *
 * @module BlocklyEditor
 */

/** One block's contribution to one run, as it arrives from the viewer. */
export interface BlockValueEntry {
  /** How many times this block was evaluated during the run. `1` for the ordinary case. */
  n: number;
  /**
   * The value at each recorded iteration, already in `previewValue`'s display dialect.
   *
   * ⚠️ **Formatted in the viewer and sent as a string** — the same decision LGC-002 made and
   * for the same reason: the values a block computes include Collections, Models, DOM nodes
   * and circular objects, none of which survive `JSON.stringify` on a socket.
   *
   * Bounded (see `ITERATION_CAP` in the runtime recorder). When `n` exceeds what was kept, the
   * last entry is still the last iteration — the middle is what goes missing, which is the
   * half a builder asks about least.
   */
  v: string[];
}

/** One run of one Logic Builder node's block program. */
export interface BlockRunFrame {
  nodeId: string;
  /** Monotonic per viewer. Only its ordering is used. */
  runId: number;
  /** Wall clock, for the scrubber's tooltip. */
  t: number;
  /** Value blocks that produced a value. */
  values: Record<string, BlockValueEntry>;
  /** Statement blocks that executed, and how many times. */
  statements: Record<string, number>;
  /** Set when the run recorded more distinct blocks than it was willing to carry. */
  truncated?: boolean;
}

/** How many runs the scrubber keeps. §3's "~50". */
export const RUN_HISTORY_LIMIT = 50;

/**
 * What a block should look like right now.
 *
 * `neutral` is a first-class answer and the most common one. See the module note: marking a
 * block that is not part of the program is worse than not marking it.
 */
export type BlockMarkState = 'executed' | 'hollow' | 'neutral';

export interface BlockMark {
  state: BlockMarkState;
  /** The badge text, or `undefined` when there is nothing worth painting. */
  badge?: string;
  /** How many iterations are scrubbable for this block. `1` when it ran once. */
  iterations: number;
}

/**
 * Which mark one block gets, for one run.
 *
 * The whole of §2's dynamic half is the `probedIds` test, and it is the reason the generation
 * side collects that set instead of the code being scanned for it:
 *
 *  - **not in `probedIds`** — the block emitted no code. A `Define input`, a disabled block, an
 *    orphan. Neutral. The static half (`Blockly.Events.disableOrphans`) already greys the
 *    orphan, and painting it hollow as well would say the same thing twice in two dialects.
 *  - **in `probedIds`, in the run** — it executed. Badge it if it produced a value.
 *  - **in `probedIds`, not in the run** — *it did not run this time.* This is the tell §2 says
 *    is worth more than every value badge combined, and it is one set difference.
 */
export function markFor(
  blockId: string,
  run: BlockRunFrame | undefined,
  probedIds: ReadonlySet<string>,
  iteration = -1
): BlockMark {
  // No run yet: hollow would be a claim about a run that has not happened.
  if (!run) return { state: 'neutral', iterations: 0 };
  if (!probedIds.has(blockId)) return { state: 'neutral', iterations: 0 };

  const entry = run.values[blockId];
  if (entry) {
    return { state: 'executed', badge: badgeText(entry, iteration), iterations: entry.n };
  }

  const statementRuns = run.statements[blockId];
  if (statementRuns !== undefined) {
    // A statement has no value to show. Its count is worth showing only when it is not 1 —
    // "×1" on every statement in the program is the wall of numbers, spelled differently.
    return {
      state: 'executed',
      badge: statementRuns > 1 ? '×' + statementRuns : undefined,
      iterations: statementRuns
    };
  }

  return { state: 'hollow', iterations: 0 };
}

/**
 * §5.2 — **loops need a count, not a flicker.**
 *
 * A block inside a loop has N values and one place to show them. Showing them in turn is the
 * strobe; showing the first is a lie; showing the last plus `×N` is the one that reads. An
 * explicit `iteration` overrides it, which is what the click-to-scrub gesture sets.
 */
export function badgeText(entry: BlockValueEntry, iteration = -1): string {
  if (!entry || entry.n === 0) return '';

  const kept = entry.v.length;
  if (kept === 0) return entry.n > 1 ? '×' + entry.n : '';

  if (iteration >= 0 && iteration < kept) {
    // Scrubbed: say which iteration is on screen, or the count is a lie about the value beside
    // it. 1-based, because the first iteration of a loop is the first one, not the zeroth.
    return entry.v[iteration] + '  ' + (iteration + 1) + '/' + entry.n;
  }

  const last = entry.v[kept - 1];
  return entry.n > 1 ? last + '  ×' + entry.n : last;
}

/**
 * The runs, the selection, and nothing else.
 *
 * ⚠️ **A new run does not yank a scrubbed-back user forward.** "It worked three clicks ago" is
 * the question §3 exists to answer, and a store that jumped to the newest frame would make the
 * answer unreadable the moment the program ran again — which, on a frame clock, is immediately.
 * {@link goLive} is how you come back, and {@link isLive} is what the strip has to show so the
 * state is never ambiguous.
 */
export class BlockRunHistory {
  private runs: BlockRunFrame[] = [];
  private selected = -1;
  /** True while the selection should follow the newest frame. */
  private live = true;

  constructor(private readonly limit: number = RUN_HISTORY_LIMIT) {}

  push(frame: BlockRunFrame): void {
    this.runs.push(frame);
    if (this.runs.length > this.limit) {
      const dropped = this.runs.length - this.limit;
      this.runs.splice(0, dropped);
      // A pinned selection is an index into this array, so dropping from the front moves it.
      if (!this.live) this.selected = Math.max(0, this.selected - dropped);
    }
    if (this.live) this.selected = this.runs.length - 1;
  }

  get length(): number {
    return this.runs.length;
  }

  get index(): number {
    return this.selected;
  }

  get isLive(): boolean {
    return this.live;
  }

  current(): BlockRunFrame | undefined {
    return this.selected >= 0 ? this.runs[this.selected] : undefined;
  }

  at(index: number): BlockRunFrame | undefined {
    return this.runs[index];
  }

  all(): readonly BlockRunFrame[] {
    return this.runs;
  }

  /** Scrub to a run. Out-of-range clamps rather than throwing: this is driven by a drag. */
  select(index: number): void {
    if (this.runs.length === 0) return;
    this.selected = Math.min(this.runs.length - 1, Math.max(0, Math.floor(index)));
    this.live = this.selected === this.runs.length - 1;
  }

  /** Follow the newest run again. */
  goLive(): void {
    this.live = true;
    this.selected = this.runs.length - 1;
  }

  clear(): void {
    this.runs = [];
    this.selected = -1;
    this.live = true;
  }
}

/**
 * §5.3 — **repaint on an animation frame, not per value.**
 *
 * Both runtime clocks are frame clocks, so a Logic Builder driven by one produces a run per
 * frame and a naive repaint strobes. This coalesces every request between frames into one
 * call, and the frame source is injected so the rule is graded rather than assumed.
 *
 * ⚠️ It coalesces *forward*, never backward: the callback always sees the state as of the
 * frame it runs on, so dropping intermediate requests drops nothing a user could have read.
 */
export class FramePaintScheduler {
  private pending = false;
  private disposed = false;

  constructor(
    private readonly paint: () => void,
    private readonly schedule: (cb: () => void) => unknown = (cb) =>
      typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(cb, 16)
  ) {}

  request(): void {
    if (this.pending || this.disposed) return;
    this.pending = true;
    this.schedule(() => {
      this.pending = false;
      if (!this.disposed) this.paint();
    });
  }

  dispose(): void {
    this.disposed = true;
  }
}
