/**
 * LGC-003 §2 and §5.1 — what a run looks like on the blocks.
 *
 * Two marks, both imperative SVG appended into the block's own `<g>`, exactly as
 * `DoItBalloons` does and for exactly the same reason:
 *
 * 🔴 **Nothing here may touch the workspace model.** `BlocklyWorkspace` serialises every
 * settled edit through a 300 ms debounce into the node's `workspace` parameter, so a badge
 * implemented as a Blockly comment, field, icon or `setEnabled` call would be **saved into the
 * user's program**. These are `document.createElementNS` nodes that produce no Blockly events.
 *
 * ⚠️ The hollow mark is drawn, not `block.setEnabled(false)`. Disabling is model state, it
 * serialises, and it would collide head-on with §2's *static* half — which is core Blockly's
 * `Blockly.Events.disableOrphans` and legitimately does write disabled state. One of these two
 * is allowed to change the program and it is not this one.
 *
 * ## §5.1 — paint on the output plug
 *
 * "A value in a side panel is a log; a value on the plug is an explanation." Blockly's output
 * connection sits on the block's **left** edge at its top, so a badge anchored there reads
 * left-to-right along the data path into whatever consumes it. Statement blocks have no output
 * plug, so their count sits at the top-left of the block instead — the same place the wire
 * would have left from if they had one.
 *
 * 🔴 **VFN-013 — that anchor holds for a top-level block and for nothing else.** A nested
 * block's left edge is inside the body of the block it is plugged into, so "just outside my
 * left edge" is "on top of my parent", and nested is the common case. The arithmetic that
 * decides where a badge actually goes now lives in {@link module:BlocklyEditor/badgeLayout} —
 * pure, and graded headlessly against a negative control — and this file does the drawing.
 *
 * @module BlocklyEditor
 */

import type * as Blockly from 'blockly';

import { ColorSpec, resolveThemeTokens } from '../nodegrapheditor/canvas/CanvasTheme';
import { layoutBadges } from './badgeLayout';
import type { BadgePlacement, BlockBox } from './badgeLayout';
import type { BlockMark } from './BlockValueTrace';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The badge palette.
 *
 * 🔴 **`surface` and `text` carry no `css` token, and that is a measurement rather than an
 * oversight.** VFN-013 criterion 3 asks for ≥ 3:1 against *whatever sits behind the badge*, and
 * what sits behind a badge is a Blockly block. Block bodies are on Blockly's hue scale — HSV
 * saturation 0.45, value 0.65, deliberately *theme-independent* because "green means loops" is
 * semantic (see `BlocklyTheme`'s module note) — which puts every block in the editor between
 * relative luminance 0.15 and 0.36. Nothing above L ≈ 0.017 clears 3:1 against all of them, so
 * **there is no light-theme badge fill that passes**: `--theme-color-bg-2`, which this used,
 * measures **2.58:1** against the My Blocks hue in the light theme.
 *
 * So the badge is dark in both themes. That is the register's SIG-005 ruling — *dark is binding
 * for anything painted on a wire* — arrived at again from the other end, and
 * `tests-unit/vfn-013/badge-contrast.spec.ts` sweeps the whole hue circle so a future palette
 * cannot quietly break it.
 *
 * ⚠️ `wash` stays token-driven: it is the hollow mark, which dims a block rather than sitting on
 * it, and a wash that follows the theme is what makes "switched off" read in both.
 */
const BADGE_TOKENS: Record<string, ColorSpec> = {
  /** Badge fill. No token, by measurement — see above. `--base-color-neutral-50` in the dark palette. */
  surface: { fallback: '#0b0e12' },
  /** Badge ink. No token, for its surface's reason: it has to read on a fixed dark fill. */
  text: { fallback: '#eef2f6' },
  /** The hollow mark's wash over an inert block. Follows the theme. */
  wash: { css: '--theme-color-bg-2', fallback: '#1a2029' },
  border: { css: '--theme-color-border-strong', fallback: '#37404c' },
  muted: { css: '--theme-color-fg-muted', fallback: '#8a97a6' },
  accent: { css: '--theme-color-primary', fallback: '#4da3ff' }
};

/**
 * Exported for the contrast spec, which measures the real values rather than a copy of them.
 * A second table in a test file is a second truth about the palette.
 */
export { BADGE_TOKENS };

/** Roughly one character's advance at 11px in the monospace stack. Box width only. */
const CHAR_WIDTH = 6.6;
const BADGE_HEIGHT = 16;
const BADGE_PADDING = 5;

/**
 * How wide the box for one badge's text is.
 *
 * Extracted because VFN-013's layout needs the width *before* anything is drawn — a badge's
 * position depends on where every other badge landed, so the whole set has to be measured and
 * then placed, not measured and placed one at a time.
 */
export function badgeBoxWidth(text: string): number {
  return text.length * CHAR_WIDTH + BADGE_PADDING * 2;
}

/**
 * How much of a badge is painted before it is cut.
 *
 * ⚠️ Short on purpose. `previewValue` caps at 200 characters, which is right for a balloon a
 * builder asked for and far too much for a mark that appears on every block at once — the wall
 * of numbers is this task's named failure mode (register L8). A badge is a glance; the balloon
 * is the read, and Do It is still there for it.
 */
export const BADGE_MAX_CHARS = 18;

export function truncateBadge(text: string, max: number = BADGE_MAX_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(1, max - 1)) + '…';
}

