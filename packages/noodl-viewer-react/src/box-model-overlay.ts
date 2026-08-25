/**
 * FB-016 — the box model you cannot see.
 *
 * The editor's design mode has always been able to *point* at an element: `inspector.ts` resolves
 * the pointer to a Noodl node and `highlighter.ts` draws a 2px teal rectangle round it. What it
 * has never been able to do is say **why the element is where it is** — which is the whole of the
 * report this comes from: an author cycling Pos X, Transform X, margin and padding trying to move
 * an image, with nothing on screen telling him which of the four was even in play.
 *
 * This module is the answer to that, and it is deliberately split in two halves:
 *
 * - **the pure half** (`readBoxModel`, `describeBox`, `overlayRadii`, `OVERLAY_COLORS`) — plain
 *   functions over numbers and strings, with no `document` in sight, so every claim they make can
 *   be graded in a plain-Node runner. jsdom has no layout engine: `getBoundingClientRect()` is all
 *   zeroes there and `getComputedStyle()` returns initial values, so a test that asked the DOM
 *   these questions would grade nothing at all. Feeding the geometry in is what makes it gradeable.
 * - **the DOM half** (`BoxModelOverlay`) — builds and positions the divs.
 *
 * ## Where the facts come from, and why not from the node's parameters
 *
 * AC1 asks for `getComputedStyle` in the *running viewer*, not the stored parameters, and the
 * difference is the point. A node's `sizeMode`/`width` parameters say what the author asked for;
 * `layout.ts` then translates that into CSS that frequently does not look like the request — a
 * percentage width along the parent's flex direction becomes **`flex-grow`** and no width at all
 * (`Layout.size`), and Noodl's alignment becomes **`auto` margins** or `align-self`
 * (`Layout.align`). An overlay reading the parameters would report "width 100%" for a node whose
 * width is actually being negotiated with its siblings. Reading the element gets the truth, and it
 * also covers everything CSS reaches the element by other routes: Advanced CSS, a `cssClassName`,
 * a stylesheet the author wrote themselves.
 *
 * ⚠️ One thing is read from the *specified* inline style rather than the computed one, and it has
 * to be: **computed `width` is always a used pixel length**, so it cannot tell `100%` from the
 * `240px` it happens to resolve to. That distinction is confusion #1 in the report ("why has that
 * group taken up the whole width"), so the specified value is what answers it.
 *
 * @module noodl-viewer-react/box-model-overlay
 */

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * The slice of `CSSStyleDeclaration` this module reads.
 *
 * A plain object with a `getPropertyValue` satisfies it, which is exactly what lets the geometry
 * be graded without a layout engine — and a real `CSSStyleDeclaration` satisfies it too, so the
 * running code and the graded code call the same functions with the same shape.
 */
export interface ComputedReader {
  getPropertyValue(property: string): string;
}

