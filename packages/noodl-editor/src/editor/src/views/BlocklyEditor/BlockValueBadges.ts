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
 * @module BlocklyEditor
 */

import type * as Blockly from 'blockly';

import { ColorSpec, resolveThemeTokens } from '../nodegrapheditor/canvas/CanvasTheme';
import type { BlockMark } from './BlockValueTrace';

const SVG_NS = 'http://www.w3.org/2000/svg';

const BADGE_TOKENS: Record<string, ColorSpec> = {
  surface: { css: '--theme-color-bg-2', fallback: '#1a2029' },
  border: { css: '--theme-color-border-strong', fallback: '#37404c' },
  text: { css: '--theme-color-fg-default', fallback: '#c9d2dd' },
  muted: { css: '--theme-color-fg-muted', fallback: '#8a97a6' },
  accent: { css: '--theme-color-primary', fallback: '#4da3ff' }
};

/** Roughly one character's advance at 11px in the monospace stack. Box width only. */
const CHAR_WIDTH = 6.6;
const BADGE_HEIGHT = 16;
const BADGE_PADDING = 5;

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

    marks.forEach((mark, blockId) => {
      if (mark.state === 'neutral') return;

      const block = this.workspace.getBlockById(blockId) as Blockly.BlockSvg | null;
      if (!block) return;
      const root = block.getSvgRoot();
      if (!root) return;

      wanted.add(blockId);

      const key = mark.state + '|' + (mark.badge || '');
      const existing = this.marks.get(blockId);
      if (existing && existing.key === key) return;
      if (existing) this.removeMark(blockId);

      const group =
        mark.state === 'hollow'
          ? this.buildHollow(block)
          : this.buildBadge(blockId, truncateBadge(mark.badge || ''), mark.iterations);
      if (!group) return;

      root.appendChild(group);
      this.marks.set(blockId, { group, key });
    });

    for (const blockId of Array.from(this.marks.keys())) {
      if (!wanted.has(blockId)) this.removeMark(blockId);
    }
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
    rect.setAttribute('fill', this.colors.surface);
    rect.setAttribute('fill-opacity', '0.62');
    rect.setAttribute('stroke', this.colors.muted);
    rect.setAttribute('stroke-dasharray', '3 3');
    rect.setAttribute('stroke-width', '1');
    group.appendChild(rect);

    return group;
  }

  /** §5.1 — the badge, at the output plug. */
  private buildBadge(blockId: string, text: string, iterations: number): SVGGElement | null {
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

    const width = text.length * CHAR_WIDTH + BADGE_PADDING * 2;
    // The output connection is on the left edge; the badge hangs just outside it so it does not
    // cover the block's own fields. A statement block has no output connection and gets the
    // same anchor, which is where its wire would have left from.
    const x = -(width + 6);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('rx', '3');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(BADGE_HEIGHT));
    rect.setAttribute('fill', this.colors.surface);
    rect.setAttribute('stroke', this.colors.accent);
    rect.setAttribute('stroke-width', '1');
    group.appendChild(rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(x + BADGE_PADDING));
    label.setAttribute('y', '12');
    label.setAttribute('font-size', '11');
    label.setAttribute('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');
    label.setAttribute('fill', this.colors.text);
    label.setAttribute('xml:space', 'preserve');
    label.textContent = text;
    group.appendChild(label);

    return group;
  }
}