interface PaintedMark {
  group: SVGGElement;
  /** So a repaint that changes nothing does nothing — the common case on a frame clock. */
  key: string;
}

/**
 * Every mark on one workspace. One layer per `BlocklyWorkspace`, disposed with it.
 */
export class BlockValueBadgeLayer {
  private marks = new Map<string, PaintedMark>();
  private colors = resolveThemeTokens(BADGE_TOKENS);

  /**
   * @param onScrubIteration §5.2's *"click to scrub iterations"*. Given only to badges whose
   *   block ran more than once — a click target on a mark that has nothing to scrub is a
   *   promise the badge cannot keep.
   */
  constructor(
    private readonly workspace: Blockly.WorkspaceSvg,
    private readonly onScrubIteration?: (blockId: string) => void
  ) {}

  /**
   * Paint one run.
   *
   * ⚠️ **A block id with no block is skipped, silently and by design.** LGC-007's My Blocks
   * expands a saved definition's body *inline* at every call site before generating, and the
   * expansion carries the definition's own block ids — so a definition used twice produces two
   * probes with the same id, for blocks that exist in no workspace the user can see. Painting
   * "whatever `getBlockById` returns" is what keeps that from becoming a badge on the wrong
   * block: the ids that survive are the ones the builder is looking at.
   */
  paint(marks: Map<string, BlockMark>): void {
    const wanted = new Set<string>();
    const hollow: { blockId: string; block: Blockly.BlockSvg }[] = [];
    const badged: { blockId: string; block: Blockly.BlockSvg; text: string; iterations: number }[] = [];

    /**
     * Pass 1 — what wants painting, and how wide it is. Nothing is placed yet.
     *
     * 🔴 VFN-013 split this loop in two. A badge's position is a function of every *other*
     * badge's position — that is what stops the three marks on `[a] × [b]` landing on each
     * other — so a paint that decided one mark at a time could not see the collision it was
     * about to cause. Measure the whole set, lay it out, then draw.
     */
    marks.forEach((mark, blockId) => {
      if (mark.state === 'neutral') return;

      const block = this.workspace.getBlockById(blockId) as Blockly.BlockSvg | null;
      if (!block) return;
      const root = block.getSvgRoot();
      if (!root) return;

      if (mark.state === 'hollow') {
        wanted.add(blockId);
        hollow.push({ blockId, block });
        return;
      }

      const text = truncateBadge(mark.badge || '');
      // A statement that ran exactly once has no badge text and nothing to draw. Deliberately
      // left out of `wanted`, so a badge it *used* to have is swept by the loop at the end.
      if (text === '') return;

      wanted.add(blockId);
      badged.push({ blockId, block, text, iterations: mark.iterations });
    });

    const placements = this.placeBadges(badged);

    for (const { blockId, block } of hollow) {
      this.replaceMark(blockId, block, 'hollow|', () => this.buildHollow(block));
    }

    for (const entry of badged) {
      const placement = placements.get(entry.blockId);
      if (!placement) continue;
      /**
       * ⚠️ The **position** is part of the key, not just the text.
       *
       * A badge whose value is unchanged can still have to move, because a *neighbour's* value
       * changed width and pushed it. Keying on `state|badge` alone — which is what this was —
       * would have short-circuited exactly those repaints and left badges stacked on top of one
       * another with no way to notice.
       */
      const key = 'executed|' + entry.text + '|' + placement.dx + ',' + placement.dy;
      this.replaceMark(entry.blockId, entry.block, key, () =>
        this.buildBadge(entry.blockId, entry.text, entry.iterations, placement)
      );
    }

    for (const blockId of Array.from(this.marks.keys())) {
      if (!wanted.has(blockId)) this.removeMark(blockId);
    }
  }

