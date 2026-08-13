/**
 * LGC-003 — one open block editor's live values: the switch, the store, the marks and the
 * scrubber, tied together.
 *
 * Everything that *decides* anything lives in `BlockValueTrace.ts` and is graded headlessly;
 * everything that *draws* lives in `BlockValueBadges.ts` and in the strip below. This file is
 * the wiring, and it is deliberately the only place that knows all four exist.
 *
 * ## The order of the two clocks
 *
 * §5.3 asks for a repaint on an animation frame rather than per value, because both runtime
 * clocks are frame clocks and a program driven by one would otherwise strobe. That rule is
 * enforced twice, in two places that fail differently: the relay coalesces frames on its 200 ms
 * queue (`sendBlockValues`), and {@link FramePaintScheduler} coalesces paints between animation
 * frames here. The first bounds the socket, the second bounds the DOM.
 *
 * @module BlocklyEditor
 */

import type * as Blockly from 'blockly';

import { BlockValueBadgeLayer } from './BlockValueBadges';
import { BlockRunHistory, FramePaintScheduler, STATUS_COPY, markFor, stripReasonFor } from './BlockValueTrace';
import type { BlockMark, BlockRunFrame } from './BlockValueTrace';
import { attachBlockTrace } from './BlockTraceClient';
import type { BlockTraceHandle, BlockTraceStatus } from './BlockTraceClient';

/**
 * What the strip says when there is nothing to scrub.
 *
 * 🔴 **Moved to `BlockValueTrace` by VFN-011 Part 1, and re-exported here so nothing that imported
 * it has to move.** The five socket answers described everything except the commonest empty strip
 * — armed, attached, and nothing has run since the editor opened — and *that* one rendered the
 * empty string, so the label's "No runs yet" stood alone and a builder could not tell *this has
 * not run* from *this cannot run*. Both the sentences and the rule that picks between them are now
 * on the graded side of this module's own split; only the `<span>` is here.
 */
export { STATUS_COPY };

export interface BlockValueHandle {
  /**
   * The block ids the last generation emitted a probe for.
   *
   * ⚠️ **This is the denominator of the didn't-execute tell** and it has to be pushed in from
   * the generate path rather than derived here: a block that emits no code — a `Define input`,
   * a disabled block, an orphan — must render neutral rather than hollow, and only the
   * generator knows which blocks those are. See `BlockProbes.withBlockProbes`.
   */
  setProbedIds(ids: Set<string>): void;
  /** A theme flip. */
  refreshTheme(): void;
  /** The blocks changed, so every value is now about a program that no longer exists. */
  invalidate(): void;
  /**
   * VFN-011 — the `generatedCode` the node now carries.
   *
   * Pushed in from the flush rather than read from anywhere here, for `setProbedIds`' reason: the
   * generate path is the only thing that knows. Once an edit has flushed, the code on disk is by
   * definition instrumented, so the stale-code sentence retires itself.
   */
  setGeneratedCode(code: string | undefined): void;
  dispose(): void;
}

export interface BlockValueOptions {
  /** The Logic Builder node these blocks belong to. */
  nodeId?: string;
  /**
   * The node's saved `generatedCode` parameter — what the app would actually run **now**.
   *
   * ⚠️ Read, never written. VFN-011 Part 1's second bullet says so in as many words: regenerating
   * the node to fix a stale program would write to disk on open, which breaks LGC-002 §2's
   * criterion that opening a program and closing it again changes no bytes.
   */
  generatedCode?: string;
}

/**
 * Attach live values to one workspace.
 *
 * `nodeId` is optional and its absence explains itself in the strip rather than making the
 * whole feature vanish — the same decision LGC-002 made about its menu item, for the same
 * reason: a feature that is simply absent is indistinguishable from one that is broken.
 */
