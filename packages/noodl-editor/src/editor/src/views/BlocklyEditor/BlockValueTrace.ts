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

import type { BlockTraceStatus } from './BlockTraceClient';

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
  /**
   * VFN-011 — set only by the editor's own bench.
   *
   * ⚠️ **Additive and optional, and the runtime never writes it.** A viewer frame is the same
   * object it always was, so nothing on the receiving path has to change to keep accepting one;
   * a bench frame is the same shape *plus* this flag, which is how acceptance criterion 7 —
   * "a sandbox run is distinguishable in the scrubber" — is met without a second history, a
   * second frame type or a parallel render path.
   */
  sandbox?: true;
}

/**
 * VFN-011 Part 1 — every reason the strip can give for having nothing to scrub.
 *
 * 🔴 **The five socket answers are not the whole list, and that gap was the defect.** The report
 * that opened this task —
 *
 * > *"When I run the logic node, open the editor, it still says 'No runs yet' … so I can't
 * > inspect the live values that passed through it."*
 *
 * — describes the *commonest* empty strip, and it was the one state with nothing to say: tracing
 * arms when the editor opens, so a run that happened **before** the editor opened records nothing,
 * and `STATUS_COPY.attached` was the empty string. Correct behaviour, wrong impression, and the
 * whole distance between them is a sentence.
 *
 * So the reason a strip shows is **not** the trace status. It is derived from the status *and*
 * from what the editor knows about the program, which is what {@link stripReasonFor} is.
 */
export type BlockStripReason =
  /** The five the socket can report. Defined once, in `BlockTraceClient`. */
  | BlockTraceStatus
  /**
   * Attached, armed, and nothing has run since this editor opened.
   *
   * The report's own sequence produces exactly this, and it is the reason the report was filed.
   */
  | 'attached-idle'
  /**
   * The node's `generatedCode` predates value tracing, so it emits no probes and **no run of it
   * can ever badge anything** — from the app or from the bench.
   *
   * ⚠️ It regenerates on the node's own next edit and on nothing else (measured in LGC-007 §6),
   * which is why the copy asks for an edit rather than promising it will fix itself.
   */
  | 'no-probes'
  /**
   * VFN-009 — these blocks are a **saved block's own body**. There is no node behind them.
   *
   * 🔴 The reason this is its own answer rather than falling through to `no-connection`: without
   * a `nodeId` the controller sets the status to `no-connection`, whose sentence is *"The editor
   * has no connection to a running app."* That is a true sentence about a different problem, and
   * a builder reading it on a definition tab would go and start the preview. Nothing they can do
   * to the app will ever put values on these blocks — the subject has no inputs and no run.
   */
  | 'no-node';

/**
 * What the strip says when there is nothing to scrub. One sentence per reason.
 *
 * ⚠️ **Here rather than beside the strip that draws it**, and that is this module's own rule: the
 * words are a decision, the `<span>` is not. `BlockValueController` re-exports this so nothing that
 * already imported it has to move, and it is graded in `tests-unit/vfn-011/` beside the function
 * that chooses between them — which is the only way the choice and the copy can be checked against
 * each other at all.
 */
export const STATUS_COPY: Record<BlockStripReason, string> = {
  waiting: 'Waiting for the app to run these blocks…',
  attached: '',
  'no-preview': 'Run the preview to see what these blocks work out.',
  'not-in-preview': 'The preview is running, but this Visual Function is not on screen in it right now.',
  'no-connection': 'The editor has no connection to a running app.',
  'attached-idle':
    'Watching this node. Nothing has run since you opened this editor — trigger it in the app to see values.',
  'no-probes': 'These blocks were generated before value tracing; make any edit to bring them up to date.',
  'no-node':
    'These are a saved block’s own blocks. There is no node behind them, so there is nothing to run ' +
    'and no live values to show — place the block in a Visual Function to watch it work.'
};

/**
 * VFN-011 Part 2 — the sentence the bench adds to an empty strip.
 *
 * ⚠️ **Appended rather than written into `STATUS_COPY`**, because whether it is true depends on
 * whether a Run button exists, and that is decided per mount. A block editor attached with no bench
 * must not be told to press a button it does not have — the failure LGC-002 names about its menu
 * item, arriving as copy instead of as a control.
 */
export function benchHint(runLabel: string): string {
  return ' Press ' + runLabel + ' below to work them out here, with the app stopped.';
}