  /** Build-if-changed, for one mark. The `key` short-circuit is the frame clock's whole point. */
  private replaceMark(blockId: string, block: Blockly.BlockSvg, key: string, build: () => SVGGElement | null): void {
    const existing = this.marks.get(blockId);
    if (existing && existing.key === key) return;
    if (existing) this.removeMark(blockId);

    const root = block.getSvgRoot();
    if (!root) return;

    const group = build();
    if (!group) return;

    root.appendChild(group);
    this.marks.set(blockId, { group, key });
  }

  /**
   * VFN-013 — ask {@link layoutBadges} where this run's badges go.
   *
   * Every block in the workspace is fed in, not only the badged ones: a badge has to clear the
   * blocks it does *not* belong to, which is the whole complaint. The measurement is
   * `getBoundingRectangleWithoutChildren()` — the block's own painted box, excluding whatever is
   * plugged into it — because that is the surface a badge must not cover. `getHeightWidth()`
   * would have been the obvious call and is the wrong one: it measures a statement block *plus
   * the entire stack below it*, so every badge would have been pushed clear of a whole program.
   */
  private placeBadges(
    entries: { blockId: string; text: string }[]
  ): Map<string, BadgePlacement> {
    if (entries.length === 0) return new Map();

    const boxes: BlockBox[] = [];
    for (const block of this.workspace.getAllBlocks(false) as Blockly.BlockSvg[]) {
      const box = blockBox(block);
      if (box) boxes.push(box);
    }

    return layoutBadges(
      boxes,
      entries.map((entry) => ({
        blockId: entry.blockId,
        width: badgeBoxWidth(entry.text),
        height: BADGE_HEIGHT
      }))
    );
  }

  /** Re-resolve the palette after a light/dark flip. Repaints on the next frame. */
  refreshTheme(): void {
    this.colors = resolveThemeTokens(BADGE_TOKENS);
    // Every key is invalidated so the next `paint` rebuilds with the new palette. Cheaper than
    // walking the DOM and safe because paint is frame-coalesced.
    for (const mark of this.marks.values()) mark.key = '';
  }

  clear(): void {
    for (const blockId of Array.from(this.marks.keys())) this.removeMark(blockId);
  }

  get count(): number {
    return this.marks.size;
  }

  dispose(): void {
    this.clear();
  }

  private removeMark(blockId: string): void {
    const mark = this.marks.get(blockId);
    if (!mark) return;
    mark.group.parentNode && mark.group.parentNode.removeChild(mark.group);
    this.marks.delete(blockId);
  }

  /**
   * The didn't-execute tell: a wash over the block plus a dashed outline.
   *
   * ⚠️ It has to read as *switched off* without reading as *broken*. So: no red, no icon, no
   * text. §2's claim is that this is worth more than every value badge combined precisely
   * because there is nothing to interpret — the block just looks inert.
   */
  private buildHollow(block: Blockly.BlockSvg): SVGGElement | null {
    const size = block.getHeightWidth();
    const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    group.setAttribute('class', 'noodlBlockHollow');
    group.setAttribute('pointer-events', 'none');

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('rx', '4');
    rect.setAttribute('x', '-1');
    rect.setAttribute('y', '-1');
    rect.setAttribute('width', String(Math.max(2, size.width + 2)));
    rect.setAttribute('height', String(Math.max(2, size.height + 2)));
    rect.setAttribute('fill', this.colors.wash);
    rect.setAttribute('fill-opacity', '0.62');
    rect.setAttribute('stroke', this.colors.muted);
    rect.setAttribute('stroke-dasharray', '3 3');
    rect.setAttribute('stroke-width', '1');
    group.appendChild(rect);

    return group;
  }

