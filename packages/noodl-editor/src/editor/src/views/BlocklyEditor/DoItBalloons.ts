/**
 * LGC-002 §3/§4 — the Do It balloon.
 *
 * An **imperative SVG overlay**, appended into the block's own `<g>` so it moves, zooms and
 * dies with the block for free, plus a small marker that toggles it. Several can be up at once,
 * which is the point: a builder does Do It on three blocks and compares.
 *
 * 🔴 **Nothing here may touch the workspace model, and that is the whole reason this file
 * exists.** `BlocklyWorkspace` reads `initialWorkspace` once and never reloads, and every
 * settled edit is serialised through a 300ms debounce and written into the node's `workspace`
 * parameter. A balloon implemented as a `Blockly.Comment` — the obvious way, and the way
 * Blockly's own tutorials do bubbles — is part of the block *model*: it fires a change event,
 * the debounce catches it, and the value gets saved into the user's program, where it reopens
 * next session and diffs in git. So:
 *
 *  - the balloon is built with `document.createElementNS` and appended to `getSvgRoot()`;
 *  - it is never a comment, never a field, never a mutation, never an icon;
 *  - it produces no Blockly events, because DOM mutation is not a Blockly event.
 *
 * The acceptance check for that is "save, close, reopen: byte-identical serialisation", and it
 * is stated in the task as the one most likely to be skipped.
 *
 * @module BlocklyEditor
 */

import type * as Blockly from 'blockly';

import { ColorSpec, resolveThemeTokens } from '../nodegrapheditor/canvas/CanvasTheme';
import { wrapPreview } from './DoIt';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * ⚠️ Danger is `--theme-color-danger` and nothing else. Phase 23's law reserves red for danger,
 * and a failing Do It is the one thing in this overlay entitled to it.
 */
const BALLOON_TOKENS: Record<string, ColorSpec> = {
  surface: { css: '--theme-color-bg-2', fallback: '#1a2029' },
  border: { css: '--theme-color-border-strong', fallback: '#37404c' },
  text: { css: '--theme-color-fg-default', fallback: '#c9d2dd' },
  muted: { css: '--theme-color-fg-muted', fallback: '#8a97a6' },
  danger: { css: '--theme-color-danger', fallback: '#f97066' },
  accent: { css: '--theme-color-primary', fallback: '#4da3ff' }
};

const LINE_HEIGHT = 14;
const PADDING = 6;
/** Roughly one character's advance at 11px in the monospace stack — used for box width only. */
const CHAR_WIDTH = 6.6;

export type BalloonState = 'pending' | 'value' | 'error' | 'refused';

export interface BalloonContent {
  state: BalloonState;
  /** The body, already in `previewValue`'s display dialect when it is a value. */
  text: string;
  /** A second, quieter line — "also sent signal 'done'", "answered by preview 2". */
  note?: string;
}

interface Balloon {
  root: SVGGElement;
  body: SVGGElement;
  visible: boolean;
  /** Kept so a theme flip can repaint what is up rather than throwing it away. */
  content: BalloonContent;
}

/**
 * Every balloon on one workspace.
 *
 * One layer per `BlocklyWorkspace`; disposed with it.
 */
export class DoItBalloonLayer {
  private workspace: Blockly.WorkspaceSvg;
  private balloons = new Map<string, Balloon>();
  private colors = resolveThemeTokens(BALLOON_TOKENS);

  constructor(workspace: Blockly.WorkspaceSvg) {
    this.workspace = workspace;
  }

  /**
   * Re-resolve the palette after a light/dark flip and repaint what is up.
   *
   * Repaint rather than dismiss: a builder who flips theme mid-debug has not asked for their
   * three balloons to be thrown away, and the colours are the only thing that changed.
   */
  refreshTheme(): void {
    this.colors = resolveThemeTokens(BALLOON_TOKENS);

    for (const [blockId, balloon] of Array.from(this.balloons.entries())) {
      const wasHidden = !balloon.visible;
      this.show(blockId, balloon.content);
      if (wasHidden) this.toggle(blockId);
    }
  }