export function attachBlockValues(
  workspace: Blockly.WorkspaceSvg,
  container: HTMLElement,
  options: BlockValueOptions = {}
): BlockValueHandle {
  const { nodeId } = options;
  const history = new BlockRunHistory();
  /** Which iteration of a loop each badge is showing. Absent means "the last one". */
  const iterations = new Map<string, number>();
  let probedIds: ReadonlySet<string> = new Set<string>();
  let status: BlockTraceStatus = nodeId ? 'waiting' : 'no-connection';
  let generatedCode: string | undefined = options.generatedCode;

  const badges = new BlockValueBadgeLayer(workspace, (blockId) => {
    // §5.2 — click to scrub iterations, wrapping back to "the last one" so a builder can always
    // get out of a loop they clicked into without hunting for a reset.
    const run = history.current();
    const entry = run && run.values[blockId];
    if (!entry) return;

    const kept = entry.v.length;
    const at = iterations.get(blockId);
    const next = at === undefined ? 0 : at + 1;
    if (next >= kept) iterations.delete(blockId);
    else iterations.set(blockId, next);

    scheduler.request();
  });

  const strip = buildStrip(container, {
    onSelect(index) {
      history.select(index);
      iterations.clear();
      scheduler.request();
    },
    onLive() {
      history.goLive();
      iterations.clear();
      scheduler.request();
    }
  });

  const scheduler = new FramePaintScheduler(() => {
    const run = history.current();
    const marks = new Map<string, BlockMark>();

    const blocks = workspace.getAllBlocks(false);
    for (const block of blocks) {
      const at = iterations.has(block.id) ? (iterations.get(block.id) as number) : -1;
      marks.set(block.id, markFor(block.id, run, probedIds, at));
    }

    badges.paint(marks);
    strip.render({
      runs: history.length,
      index: history.index,
      isLive: history.isLive,
      // 🔴 The reason, not the status. See `stripReasonFor` — the difference between the two is
      // the whole of VFN-011 Part 1.
      note: STATUS_COPY[
        stripReasonFor({ status, runs: history.length, hasBlocks: blocks.length > 0, generatedCode })
      ]
    });
  });

  let trace: BlockTraceHandle | null = null;

  if (nodeId) {
    trace = attachBlockTrace(nodeId, {
      onFrame(frame: BlockRunFrame) {
        history.push(frame);
        // Iteration selections belong to a run, not to a block: carrying one into the next run
        // would pin a badge to "iteration 4" of a loop that may not have four this time.
        if (history.isLive) iterations.clear();
        scheduler.request();
      },
      onStatus(next) {
        status = next;
        scheduler.request();
      }
    });
  } else {
    status = 'no-connection';
    // Draw once so the strip explains itself rather than showing an empty bar.
    scheduler.request();
  }

  return {
    setProbedIds(ids) {
      probedIds = ids;
      scheduler.request();
    },
    setGeneratedCode(code) {
      generatedCode = code;
      scheduler.request();
    },
    refreshTheme() {
      badges.refreshTheme();
      strip.refreshTheme();
      scheduler.request();
    },
    invalidate() {
      // The program changed. Old runs describe blocks that may no longer exist and values that
      // may no longer be reachable, and a badge from a program that is gone is a lie with no
      // timestamp on it. Same rule as the Do It balloons, one level up.
      history.clear();
      iterations.clear();
      badges.clear();
      scheduler.request();
    },
    dispose() {
      scheduler.dispose();
      if (trace) trace.dispose();
      badges.dispose();
      strip.dispose();
    }
  };
}

interface StripState {
  runs: number;
  index: number;
  isLive: boolean;
  note: string;
}

interface Strip {
  render(state: StripState): void;
  refreshTheme(): void;
  dispose(): void;
}

/**
 * §3 — the scrubber, along the bottom of the workspace.
 *
 * A range input rather than a bespoke track: it is keyboard-operable, it is draggable, it
 * reports on `input` rather than on release, and none of that has to be written or tested here.
 *
 * ⚠️ **The Live button is not decoration.** {@link BlockRunHistory} deliberately does not yank a
 * scrubbed-back user forward when a new run arrives, so without a visible way back — and a
 * visible statement of which state you are in — a builder who scrubbed once would conclude the
 * badges had stopped working.
 */
function buildStrip(container: HTMLElement, handlers: { onSelect(index: number): void; onLive(): void }): Strip {
  const root = document.createElement('div');
  root.className = 'noodlBlockRunScrubber';
  root.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:11px;' +
    'border-top:1px solid var(--theme-color-border-strong, #37404c);' +
    'background:var(--theme-color-bg-2, #1a2029);color:var(--theme-color-fg-muted, #8a97a6);';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '0';
  slider.step = '1';
  slider.style.cssText = 'flex:1;min-width:80px;';
  slider.addEventListener('input', () => handlers.onSelect(Number(slider.value)));

  const label = document.createElement('span');
  label.style.cssText = 'white-space:nowrap;font-variant-numeric:tabular-nums;';

  const live = document.createElement('button');
  live.type = 'button';
  live.textContent = 'Live';
  live.style.cssText =
    'border:1px solid var(--theme-color-border-strong, #37404c);border-radius:3px;' +
    'background:transparent;color:inherit;padding:1px 6px;cursor:pointer;';
  live.addEventListener('click', () => handlers.onLive());

  const note = document.createElement('span');
  note.style.cssText = 'flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

  root.appendChild(label);
  root.appendChild(slider);
  root.appendChild(live);
  root.appendChild(note);
  container.appendChild(root);

  return {
    render(state) {
      note.textContent = state.note;

      // Nothing has run: the slider would be a control with one position, which reads as
      // broken. Hidden, and the note says why there is nothing to scrub.
      const scrubbable = state.runs > 1;
      slider.style.display = scrubbable ? '' : 'none';
      live.style.display = scrubbable ? '' : 'none';

      slider.max = String(Math.max(0, state.runs - 1));
      slider.value = String(Math.max(0, state.index));

      label.textContent =
        state.runs === 0
          ? 'No runs yet'
          : state.isLive
            ? 'Run ' + state.runs + ' of ' + state.runs + ' · live'
            : 'Run ' + (state.index + 1) + ' of ' + state.runs;

      live.disabled = state.isLive;
      live.style.opacity = state.isLive ? '0.5' : '1';
    },
    refreshTheme() {
      // Every colour above is a CSS custom property read at paint time by the browser, so a
      // theme flip re-resolves them with nothing to do here. Kept as a named no-op rather than
      // omitted, because the next person to add a resolved colour needs somewhere to put it.
    },
    dispose() {
      root.parentNode && root.parentNode.removeChild(root);
    }
  };
}