  /** §5.1 — the badge, where VFN-013's layout put it. */
  private buildBadge(
    blockId: string,
    text: string,
    iterations: number,
    placement: BadgePlacement
  ): SVGGElement | null {
    if (text === '') return null;

    const scrubbable = iterations > 1 && !!this.onScrubIteration;

    const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    group.setAttribute('class', 'noodlBlockValueBadge');
    // A badge is furniture unless there are iterations behind it. When there are, it becomes
    // the §5.2 gesture — and `pointerdown`, not `click`, because Blockly starts its drag
    // gesture on pointerdown and a click handler would fire after the block had already moved.
    group.setAttribute('pointer-events', scrubbable ? 'all' : 'none');
    if (scrubbable) {
      group.style.cursor = 'pointer';
      group.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        this.onScrubIteration!(blockId);
      });
    }

    const width = badgeBoxWidth(text);
    /**
     * The badge's own group is in the block's coordinate system, so the layout's workspace
     * answer arrives here as an offset from the block's origin.
     *
     * For a **top-level** block that offset is `(-(width + 6), 0)` — LGC-003 §5.1's anchor,
     * unchanged, because the layout offers it first and the canvas beside a top-level block is
     * empty. For a **nested** block it is above the block's own left edge, and `dx` is never
     * negative there: a nested badge can no longer be pushed off-canvas to the left, and it can
     * no longer land on the block it is plugged into.
     */
    const x = placement.dx;
    const y = placement.dy;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('rx', '3');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(BADGE_HEIGHT));
    rect.setAttribute('fill', this.colors.surface);
    rect.setAttribute('stroke', this.colors.accent);
    rect.setAttribute('stroke-width', '1');
    group.appendChild(rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(x + BADGE_PADDING));
    label.setAttribute('y', String(y + 12));
    label.setAttribute('font-size', '11');
    label.setAttribute('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');
    label.setAttribute('fill', this.colors.text);
    label.setAttribute('xml:space', 'preserve');
    label.textContent = text;
    group.appendChild(label);

    return group;
  }
}

/**
 * One block's own box in workspace units, plus the block whose body it sits inside.
 *
 * 🔴 **`getSurroundParent()` is the nesting question, exactly.** Blockly walks up past every
 * block connected by `next`, so a statement in a top-level stack answers `null` — its
 * neighbours are neighbours, not containers, and the canvas to its left really is empty. A
 * value block plugged into an input, and a statement inside a C-shaped block, both answer with
 * the block they are inside. `getParent()` would have said "the statement above me" for a stack
 * and made every statement in a program look nested.
 *
 * Returns `null` for anything unmeasurable rather than guessing. This runs inside a paint on a
 * frame clock, and a badge that fails to place is better than one placed on a lie.
 */
function blockBox(block: Blockly.BlockSvg): BlockBox | null {
  try {
    const surround = block.getSurroundParent();
    const surroundId = surround ? surround.id : null;

    const measure = (
      block as unknown as {
        getBoundingRectangleWithoutChildren?: () => { left: number; top: number; right: number; bottom: number };
      }
    ).getBoundingRectangleWithoutChildren;

    if (typeof measure === 'function') {
      const rect = measure.call(block);
      if (rect) {
        return {
          id: block.id,
          x: rect.left,
          y: rect.top,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
          surroundId
        };
      }
    }

    // Older Blockly, or a block the renderer has not sized yet. `block.height` excludes the
    // stack below it, which is the property that matters; `block.width` includes connected
    // value blocks, which only makes the layout more cautious.
    const xy = block.getRelativeToSurfaceXY();
    return {
      id: block.id,
      x: xy.x,
      y: xy.y,
      width: block.width || 0,
      height: block.height || 0,
      surroundId
    };
  } catch {
    return null;
  }
}