  show(blockId: string, content: BalloonContent): void {
    const block = this.workspace.getBlockById(blockId) as Blockly.BlockSvg | null;
    if (!block) return;

    const root = block.getSvgRoot();
    if (!root) return;

    this.dismiss(blockId);

    const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    group.setAttribute('class', 'noodlDoItBalloon');
    // The body must not eat clicks: it lives inside the block's group, so a pointerdown on it
    // is a pointerdown on the block, and Blockly would start a drag from a text box.
    group.setAttribute('pointer-events', 'none');

    const size = block.getHeightWidth();
    const body = this.buildBody(content);
    body.setAttribute('transform', 'translate(' + (size.width + 16) + ',' + 0 + ')');
    group.appendChild(body);

    const marker = this.buildMarker(content.state);
    marker.setAttribute('transform', 'translate(' + (size.width + 2) + ',' + Math.max(0, size.height / 2 - 7) + ')');
    marker.setAttribute('pointer-events', 'all');
    marker.style.cursor = 'pointer';
    // `pointerdown`, not `click`: Blockly starts its gesture on pointerdown, so a click handler
    // fires only after the block has already been selected and possibly dragged.
    marker.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.toggle(blockId);
    });
    group.appendChild(marker);

    root.appendChild(group);
    this.balloons.set(blockId, { root: group, body, visible: true, content });
  }

  /** Hide or re-show one balloon's body, leaving its marker. App Inventor's equals sign. */
  toggle(blockId: string): void {
    const balloon = this.balloons.get(blockId);
    if (!balloon) return;
    balloon.visible = !balloon.visible;
    balloon.body.setAttribute('display', balloon.visible ? 'inline' : 'none');
  }

  dismiss(blockId: string): void {
    const balloon = this.balloons.get(blockId);
    if (!balloon) return;
    balloon.root.parentNode && balloon.root.parentNode.removeChild(balloon.root);
    this.balloons.delete(blockId);
  }

  /**
   * Everything goes.
   *
   * Called when the blocks change: a value worked out from a program that no longer exists is
   * a lie with a timestamp nobody can see.
   */
  dismissAll(): void {
    for (const blockId of Array.from(this.balloons.keys())) this.dismiss(blockId);
  }

  has(blockId: string): boolean {
    return this.balloons.has(blockId);
  }

  get count(): number {
    return this.balloons.size;
  }

  dispose(): void {
    this.dismissAll();
  }

  private buildMarker(state: BalloonState): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('r', '7');
    circle.setAttribute('cx', '7');
    circle.setAttribute('cy', '7');
    circle.setAttribute('fill', this.colors.surface);
    circle.setAttribute('stroke', state === 'error' ? this.colors.danger : this.colors.accent);
    circle.setAttribute('stroke-width', '1');
    group.appendChild(circle);

    const glyph = document.createElementNS(SVG_NS, 'text');
    glyph.setAttribute('x', '7');
    glyph.setAttribute('y', '11');
    glyph.setAttribute('text-anchor', 'middle');
    glyph.setAttribute('font-size', '10');
    glyph.setAttribute('fill', state === 'error' ? this.colors.danger : this.colors.accent);
    // App Inventor's affordance, copied rather than reinvented: an equals sign means "and this
    // is what it comes to". `!` for a failure, because an equals sign in front of an error
    // message would read as if the error were the value.
    glyph.textContent = state === 'error' ? '!' : '=';
    group.appendChild(glyph);

    return group;
  }

  private buildBody(content: BalloonContent): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g') as SVGGElement;

    const lines = wrapPreview(content.text);
    const noteLines = content.note ? wrapPreview(content.note) : [];
    const all = lines.length + noteLines.length;
    const widest = Math.max(...lines.concat(noteLines).map((l) => l.length), 4);

    const width = widest * CHAR_WIDTH + PADDING * 2;
    const height = all * LINE_HEIGHT + PADDING * 2;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('rx', '4');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', this.colors.surface);
    rect.setAttribute('stroke', content.state === 'error' ? this.colors.danger : this.colors.border);
    rect.setAttribute('stroke-width', '1');
    group.appendChild(rect);

    // The stalk back to the block, so three balloons at once still read as belonging to
    // particular blocks rather than floating.
    const stalk = document.createElementNS(SVG_NS, 'path');
    stalk.setAttribute('d', 'M0,' + (PADDING + LINE_HEIGHT / 2) + ' L-10,' + (PADDING + LINE_HEIGHT / 2));
    stalk.setAttribute('stroke', content.state === 'error' ? this.colors.danger : this.colors.border);
    stalk.setAttribute('fill', 'none');
    group.appendChild(stalk);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(PADDING));
    text.setAttribute('y', String(PADDING + 11));
    text.setAttribute('font-size', '11');
    text.setAttribute('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');
    text.setAttribute('xml:space', 'preserve');

    const bodyColor =
      content.state === 'error' ? this.colors.danger : content.state === 'pending' ? this.colors.muted : this.colors.text;

    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', String(PADDING));
      if (index > 0) tspan.setAttribute('dy', String(LINE_HEIGHT));
      tspan.setAttribute('fill', bodyColor);
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    noteLines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', String(PADDING));
      tspan.setAttribute('dy', String(LINE_HEIGHT));
      tspan.setAttribute('fill', this.colors.muted);
      tspan.textContent = line;
      text.appendChild(tspan);
      void index;
    });

    group.appendChild(text);
    return group;
  }
}