/**
 * Would pressing Run answer this reason?
 *
 * Every reason except two. `attached` is the one whose copy is the empty string — there is already
 * something to scrub, so there is nothing to offer. `no-node` (VFN-009) is the one where Run is not
 * a thing that exists: a definition tab has no node, so the bench has no inputs to run against and
 * the strip is not given a Run button at all. Saying so here as well means a build that *did* hand
 * it one would not also get a sentence telling the builder to press it.
 *
 * ⚠️ **VFN-011's bench is what would make a definition tab genuinely runnable**, and this line is
 * the single place that has to change when it is.
 *
 * 🔴 **Including `no-probes`, and that is not an oversight.** The stale-code reason is about what
 * the *app* would run: the node's saved `generatedCode` emits no probes, so no run of it in a
 * preview can badge anything. The bench does not run that string — it regenerates from the blocks
 * on screen through the flush's own generator, which is instrumented always — so pressing Run is
 * exactly the thing that works while the node on disk is stale.
 */
export function benchHintApplies(reason: BlockStripReason): boolean {
  return reason !== 'attached' && reason !== 'no-node';
}

/**
 * Does this generated program carry the probe calls the badges are made of?
 *
 * ⚠️ **The runtime deliberately does not ask this question, and its comment says why**: making the
 * `new Function` parameter list conditional on the code would put an `indexOf` on the compile path
 * and give the runtime two shapes of compiled function to reason about (`logic-builder.ts`, the
 * ninth-and-tenth-parameter note). The *editor* has no such constraint — it asks once, to explain
 * an empty strip — so the check lives here.
 *
 * 🔴 **A call, not a substring.** `code.includes('__p')` is true of a program containing the string
 * `"__pizza"` in a text block, and a bench that told such an author their blocks were fine would be
 * wrong in the direction that costs most. The pattern requires the name to start a token and to be
 * followed by an open parenthesis, which is the only shape `BlockProbes` emits.
 */
const PROBE_CALL = /(^|[^\w$])__[ps]\s*\(/;

export function programHasProbes(generatedCode: string | undefined | null): boolean {
  if (typeof generatedCode !== 'string' || generatedCode === '') return false;
  return PROBE_CALL.test(generatedCode);
}

/** What {@link stripReasonFor} needs to know. Every field is a fact somebody already holds. */
export interface StripReasonInput {
  /** The last thing the trace client said about the socket. */
  status: BlockTraceStatus;
  /** How many runs the history holds, from **any** source — viewer or bench. */
  runs: number;
  /** Whether the workspace has any blocks at all. */
  hasBlocks: boolean;
  /**
   * The `generatedCode` the node carries **on disk** — what the app would actually run.
   *
   * `undefined` means the editor was not told, not "there is none": a strip that has not been
   * handed the parameter must not accuse the program of being stale.
   */
  generatedCode?: string;
  /**
   * VFN-009 — what these blocks *are*.
   *
   * 🔴 Explicit, and not inferred from a missing `nodeId`. A node tab opened without a node id is
   * a **wiring mistake**, and LGC-002's whole design is that such a mistake explains itself rather
   * than disappearing; a definition tab has no node by construction. Reading one state as the
   * other would relabel every wiring mistake as a saved block and take the loud failure away.
   *
   * Omitted means `'node'`, so every existing caller keeps the answer it had.
   */
  subject?: 'node' | 'definition';
}

/**
 * Which sentence the strip owes the builder.
 *
 * The precedence is the whole of the decision, and it is ordered by *what the builder would do
 * next*:
 *
 *  0. **`no-node` before everything** (VFN-009), because it is not a state the program is in — it
 *     is a statement about what these blocks *are*. A saved block's body has no node, no inputs
 *     and no run, so every reason below it is a sentence about a question that does not apply.
 *  1. **`no-probes` first** of the rest, because it is true regardless of the socket and it is the only reason
 *     where nothing the builder does — starting the app, triggering the node, pressing Run — will
 *     produce a badge. Every other reason is answerable by an action.
 *  2. **Runs beat every reason.** Once there is something to scrub the strip has nothing to
 *     explain, and `attached` is the reason whose copy is the empty string.
 *  3. **Attached and empty is `attached-idle`**, which is the state the report describes and the
 *     one the five socket answers could not name.
 *  4. Otherwise the socket's own answer, unchanged.
 */
export function stripReasonFor({ status, runs, hasBlocks, generatedCode, subject }: StripReasonInput): BlockStripReason {
  // VFN-009 — a saved block's body. Not a state; a subject. Nothing below applies to it, including
  // `no-probes`: the definition is never generated on its own, so "these blocks are stale" is not
  // a claim that has a meaning here.
  if (subject === 'definition') return 'no-node';

  // `generatedCode === ''` is a program that has never been generated — a freshly dropped node —
  // not one generated by an older editor. Accusing it of being stale would be a sentence about a
  // program that does not exist yet.
  if (hasBlocks && typeof generatedCode === 'string' && generatedCode !== '' && !programHasProbes(generatedCode)) {
    return 'no-probes';
  }

  if (runs > 0) return 'attached';
  if (status === 'attached') return 'attached-idle';
  return status;
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
