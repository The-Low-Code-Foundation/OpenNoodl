/**
 * VFN-006 — the blocks a save is about to take, outlined on the workspace.
 *
 * > *"It's not clear which blocks are going to be saved. It explains 5 blocks but it'd make more
 * > sense if you like drag highlighted them or something no?"*
 *
 * The count was never wrong. *"These 5 blocks"* is **deictic** — it points — and the dialog is
 * modal and centred, so there was nothing on screen it pointed at. This draws the thing it points
 * at: one outline per block, on the workspace, while the choice is live.
 *
 * 🔴 **Drag-highlighting is not available and that is not a matter of effort.** Blockly 12 core
 * has no multi-select, and LGC-006 ruled that adopting the multi-select plugin pins a frozen
 * Blockly 12 release because every official plugin's `latest` peer-depends on Blockly 13. The
 * gesture is one right-click on the top block of a group, so the honest answer to "which blocks"
 * is to show them rather than to change the gesture.
 *
 * ## 🔴 An overlay, never a model change — the rule this file exists to obey
 *
 * `BlocklyWorkspace` serialises on every non-UI event and writes the result into the node's
 * `workspace` parameter through a 300 ms debounce. So `select()`, `addSelect()`,
 * `setHighlighted()` and `setDisabledReason()` are all out: a highlight that flows through the
 * block model becomes a change event, becomes a save, and ends up in the builder's `project.json`
 * where it reopens next session and diffs in git. LGC-003 §2 was reverted for exactly that, in a
 * subtler costume.
 *
 * What is done instead is what `DoItBalloons` does and for the same reason: **`cloneNode` the
 * block's own `<path>`, stroke it, and append it inside the block's `<g>`.** A DOM mutation is
 * not a Blockly event. Living inside the block's own group means it moves, zooms and dies with
 * the block for free — no coordinate arithmetic, and no second copy of "where is this block".
 * Cloning the real path rather than boxing the block also means the outline is the block's actual
 * silhouette, notches included, so a stack of five reads as five blocks rather than one rectangle.
 *
 * ## Two strokes, not one
 *
 * Blockly blocks are already coloured, and a builder's program contains several hues at once, so
 * a single accent stroke is legible on some blocks and invisible on others. The outline is
 * therefore painted twice — a dark casing underneath, the accent on top — which is the same
 * technique a focus ring uses and holds against any block colour. `vector-effect:
 * non-scaling-stroke` keeps both at their screen width as the workspace zooms out, which is the
 * rule the canvas glyphs learned the hard way.
 *
 * @module BlocklyEditor
 */

import type * as Blockly from 'blockly';

import { ColorSpec, resolveThemeTokens } from '../nodegrapheditor/canvas/CanvasTheme';
import type { SaveOutline } from './MyBlocksSave';

/** The class on every element this layer adds. Nothing else in the editor uses it. */
export const OUTLINE_CLASS = 'noodlMyBlocksSaveOutline';

const OUTLINE_TOKENS: Record<string, ColorSpec> = {
  /** The mark itself. Selection, not danger — Phase 23's law reserves red. */
  accent: { css: '--theme-color-primary', fallback: '#4da3ff' },
  /** The casing under it, so the accent reads on a light block as well as a dark one. */
  casing: { css: '--theme-color-bg-1', fallback: '#11151b' }
};

/** Screen pixels, held constant under zoom by `vector-effect`. */
const CASING_WIDTH = 5;
const ACCENT_WIDTH = 2.5;

/**
 * A duck-typed `WorkspaceSvg`.
 *
 * `attachMyBlocksSave` is used headlessly by the specs against a plain `Blockly.Workspace`, which
 * has no `getBlockById` returning a rendered block and no SVG at all. Typing the constructor
 * against the *capability* rather than against `WorkspaceSvg` is what lets the caller pass
 * whatever it has and get a layer that draws nothing rather than one that throws.
 */
interface RenderedWorkspace {
  getBlockById(id: string): Blockly.Block | null;
}

/**
 * One outline layer per open block editor.
 *
 * Two ways to ask for an outline, and they are not the same request:
 *
 *  - `show` / `hide` — **transient**, for as long as a pointer is over the menu item. Cheap to
 *    ask for, cheap to withdraw, and it must never be the thing that takes an outline away from
 *    an open dialog.
 *  - `pin` / `unpin` — **owned by the dialog**, for as long as it is up. Outranks the transient
 *    one, which is why the two are separate calls rather than a counter: the pointer leaves the
 *    menu item the instant the menu closes to open the dialog, and a single `hide` would have
 *    raced the dialog's own `pin` on every single save.
 */
