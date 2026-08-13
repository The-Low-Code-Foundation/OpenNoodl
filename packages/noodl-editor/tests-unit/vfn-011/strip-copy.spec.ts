/**
 * VFN-011 — the run strip's sentences have to *fit*, and this is the gate that says so.
 *
 * ## The failure
 *
 * `NOTES-bench.md` §"Owed a live drive" item 7 filed it as a risk — *"the note is a single
 * `text-overflow: ellipsis` line sharing a strip with a slider and now a Run button … it may well
 * be ellipsised into uselessness"* — and the drive confirmed it. At the window's real width the
 * combined `attached-idle` + bench hint rendered as:
 *
 * > *"…Press ▶ Run below to work them out here, with the app stop…"*
 *
 * The sentence that teaches the feature is the half the ellipsis eats, because the ellipsis always
 * eats the end and an instruction always keeps its verb there.
 *
 * ## The instrument, and why it is not a character count
 *
 * A character budget treats `i` and `W` as the same width; in this font they differ by 4.5×. The
 * only honest unit is pixels, and the two usual ways to get them are both unavailable or wrong
 * here — `scrollWidth > clientWidth` is integer-rounded and reports a false 1 px overflow
 * (VFN-002 §"a correction to this file's stated instrument"), and no worktree that must not launch
 * the editor has a renderer at all.
 *
 * So `scripts/devtools/text-advance.js` reads glyph advances **out of the font file the app
 * renders with** (`--font-family` → `-apple-system` → `/System/Library/Fonts/SFNS.ttf`) and sums
 * them, and this spec drives that against the strip's own geometry.
 *
 * 🔴 **The geometry is parsed from `BlockValueController.ts`, not restated here.** A model with
 * its own copy of the padding is a second truth about the layout, and it would keep passing after
 * somebody widened the Run button. The parse is also load-bearing in the other direction: if the
 * note ever stops being a clipped single line, `it('the note is still a single clipped line')`
 * fails and this whole budget is re-opened rather than quietly enforcing a rule about nothing.
 *
 * ## Negative controls
 *
 * Every assertion below is of the form "this string fits", which a measurer stuck at zero would
 * also satisfy. Three controls, all of them watched red before being inverted:
 *
 *  1. the **pre-trim copy**, through the same model at the same width — must be reported clipped;
 *  2. the pre-trim copy at the drive's own ~875 px window — must be cut *inside* `with the app
 *     stopped`, reproducing the reported render rather than merely disagreeing with it;
 *  3. the measurer's own linearity and glyph discrimination, so a parser returning a constant
 *     cannot pass as a measurement.
 */
import * as fs from 'fs';
import * as path from 'path';

import { LOGIC_OVERLAY_MIN_WIDTH } from '../../src/editor/src/views/nodegrapheditor/logicOverlayGeometry';
import {
  STATUS_COPY,
  benchHint,
  benchHintApplies
} from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';
import type { BlockStripReason } from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';

const CONTROLLER = path.join(
  __dirname,
  '../../src/editor/src/views/BlocklyEditor/BlockValueController.ts'
);

const MEASURER = path.join(__dirname, '../../../../scripts/devtools/text-advance.js');

/* eslint-disable @typescript-eslint/no-var-requires */
const { measurer, DEFAULT_FONT } = require(MEASURER) as {
  measurer: (file?: string) => (text: string, sizePx: number) => { px: number; missing: string[] };
  DEFAULT_FONT: string;
};
/* eslint-enable @typescript-eslint/no-var-requires */

const fontPresent = fs.existsSync(DEFAULT_FONT);

/**
 * 🔴 The one thing that must never be allowed to skip quietly.
 *
 * The pixel assertions below need the system font, which exists on the platform this editor is
 * developed and driven on. If it is ever missing *here*, the budget has stopped being measured and
 * the suite would go green having graded nothing — the exact shape this repo has a register entry
 * about. So say so as a failure on darwin, and only degrade elsewhere.
 */