export interface BoxModel {
  /** The border box, in viewport coordinates — what `getBoundingClientRect()` returns. */
  border: RectLike;
  margin: Edges;
  borderWidth: Edges;
  padding: Edges;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Reading the box
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A CSS length in pixels, or 0.
 *
 * ⚠️ `auto` deliberately reads as 0 rather than `NaN`. A computed `margin-left: auto` that has
 * been *used* reports the resolved pixel length, so `auto` only survives here when the value was
 * never laid out — and a band of `NaN` pixels draws nothing but does so by throwing the geometry
 * off. The fact line reports auto margins separately, from the specified value, where the word
 * still exists.
 */
export function px(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isFinite(parsed) ? parsed : 0;
}

function edges(style: ComputedReader, build: (side: string) => string): Edges {
  return {
    top: px(style.getPropertyValue(build('top'))),
    right: px(style.getPropertyValue(build('right'))),
    bottom: px(style.getPropertyValue(build('bottom'))),
    left: px(style.getPropertyValue(build('left')))
  };
}

export function readBoxModel(rect: RectLike, style: ComputedReader): BoxModel {
  return {
    border: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    margin: edges(style, (side) => 'margin-' + side),
    borderWidth: edges(style, (side) => 'border-' + side + '-width'),
    padding: edges(style, (side) => 'padding-' + side)
  };
}

/** The border box grown by the margins — the outermost region the overlay paints. */
export function marginRect(model: BoxModel): RectLike {
  return {
    x: model.border.x - model.margin.left,
    y: model.border.y - model.margin.top,
    width: model.border.width + model.margin.left + model.margin.right,
    height: model.border.height + model.margin.top + model.margin.bottom
  };
}

function inset(rect: RectLike, by: Edges): RectLike {
  return {
    x: rect.x + by.left,
    y: rect.y + by.top,
    width: Math.max(0, rect.width - by.left - by.right),
    height: Math.max(0, rect.height - by.top - by.bottom)
  };
}

/** Inside the borders. */
export function paddingRect(model: BoxModel): RectLike {
  return inset(model.border, model.borderWidth);
}

/** Inside the padding — the content box, which is the size an author thinks of as "the element". */
export function contentRect(model: BoxModel): RectLike {
  return inset(paddingRect(model), model.padding);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Scope 5 — the outline has to follow the corner radius, but only where the corner is round
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Replaced elements clip their own content at the radius whatever `overflow` says. */
const REPLACED_TAGS = ['img', 'video', 'canvas', 'svg', 'iframe', 'embed', 'object', 'input', 'select', 'textarea'];

export function readCornerRadii(style: ComputedReader): CornerRadii {
  return {
    topLeft: px(style.getPropertyValue('border-top-left-radius')),
    topRight: px(style.getPropertyValue('border-top-right-radius')),
    bottomRight: px(style.getPropertyValue('border-bottom-right-radius')),
    bottomLeft: px(style.getPropertyValue('border-bottom-left-radius'))
  };
}

/**
 * Whether nothing can paint outside this element's rounded corner.
 *
 * True for a replaced element (its content is clipped by the radius with no `overflow` needed) and
 * for any element whose `overflow` is not `visible` on both axes.
 */
export function clipsAtRadius(tagName: string, style: ComputedReader): boolean {
  if (REPLACED_TAGS.indexOf((tagName || '').toLowerCase()) !== -1) {
    return true;
  }

  const x = style.getPropertyValue('overflow-x') || 'visible';
  const y = style.getPropertyValue('overflow-y') || 'visible';
  return x !== 'visible' || y !== 'visible';
}

function intersects(a: RectLike, b: RectLike): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * The radii the overlay should draw — which are **not** always the element's own.
 *
 * 🔴 **Mirroring `border-radius` unconditionally would start a second class of false bug report,
 * and it is the one FB-017's drive measured.** Hit-testing the corner pixel of a 200×200 box at a
 * 40px radius, in the editor's own renderer:
 *
 * - an `<img>` carrying the radius, nothing clipping it → the corner **does not answer**: it is
 *   genuinely round, and a square outline over it is what Jordan read as *"corner radius rendered
 *   as a box outline — possible render bug"*. This is the case scope 5 exists for;
 * - a *container* carrying the radius at `overflow: visible` with a square child → the corner
 *   answers **the child**. The corner really is square there, because the child paints over it,
 *   and an overlay that rounded itself against it would be the one telling the lie.
 *
 * So a corner is drawn round when the element clips at it, or when nothing of its own is painting
 * over that corner — decided per corner, because a child covering the top-left says nothing about
 * the bottom-right.
 *
 * ⚠️ `childRects` is an approximation in one direction only, and it under-rounds rather than
 * over-rounds: a child that *reaches into* the corner square is assumed to paint there, when a
 * transparent one would not. A square outline on a round corner is the report we already have; a
 * round outline on a square corner would be a new one, so the conservative direction is the safe
 * one to be wrong in.
 */
export function overlayRadii(input: {
  radii: CornerRadii;
  borderRect: RectLike;
  clips: boolean;
  childRects: RectLike[];
}): CornerRadii {
  const { radii, borderRect, clips, childRects } = input;

  if (clips || !childRects || childRects.length === 0) {
    return radii;
  }

  const corner = (r: number, x: number, y: number): number => {
    if (r <= 0) return 0;
    const square: RectLike = { x, y, width: r, height: r };
    for (let i = 0; i < childRects.length; i++) {
      if (intersects(childRects[i], square)) return 0;
    }
    return r;
  };

  return {
    topLeft: corner(radii.topLeft, borderRect.x, borderRect.y),
    topRight: corner(radii.topRight, borderRect.x + borderRect.width - radii.topRight, borderRect.y),
    bottomRight: corner(
      radii.bottomRight,
      borderRect.x + borderRect.width - radii.bottomRight,
      borderRect.y + borderRect.height - radii.bottomRight
    ),
    bottomLeft: corner(radii.bottomLeft, borderRect.x, borderRect.y + borderRect.height - radii.bottomLeft)
  };
}

export function radiiToCss(radii: CornerRadii): string {
  return radii.topLeft + 'px ' + radii.topRight + 'px ' + radii.bottomRight + 'px ' + radii.bottomLeft + 'px';
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Scope 2 — the fact line: what actually placed this element
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface FactInput {
  /** The element's border box, in viewport coordinates. */
  rect: RectLike;
  /** `getComputedStyle(element)`. */
  computed: ComputedReader;
  /** `element.style` — the *specified* declarations, which is where `100%` and `auto` survive. */
  specified: ComputedReader;
  parent?: {
    rect: RectLike;
    computed: ComputedReader;
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The percentage inside `calc(100% - 8px)`, which is what `Layout.size` writes for a sized node with margins. */
function percentageInCalc(value: string): string | null {
  const match = /calc\(\s*([\d.]+%)/.exec(value);
  return match ? match[1] : null;
}

function mainAxisOf(direction: string): 'width' | 'height' {
  return direction.indexOf('column') === 0 ? 'height' : 'width';
}

/**
 * Where one axis of the element's size came from.
 *
 * 🔴 **The specified value and the computed value answer different questions here, and only the
 * specified one answers the author's.** Computed `width` is a used pixel length: a node at `100%`
 * and a node pinned to `240px` are the same string once the layout has run, and telling them apart
 * is the whole of *"why has that group taken up the whole width"*.
 */
export function describeSize(axis: 'width' | 'height', input: FactInput): string {
  const specified = (input.specified.getPropertyValue(axis) || '').trim();
  const parentDirection = input.parent ? input.parent.computed.getPropertyValue('flex-direction') || 'row' : '';
  const parentIsFlex = input.parent
    ? (input.parent.computed.getPropertyValue('display') || '').indexOf('flex') !== -1
    : false;
  const grow = parseFloat(input.computed.getPropertyValue('flex-grow') || '0') || 0;
  const sharesTheAxis = parentIsFlex && grow > 0 && mainAxisOf(parentDirection) === axis;

  // `Layout.size` turns a percentage along the parent's flex direction into `flex-grow` and leaves
  // the percentage in place, so both halves are true at once and the shorter one is a half-truth:
  // the node is not simply "100% wide", it is negotiating that width with its siblings.
  if (sharesTheAxis) {
    const share = specified || percentageInCalc(specified) || '';
    const lead = share ? share + ' — shares' : 'shares';
    return axis + ': ' + lead + ' the ' + (mainAxisOf(parentDirection) === 'width' ? 'row' : 'column') +
      ' with its siblings (flex-grow: ' + grow + ')';
  }

  if (!specified) {
    return axis + ': from its content';
  }

  const inCalc = percentageInCalc(specified);
  if (inCalc) {
    return axis + ': ' + inCalc + ' of the parent, less its own margins';
  }

  if (specified.charAt(specified.length - 1) === '%') {
    return axis + ': ' + specified + ' of the parent';
  }

  return axis + ': fixed ' + specified;
}

/**
 * `normal` is what `getComputedStyle` returns for an untouched `justify-content` or `align-items`,
 * and it is a word that answers nothing — an author reading *"packs them: normal"* learns less
 * than they did before asking. Inside a flex container (the only place these lines are emitted)
 * `normal` behaves as the stated default, so naming that default is the same claim in words that
 * carry it.
 */
function effectiveAlignment(value: string, whenNormal: string): string {
  const said = (value || '').trim();
  return !said || said === 'normal' ? whenNormal : said;
}

/** What an `align-self` actually does to the child, across the parent's stacking direction. */
const ACROSS: Record<string, string> = {
  center: 'centred across its parent',
  'flex-start': 'held to the start of its parent, not centred',
  'flex-end': 'held to the end of its parent, not centred',
  start: 'held to the start of its parent, not centred',
  end: 'held to the end of its parent, not centred',
  stretch: 'stretched to fill its parent across'
};

/** Everything the overlay says in words, in reading order, size first. */
export function describeBox(input: FactInput): string[] {
  const facts: string[] = [round(input.rect.width) + ' × ' + round(input.rect.height)];

  facts.push(describeSize('width', input));
  facts.push(describeSize('height', input));

  const position = input.computed.getPropertyValue('position') || 'static';
  if (position === 'absolute' || position === 'fixed') {
    facts.push('position: ' + position + ' — placed on its parent, not in its flow');
  } else {
    facts.push('position: ' + position + ' — flows after its siblings');
  }

  const transform = (input.computed.getPropertyValue('transform') || 'none').trim();
  if (transform && transform !== 'none') {
    facts.push('transform: ' + transform + ' — moves it after it has been placed');
  }

  if (input.parent) {
    const display = input.parent.computed.getPropertyValue('display') || '';
    if (display.indexOf('flex') !== -1) {
      const direction = input.parent.computed.getPropertyValue('flex-direction') || 'row';
      facts.push('parent stacks its children in a ' + (direction.indexOf('column') === 0 ? 'column' : 'row'));

      facts.push(
        'parent packs: ' +
          effectiveAlignment(input.parent.computed.getPropertyValue('justify-content'), 'flex-start') +
          '  ·  lines up: ' +
          effectiveAlignment(input.parent.computed.getPropertyValue('align-items'), 'stretch')
      );
    } else if (display) {
      facts.push('parent lays out as ' + display);
    }
  }

  const autoMargins = describeAutoMargins(input.specified);
  if (autoMargins) {
    facts.push(autoMargins);
  }

  const alignSelf = (
    input.specified.getPropertyValue('align-self') ||
    input.computed.getPropertyValue('align-self') ||
    ''
  ).trim();
  if (alignSelf && alignSelf !== 'auto' && alignSelf !== 'normal') {
    facts.push('align-self: ' + alignSelf + ' — ' + (ACROSS[alignSelf] || 'this child only, overriding the parent'));
  }

  const overflow = describeParentOverflow(input);
  if (overflow) {
    facts.push(overflow);
  }

  return facts;
}

/**
 * Noodl's alignment *is* `auto` margins for an in-flow node (`Layout.align`), so the word an
 * author needs — "centred" — exists nowhere except in the specified style. Reading the computed
 * one gets the pixels the auto margin resolved to and loses the fact that it was auto at all.
 */
export function describeAutoMargins(specified: ComputedReader): string | null {
  const left = (specified.getPropertyValue('margin-left') || '').trim() === 'auto';
  const right = (specified.getPropertyValue('margin-right') || '').trim() === 'auto';
  const top = (specified.getPropertyValue('margin-top') || '').trim() === 'auto';
  const bottom = (specified.getPropertyValue('margin-bottom') || '').trim() === 'auto';

  const said: string[] = [];
  if (left && right) said.push('centred across by auto margins');
  else if (left) said.push('pushed right by margin-left: auto');
  else if (right) said.push('pushed left by margin-right: auto');

  if (top && bottom) said.push('centred down by auto margins');
  else if (top) said.push('pushed down by margin-top: auto');
  else if (bottom) said.push('pushed up by margin-bottom: auto');

  return said.length ? said.join(', ') : null;
}

/**
 * Scope 3's first cue — the element is bigger than the space it was given.
 *
 * Measured against the parent's **content box**, not its border box: an element that starts inside
 * the parent's padding and runs past it is already outside the space the parent offered, and
 * saying so at the border box would miss exactly the padding-sized cases.
 */
export function describeParentOverflow(input: FactInput): string | null {
  if (!input.parent) return null;

  const parentModel = readBoxModel(input.parent.rect, input.parent.computed);
  const inner = contentRect(parentModel);

  const over: string[] = [];
  const past = (amount: number, side: string) => {
    if (amount > 0.5) over.push(round(amount) + 'px past the ' + side);
  };

  past(inner.x - input.rect.x, 'left');
  past(input.rect.x + input.rect.width - (inner.x + inner.width), 'right');
  past(inner.y - input.rect.y, 'top');
  past(input.rect.y + input.rect.height - (inner.y + inner.height), 'bottom');

  return over.length ? 'overflows its parent: ' + over.join(', ') : null;
}

/** `margin 8/0/8/0 · padding 4/12/4/12`, for the bands too thin to carry a number of their own. */
export function describeSpacing(model: BoxModel): string | null {
  const said: string[] = [];
  const list = (e: Edges) => e.top + '/' + e.right + '/' + e.bottom + '/' + e.left;
  const any = (e: Edges) => e.top !== 0 || e.right !== 0 || e.bottom !== 0 || e.left !== 0;

  if (any(model.margin)) said.push('margin ' + list(model.margin));
  if (any(model.padding)) said.push('padding ' + list(model.padding));
  if (any(model.borderWidth)) said.push('border ' + list(model.borderWidth));

  return said.length ? said.join('  ·  ') + '   (top/right/bottom/left)' : null;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// AC4 — colours that survive arbitrary user content
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The overlay's palette.
 *
 * 🔴 **This is not a theme, and it deliberately does not use the editor's tokens.** The overlay is
 * painted *inside the running app*, over content the author wrote — a document that has never
 * heard of `--theme-color-*` and whose background can be any colour at all. "Both themes" is the
 * wrong question here; the right one is *every possible ground*, which is a stronger claim and the
 * one `tests/fb-016-overlay-contrast.test.ts` grades.
 *
 * ✅ **Every structural edge is drawn twice — one near-black stroke and one near-white stroke —
 * and that pair is what makes the claim provable.** No single colour can hold 3:1 against both
 * black and white content (it needs a relative luminance above 0.10 to clear black and below 0.30
 * to clear white, and then it is a mid-tone that fails against mid-tone content). A pair does:
 * swept across every luminance a ground can have, the better of the two never drops below
 * **4.06:1**. The tinted region fills are identification, not structure — they are the DevTools
 * dialect an author may already know, and they are stated as unmeasured on purpose.
 */
export const OVERLAY_COLORS = {
  /** DevTools' convention: orange margin, yellow border, green padding, blue content. */
  margin: 'rgba(246, 178, 107, 0.55)',
  border: 'rgba(255, 229, 153, 0.55)',
  padding: 'rgba(147, 196, 125, 0.55)',
  content: 'rgba(111, 168, 220, 0.30)',

  /** The structural pair. Graded against every ground, not against a theme. */
  edgeDark: '#14181C',
  edgeLight: '#F4F6F8',

  /** The fact chip paints its own opaque ground, so its text is a plain measurable pair. */
  chipBackground: '#14181C',
  chipForeground: '#FFFFFF',
  chipSecondary: '#C7D0DA',

  /** The band numbers sit on the tints, so they carry their own ground too. */
  numberBackground: '#14181C',
  numberForeground: '#FFFFFF'
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The DOM half
// ─────────────────────────────────────────────────────────────────────────────────────────────

const SIDES: Array<keyof Edges> = ['top', 'right', 'bottom', 'left'];

/** A band narrower than this cannot hold a number legibly; `describeSpacing` covers those instead. */
const MIN_LABELLED_BAND = 14;

/** A guard on the per-corner child test, which runs every animation frame. */
const MAX_CHILDREN_SAMPLED = 40;

function styleRegion(div: HTMLDivElement, colour: string): HTMLDivElement {
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.left = '0';
  div.style.boxSizing = 'border-box';
  div.style.borderStyle = 'solid';
  div.style.borderColor = colour;
  div.style.borderWidth = '0';
  return div;
}

function place(div: HTMLElement, rect: RectLike): void {
  moveTo(div, rect.x, rect.y);
  div.style.width = rect.width + 'px';
  div.style.height = rect.height + 'px';
}

function moveTo(div: HTMLElement, x: number, y: number): void {
  div.style.transform = 'translateX(' + x + 'px) translateY(' + y + 'px)';
}

function setBorderWidths(div: HTMLDivElement, e: Edges): void {
  div.style.borderWidth = e.top + 'px ' + e.right + 'px ' + e.bottom + 'px ' + e.left + 'px';
}

/**
 * The box-model overlay: the tinted regions, the band numbers, the edge, and the fact chip.
 *
 * One instance draws **one** element at a time, which is why it is owned by the `Highlighter`
 * rather than created per highlighted node. Two chips on screen at once say the same thing twice
 * and cover the content the author is trying to look at, and the hover and selection outlines are
 * frequently the same element anyway.
 */
export class BoxModelOverlay {
  root: HTMLDivElement;
  private marginDiv: HTMLDivElement;
  private borderDiv: HTMLDivElement;
  private paddingDiv: HTMLDivElement;
  private contentDiv: HTMLDivElement;
  private edgeDiv: HTMLDivElement;
  private chip: HTMLDivElement;
  private numbers: HTMLDivElement[];

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.setAttribute('data-noodl-box-overlay', '');
    // AC3: the overlay must never be in the way of the Inspector's own capture-phase listeners.
    // The highlight root already sets this, but a child that is reparented or a root whose style
    // is overwritten would take the whole inspect-click-through with it, so it is stated here too.
    root.style.pointerEvents = 'none';
    root.style.display = 'none';
    parent.appendChild(root);
    this.root = root;

    this.marginDiv = styleRegion(document.createElement('div'), OVERLAY_COLORS.margin);
    this.borderDiv = styleRegion(document.createElement('div'), OVERLAY_COLORS.border);
    this.paddingDiv = styleRegion(document.createElement('div'), OVERLAY_COLORS.padding);

    this.contentDiv = document.createElement('div');
    this.contentDiv.style.position = 'absolute';
    this.contentDiv.style.top = '0';
    this.contentDiv.style.left = '0';
    this.contentDiv.style.backgroundColor = OVERLAY_COLORS.content;

    this.edgeDiv = document.createElement('div');
    this.edgeDiv.style.position = 'absolute';
    this.edgeDiv.style.top = '0';
    this.edgeDiv.style.left = '0';
    this.edgeDiv.style.boxShadow =
      '0 0 0 1px ' + OVERLAY_COLORS.edgeDark + ', 0 0 0 2px ' + OVERLAY_COLORS.edgeLight;

    this.chip = document.createElement('div');
    this.chip.setAttribute('data-noodl-box-overlay-chip', '');
    this.chip.style.position = 'absolute';
    this.chip.style.top = '0';
    this.chip.style.left = '0';
    this.chip.style.padding = '6px 8px';
    this.chip.style.borderRadius = '4px';
    this.chip.style.backgroundColor = OVERLAY_COLORS.chipBackground;
    this.chip.style.color = OVERLAY_COLORS.chipForeground;
    this.chip.style.font = "500 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    this.chip.style.whiteSpace = 'nowrap';
    this.chip.style.boxShadow = '0 0 0 1px ' + OVERLAY_COLORS.edgeLight + ', 0 2px 8px rgba(0,0,0,0.45)';

    this.numbers = [];

    root.appendChild(this.marginDiv);
    root.appendChild(this.borderDiv);
    root.appendChild(this.paddingDiv);
    root.appendChild(this.contentDiv);
    root.appendChild(this.edgeDiv);
    root.appendChild(this.chip);
  }

  clear(): void {
    this.root.style.display = 'none';
  }

  /**
   * Where the fact chip currently is, or `null` when nothing is drawn.
   *
   * FB-016 scope 4 — the transform-origin crosshair carries its own label, and both it and this
   * chip want to sit beside the same element. The first drive of the crosshair put one squarely on
   * top of the other and made the box facts unreadable, so the crosshair asks where this one is
   * and stays out of its way.
   */
  chipRect(): RectLike | null {
    if (this.root.style.display === 'none') return null;
    const rect = this.chip.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  dispose(): void {
    this.root.remove();
  }

  /**
   * @param readStyle the caller's own `getComputedStyle`, when it already has one. The highlighter
   * reads the style anyway to round the teal outline, and a second read in the same frame is a
   * second forced style recalculation on every animation frame of every hover.
   */
  update(element: HTMLElement | null, readStyle?: CSSStyleDeclaration, readRect?: RectLike): void {
    if (!element || !element.isConnected) {
      this.clear();
      return;
    }

    const computed = readStyle || window.getComputedStyle(element);
    const rect = readRect || element.getBoundingClientRect();
    const model = readBoxModel(rect, computed);

    place(this.marginDiv, marginRect(model));
    setBorderWidths(this.marginDiv, model.margin);

    place(this.borderDiv, model.border);
    setBorderWidths(this.borderDiv, model.borderWidth);

    const padding = paddingRect(model);
    place(this.paddingDiv, padding);
    setBorderWidths(this.paddingDiv, model.padding);

    place(this.contentDiv, contentRect(model));

    place(this.edgeDiv, model.border);
    this.edgeDiv.style.borderRadius = radiiToCss(
      overlayRadii({
        radii: readCornerRadii(computed),
        borderRect: model.border,
        clips: clipsAtRadius(element.tagName, computed),
        childRects: childRectsOf(element)
      })
    );

    this.renderNumbers(model);
    this.renderChip(element, computed, rect, model);

    this.root.style.display = 'block';
  }

  private renderNumbers(model: BoxModel): void {
    const wanted: Array<{ text: string; x: number; y: number }> = [];
    const border = model.border;
    const outer = marginRect(model);
    const padding = paddingRect(model);

    SIDES.forEach((side) => {
      const value = model.margin[side];
      if (value >= MIN_LABELLED_BAND) {
        wanted.push(bandLabel(String(value), outer, border, side));
      }
    });

    SIDES.forEach((side) => {
      const value = model.padding[side];
      if (value >= MIN_LABELLED_BAND) {
        wanted.push(bandLabel(String(value), padding, contentRect(model), side));
      }
    });

    while (this.numbers.length < wanted.length) {
      const span = document.createElement('div');
      span.style.position = 'absolute';
      span.style.top = '0';
      span.style.left = '0';
      span.style.transformOrigin = '0 0';
      span.style.padding = '0 3px';
      span.style.borderRadius = '2px';
      span.style.backgroundColor = OVERLAY_COLORS.numberBackground;
      span.style.color = OVERLAY_COLORS.numberForeground;
      span.style.font = "500 10px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      span.style.whiteSpace = 'nowrap';
      this.root.appendChild(span);
      this.numbers.push(span);
    }

    for (let i = 0; i < this.numbers.length; i++) {
      const span = this.numbers[i];
      if (i < wanted.length) {
        span.textContent = wanted[i].text;
        span.style.display = 'block';
        // Centring needs the rendered size, and the text has just changed — so the translate is
        // applied after the write, in the same frame but from a fresh measurement.
        const size = span.getBoundingClientRect();
        span.style.transform =
          'translateX(' + (wanted[i].x - size.width / 2) + 'px) translateY(' + (wanted[i].y - size.height / 2) + 'px)';
      } else {
        span.style.display = 'none';
      }
    }
  }

  private renderChip(element: HTMLElement, computed: CSSStyleDeclaration, rect: RectLike, model: BoxModel): void {
    const parentElement = element.parentElement;
    const facts = describeBox({
      rect,
      computed,
      specified: element.style,
      parent: parentElement
        ? { rect: parentElement.getBoundingClientRect(), computed: window.getComputedStyle(parentElement) }
        : undefined
    });

    const spacing = describeSpacing(model);
    if (spacing) {
      facts.push(spacing);
    }

    // `textContent` per line rather than one `innerHTML`: the facts carry values an author typed
    // (a `cssClassName`, a `calc()` they wrote), and a chip that parsed them as markup would be a
    // way to run their string as HTML inside the preview.
    while (this.chip.firstChild) {
      this.chip.removeChild(this.chip.firstChild);
    }
    for (let i = 0; i < facts.length; i++) {
      const line = document.createElement('div');
      line.textContent = facts[i];
      if (i > 0) {
        line.style.color = OVERLAY_COLORS.chipSecondary;
      }
      this.chip.appendChild(line);
    }

    const spot = chipPosition(marginRect(model), this.chip.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight
    });
    moveTo(this.chip, spot.x, spot.y);
  }
}

/** The centre of one band, between an outer rect and the rect it encloses. */
export function bandLabel(
  text: string,
  outer: RectLike,
  inner: RectLike,
  side: keyof Edges
): { text: string; x: number; y: number } {
  switch (side) {
    case 'top':
      return { text, x: inner.x + inner.width / 2, y: (outer.y + inner.y) / 2 };
    case 'bottom':
      return { text, x: inner.x + inner.width / 2, y: (inner.y + inner.height + outer.y + outer.height) / 2 };
    case 'left':
      return { text, x: (outer.x + inner.x) / 2, y: inner.y + inner.height / 2 };
    default:
      return { text, x: (inner.x + inner.width + outer.x + outer.width) / 2, y: inner.y + inner.height / 2 };
  }
}

/**
 * Where the fact chip goes — **beside the element first**, and that order is a finding, not a taste.
 *
 * 🔴 The first drive put it above-or-below, and the screenshot showed it covering the two siblings
 * underneath the hovered element. That is precisely the wrong thing to cover: *"why has this gone
 * under another group"* is one of the three questions the chip exists to answer, and the chip was
 * hiding the other group while answering it. Beside is the only placement that leaves the stacking
 * visible.
 */
export function chipPosition(
  subject: RectLike,
  chip: { width: number; height: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const gap = 8;
  // ⚠️ Both axes are clamped on **every** branch, not only the fallback. An element scrolled
  // partly off the left edge has a right-hand side that is still inside the viewport by the
  // arithmetic and outside it on screen, and a chip placed there is invisible while the code
  // reads as if it had chosen the roomy option.
  const clampX = (x: number) => Math.max(gap, Math.min(x, viewport.width - chip.width - gap));
  const clampY = (y: number) => Math.max(gap, Math.min(y, viewport.height - chip.height - gap));

  const right = subject.x + subject.width + gap;
  if (right >= gap && right + chip.width <= viewport.width - gap) {
    return { x: clampX(right), y: clampY(subject.y) };
  }

  const left = subject.x - chip.width - gap;
  if (left >= gap && left + chip.width <= viewport.width - gap) {
    return { x: clampX(left), y: clampY(subject.y) };
  }

  const above = subject.y - chip.height - gap;
  const y = above >= gap ? above : subject.y + subject.height + gap;
  return { x: clampX(subject.x), y: clampY(y) };
}

function childRectsOf(element: HTMLElement): RectLike[] {
  const rects: RectLike[] = [];
  const children = element.children;
  const count = Math.min(children.length, MAX_CHILDREN_SAMPLED);
  for (let i = 0; i < count; i++) {
    rects.push(children[i].getBoundingClientRect());
  }
  return rects;
}