export class MyBlocksSaveOutline implements SaveOutline {
  private readonly workspace: RenderedWorkspace;
  private colors = resolveThemeTokens(OUTLINE_TOKENS);

  /** The dialog's request, which outranks a hover. */
  private pinned: readonly string[] | null = null;
  /** The hover's request. */
  private hovered: readonly string[] | null = null;

  /** Every element currently on the workspace, so `clear` needs no DOM query. */
  private drawn: SVGGElement[] = [];

  constructor(workspace: RenderedWorkspace) {
    this.workspace = workspace;
  }

  show(blockIds: readonly string[]): void {
    this.hovered = blockIds;
    this.render();
  }

  hide(): void {
    this.hovered = null;
    this.render();
  }

  pin(blockIds: readonly string[]): number {
    this.pinned = blockIds;
    return this.render();
  }

  unpin(): void {
    this.pinned = null;
    this.render();
  }

  /**
   * Re-resolve the palette after a light/dark flip and repaint what is up.
   *
   * Repaint rather than drop, for the reason `DoItBalloons` gives: a builder who flips theme
   * with a dialog open has not asked for the outline to go away, and the colours are the only
   * thing that changed.
   */
  refreshTheme(): void {
    this.colors = resolveThemeTokens(OUTLINE_TOKENS);
    this.render();
  }

  dispose(): void {
    this.pinned = null;
    this.hovered = null;
    this.clear();
  }

  /** Test seam: how many outlines are on the workspace right now. */
  get count(): number {
    return this.drawn.length;
  }

  /**
   * Paint whatever is currently asked for.
   *
   * @returns how many blocks were actually outlined. 🔴 The **drawn** count, not the requested
   *   one: a block id that no longer resolves to a rendered block draws nothing, and the dialog
   *   uses this number to decide whether it may say *"outlined behind this dialog"*. Returning
   *   the request would let the sentence claim an outline that is not on screen.
   */
  private render(): number {
    this.clear();

    const ids = this.pinned || this.hovered;
    if (!ids) return 0;

    for (const id of ids) {
      const element = this.outlineFor(id);
      if (element) this.drawn.push(element);
    }

    return this.drawn.length;
  }

  private clear(): void {
    for (const element of this.drawn) {
      element.parentNode && element.parentNode.removeChild(element);
    }
    this.drawn = [];
  }

  private outlineFor(blockId: string): SVGGElement | null {
    const block = this.workspace.getBlockById(blockId) as Blockly.BlockSvg | null;
    if (!block || typeof block.getSvgRoot !== 'function') return null;

    const root = block.getSvgRoot();
    if (!root) return null;

    // The block's own silhouette. `:scope >` rather than a descendant search: a C-block's
    // children are `<g>`s inside this same root and each has a `.blocklyPath` of its own, which
    // a descendant query would return first and which already gets its own outline.
    const path = root.querySelector(':scope > path.blocklyPath') as SVGPathElement | null;
    if (!path) return null;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
    group.setAttribute('class', OUTLINE_CLASS);
    // 🔴 The overlay must not eat the pointer. It sits inside the block's group, so a
    // pointerdown on it is a pointerdown on the block, and Blockly would start a drag from a
    // decoration — which would be a model change made by the thing that promised not to make one.
    group.setAttribute('pointer-events', 'none');

    group.appendChild(this.stroke(path, this.colors.casing, CASING_WIDTH));
    group.appendChild(this.stroke(path, this.colors.accent, ACCENT_WIDTH));

    root.appendChild(group);
    return group;
  }

  private stroke(path: SVGPathElement, color: string, width: number): SVGPathElement {
    // `cloneNode(false)` — the shape and nothing under it. A deep clone would duplicate whatever
    // the renderer has hung off the path.
    const clone = path.cloneNode(false) as SVGPathElement;
    clone.removeAttribute('class');
    clone.removeAttribute('id');
    clone.removeAttribute('filter');
    clone.setAttribute('fill', 'none');
    clone.setAttribute('stroke', color);
    clone.setAttribute('stroke-width', String(width));
    clone.setAttribute('stroke-linejoin', 'round');
    // Screen width, not workspace width: an outline that thins to nothing as the builder zooms
    // out is an outline that stops answering the question it was drawn for.
    clone.setAttribute('vector-effect', 'non-scaling-stroke');
    return clone;
  }
}