describe('VFN-011 — the strip copy budget has an instrument', () => {
  it('the font the app renders with is readable on this platform', () => {
    if (process.platform !== 'darwin') {
      // eslint-disable-next-line no-console
      console.warn(`[VFN-011] not darwin (${process.platform}) — pixel budget not measured here`);
      return;
    }
    expect(fontPresent).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * The strip's geometry, read out of the file that writes it.
 * ------------------------------------------------------------------ */

const controllerSource = fs.readFileSync(CONTROLLER, 'utf8');

/** The concatenated string literal assigned to `<name>.style.cssText`. */
function cssTextOf(name: string): string {
  const marker = `${name}.style.cssText =`;
  const at = controllerSource.indexOf(marker);
  expect(at).toBeGreaterThan(-1);

  const end = controllerSource.indexOf(';\n', at);
  expect(end).toBeGreaterThan(at);

  return controllerSource
    .slice(at + marker.length, end)
    .split(/'\s*\+\s*\n?\s*'/)
    .join('')
    .replace(/^\s*'|'\s*$/g, '');
}

/** One declaration out of a `cssText` blob. */
function declaration(css: string, property: string): string | undefined {
  for (const part of css.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    if (part.slice(0, colon).trim() !== property) continue;
    return part.slice(colon + 1).trim();
  }
  return undefined;
}

const rootCss = cssTextOf('root');
const noteCss = cssTextOf('note');
const runCss = cssTextOf('runButton');

/** `4px 8px` → 8. */
function horizontalPadding(value: string | undefined): number {
  if (!value) return 0;
  const parts = value.split(/\s+/).map((p) => parseFloat(p));
  // 1 value → all sides; 2 or 3 → the second is left/right; 4 → the second and fourth.
  return parts.length === 1 ? parts[0] : parts[1];
}

const STRIP_FONT_PX = parseFloat(declaration(rootCss, 'font-size') || '0');
const STRIP_GAP = parseFloat(declaration(rootCss, 'gap') || '0');
const STRIP_PAD_X = horizontalPadding(declaration(rootCss, 'padding'));
const RUN_PAD_X = horizontalPadding(declaration(runCss, 'padding'));
const RUN_BORDER_X = parseFloat((declaration(runCss, 'border') || '0').split(/\s+/)[0]);

/** The label the strip shows while nothing has run — the one that shares the row with the note. */
const EMPTY_LABEL = 'No runs yet';

/**
 * The Run button is `font-weight: 600`; `hmtx` here carries the font's default (regular) instance.
 * 6% is a deliberate over-estimate of the semibold widening, which makes the note's available
 * width an under-estimate — the safe direction for a fits/does-not-fit question.
 */
const SEMIBOLD = 1.06;

const measure = fontPresent ? measurer() : null;
const px = (text: string): number => (measure ? measure(text, STRIP_FONT_PX).px : 0);

/**
 * How much room the note actually has, at a given window width.
 *
 * The slider and the Live button are `display: none` while nothing has run (`buildStrip`'s
 * `render`), so they are not flex items and contribute no gap. `label` has no `overflow: hidden`,
 * so its automatic minimum size is its content and it does not shrink; the note does have it, so
 * its automatic minimum is 0 and it takes whatever is left. That is the whole model.
 */
function noteRoom(windowWidth: number, { hasRunButton }: { hasRunButton: boolean }): number {
  let used = px(EMPTY_LABEL);
  let items = 2; // the label and the note

  if (hasRunButton) {
    used += px(RUN_LABEL) * SEMIBOLD + RUN_PAD_X * 2 + RUN_BORDER_X * 2;
    items += 1;
  }

  return windowWidth - STRIP_PAD_X * 2 - STRIP_GAP * (items - 1) - used;
}

/** What the bench's button says — `BlocklyWorkspace.tsx`'s `onRun.label`. */
const RUN_LABEL = '▶ Run';

/**
 * The budget, in pixels of note.
 *
 * Set below the room available at `LOGIC_OVERLAY_MIN_WIDTH` rather than at it. The measurer sums
 * unkerned advances from the font's default optical instance, which the header puts at ±5%, and a
 * budget set at the exact edge would be a budget that is right on this machine and nowhere else.
 */
const HEADROOM = 0.965;

function noteFor(reason: BlockStripReason, hasRunButton: boolean): string {
  const copy = STATUS_COPY[reason];
  if (!hasRunButton || !benchHintApplies(reason)) return copy;
  return copy + benchHint(RUN_LABEL);
}

/** `no-node` is the one reason whose mount is given no Run button at all (VFN-009). */
const hasRunButton = (reason: BlockStripReason): boolean => reason !== 'no-node';

const REASONS = (Object.keys(STATUS_COPY) as BlockStripReason[]).filter((r) => STATUS_COPY[r] !== '');

describe('VFN-011 — every strip sentence fits the narrowest window the geometry allows', () => {
  it('the geometry parsed out of the controller is the geometry it writes', () => {
    // If any of these come back 0 the parse missed and every budget below is measured against a
    // window the size of the whole window. That is the failure this file is most exposed to.
    expect(STRIP_FONT_PX).toBeGreaterThan(0);
    expect(STRIP_GAP).toBeGreaterThan(0);
    expect(STRIP_PAD_X).toBeGreaterThan(0);
    expect(RUN_PAD_X).toBeGreaterThan(0);
    expect(RUN_BORDER_X).toBeGreaterThan(0);
  });

  it('the note is still a single clipped line — otherwise this budget is about nothing', () => {
    expect(declaration(noteCss, 'white-space')).toBe('nowrap');
    expect(declaration(noteCss, 'overflow')).toBe('hidden');
    expect(declaration(noteCss, 'text-overflow')).toBe('ellipsis');
  });

  it('the strip still shows the label this model reserves room for', () => {
    expect(controllerSource).toContain(`'${EMPTY_LABEL}'`);
  });

  it('🔴 CONTROL: the measurer reads real advances, not a constant', () => {
    if (!measure) return;

    const narrow = measure('i', STRIP_FONT_PX).px;
    const wide = measure('W', STRIP_FONT_PX).px;
    const ten = measure('iiiiiiiiii', STRIP_FONT_PX).px;

    expect(narrow).toBeGreaterThan(0);
    expect(wide).toBeGreaterThan(narrow * 2);
    expect(ten).toBeCloseTo(narrow * 10, 6);

    // And it has coverage for the one character in this copy that a fallback font would supply —
    // a `▶` scored as zero would understate every note that carries the bench hint.
    expect(measure(RUN_LABEL, STRIP_FONT_PX).missing).toEqual([]);
  });

  it('every reason fits at the minimum window width', () => {
    if (!measure) return;

    const rows = REASONS.map((reason) => {
      const withButton = hasRunButton(reason);
      const note = noteFor(reason, withButton);
      const room = noteRoom(LOGIC_OVERLAY_MIN_WIDTH, { hasRunButton: withButton });
      return { reason, note, width: px(note), room, budget: room * HEADROOM };
    }).sort((a, b) => b.width - a.width);

    for (const row of rows) {
      // eslint-disable-next-line no-console
      console.log(
        `[VFN-011 strip @${LOGIC_OVERLAY_MIN_WIDTH}px] ${row.reason.padEnd(15)} ` +
          `${row.width.toFixed(0).padStart(4)}px of ${row.budget.toFixed(0)}px budget ` +
          `(${row.room.toFixed(0)}px room, ${row.note.length} chars)`
      );
    }

    for (const row of rows) {
      expect({ reason: row.reason, width: Math.round(row.width) }).toEqual({
        reason: row.reason,
        width: Math.round(Math.min(row.width, row.budget))
      });
    }
  });

  /**
   * 🔴 NEGATIVE CONTROL — the copy as it was, through this exact model.
   *
   * Watched red before being inverted: with the pre-trim strings substituted for the live ones,
   * `every reason fits` failed on six of the seven reasons.
   */
  it('🔴 CONTROL: the pre-trim copy does not fit, measured the same way', () => {
    if (!measure) return;

    const BEFORE: Record<string, string> = {
      waiting: 'Waiting for the app to run these blocks…',
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
    const BEFORE_HINT = ' Press ' + RUN_LABEL + ' below to work them out here, with the app stopped.';

    const clipped = Object.entries(BEFORE).filter(([reason, copy]) => {
      const withButton = reason !== 'no-node';
      const note = withButton ? copy + BEFORE_HINT : copy;
      return px(note) > noteRoom(LOGIC_OVERLAY_MIN_WIDTH, { hasRunButton: withButton });
    });

    // eslint-disable-next-line no-console
    console.log(
      `[VFN-011 control] ${clipped.length}/${Object.keys(BEFORE).length} pre-trim sentences clip at ` +
        `${LOGIC_OVERLAY_MIN_WIDTH}px: ${clipped.map(([r]) => r).join(', ')}`
    );

    // Six of the seven. `waiting` was already short enough, and saying "all seven" when one of
    // them was fine would be the control overstating itself.
    expect(clipped.map(([reason]) => reason).sort()).toEqual([
      'attached-idle',
      'no-connection',
      'no-node',
      'no-preview',
      'no-probes',
      'not-in-preview'
    ]);
  });

  /**
   * 🔴 NEGATIVE CONTROL — the model reproduces the render that was actually reported.
   *
   * The drive saw the sentence cut inside `with the app stopped`. Disagreeing with the old copy in
   * the abstract is cheap; landing the cut on the same four characters is what says this model is
   * about the strip on screen and not about a strip of its own invention.
   */
  it('🔴 CONTROL: the model puts the reported cut where the drive saw it', () => {
    if (!measure) return;

    const before =
      'Watching this node. Nothing has run since you opened this editor — trigger it in the app to see values.' +
      ' Press ' +
      RUN_LABEL +
      ' below to work them out here, with the app stopped.';

    // The window at which the ellipsis falls inside the final phrase, found rather than assumed.
    const cutAt = (windowWidth: number): string => {
      const room = noteRoom(windowWidth, { hasRunButton: true }) - px('…');
      let kept = '';
      for (const character of before) {
        if (px(kept + character) > room) break;
        kept += character;
      }
      return kept;
    };

    // ⚠️ The width is **found, not asserted**. Hardcoding the number I back-solved from the
    // report would be the model agreeing with itself; what is worth proving is that some window a
    // builder could plausibly have had produces the render that was filed.
    const reproducing: number[] = [];
    for (let windowWidth = LOGIC_OVERLAY_MIN_WIDTH; windowWidth <= 1400; windowWidth++) {
      if (cutAt(windowWidth).endsWith('with the app stop')) reproducing.push(windowWidth);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[VFN-011 control] the reported render "…with the app stop…" occurs at window widths ` +
        `${reproducing[0]}–${reproducing[reproducing.length - 1]}px; ` +
        `at 875px the model renders "…${cutAt(875).slice(-24)}…"`
    );

    expect(reproducing.length).toBeGreaterThan(0);
    // And the same string is whole once the window is wide enough, so the cut is a width fact
    // rather than the model refusing to fit anything.
    expect(cutAt(1400)).toBe(before);
    // …and it is genuinely cut at the narrow end, so the range above is a range and not the model
    // producing one answer for every input.
    expect(cutAt(LOGIC_OVERLAY_MIN_WIDTH).length).toBeLessThan(before.length * 0.75);
  });

  /**
   * 🔴 NEGATIVE CONTROL — a planted string.
   *
   * The register's warning about a scanner that found one of three real sites: an instrument is
   * only as good as its demonstrated recall. This one is handed a sentence built to overflow and
   * has to say so.
   */
  it('🔴 CONTROL: a planted over-long sentence is caught', () => {
    if (!measure) return;

    const planted = 'W'.repeat(120);
    const room = noteRoom(LOGIC_OVERLAY_MIN_WIDTH, { hasRunButton: true });

    expect(px(planted)).toBeGreaterThan(room);
    // And a plainly short one is not — an instrument that failed everything would also "catch" it.
    expect(px('Watching.')).toBeLessThan(room);
  });
});
