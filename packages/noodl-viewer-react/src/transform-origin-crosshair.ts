/**
 * FB-016 scope 4 — the transform-origin crosshair.
 *
 * > *"Photoshop has had this forever."* — Jordan, session 2, §6.
 *
 * While the transform-origin field has focus in the editor's properties panel, this draws the
 * resolved origin point on the running app: two arms, a ring, and a label that says both what the
 * author typed and where it landed.
 *
 * 🔴 **The ambiguity the crosshair exists to remove is what a percentage is a percentage *of*.**
 * `transform-origin: 50%` resolves against the element's own border box, not the parent's and not
 * the viewport's, and half of the confusion in the report was not knowing which. The crosshair
 * answers that by existing: the point is drawn where it actually is, so there is nothing left to
 * infer. The label then names both halves, because they answer different questions — `50%` is the
 * thing the author can change, `180px` is the thing that happened.
 *
 * The split is the same as `box-model-overlay.ts`: a pure half that can be graded without a layout
 * engine, and a DOM half that only places divs.
 */
import { OVERLAY_COLORS, chipPosition, type ComputedReader, type RectLike } from './box-model-overlay';

/** The 2D part of a CSS transform, in the order `matrix(a, b, c, d, e, f)` writes it. */
export interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export interface Point {
  x: number;
  y: number;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Reading the origin
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** `left`/`center`/`right` and `top`/`center`/`bottom` are just percentages with names. */
const KEYWORDS: Record<string, number> = {
  left: 0,
  top: 0,
  center: 50,
  right: 100,
  bottom: 100
};

const HORIZONTAL_ONLY = ['left', 'right'];
const VERTICAL_ONLY = ['top', 'bottom'];

function isOneOf(token: string, list: string[]): boolean {
  return list.indexOf(token) !== -1;
}

/**
 * One axis of a `transform-origin`, in pixels from that edge of the border box.
 *
 * `extent` is the element's **layout** size (`offsetWidth`/`offsetHeight`), never the rect a
 * transformed element reports — see `resolveOriginPoint` for why those are different.
 */
export function resolveOriginAxis(value: string, extent: number): number | null {
  const token = (value || '').trim().toLowerCase();
  if (!token) return null;

  if (Object.prototype.hasOwnProperty.call(KEYWORDS, token)) {
    return (KEYWORDS[token] / 100) * extent;
  }

  const parsed = parseFloat(token);
  if (!isFinite(parsed)) return null;

  if (token.indexOf('%') !== -1) {
    return (parsed / 100) * extent;
  }
  return parsed;
}

/**
 * Split a `transform-origin` declaration into its horizontal and vertical halves.
 *
 * ⚠️ **Two keywords may arrive in either order** — CSS accepts `top left` exactly as it accepts
 * `left top` — so the pair is put back in x, y order here rather than trusted as written. A third
 * component is the z offset, which a crosshair on a 2D surface has nothing to say about.
 */
export function splitOrigin(value: string): { x: string; y: string } | null {
  const tokens = (value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  if (tokens.length === 1) {
    // A single vertical keyword means the horizontal half is `center`; anything else sets x.
    if (isOneOf(tokens[0], VERTICAL_ONLY)) return { x: 'center', y: tokens[0] };
    return { x: tokens[0], y: 'center' };
  }

  const first = tokens[0];
  const second = tokens[1];
  if (isOneOf(first, VERTICAL_ONLY) || isOneOf(second, HORIZONTAL_ONLY)) {
    return { x: second, y: first };
  }
  return { x: first, y: second };
}

/** CSS's own default, and the value an element with nothing set behaves as. */
export const DEFAULT_ORIGIN = '50% 50%';

export interface OriginInput {
  /** `getBoundingClientRect()` — the **transformed** box, in viewport coordinates. */
  rect: RectLike;
  /** `offsetWidth`/`offsetHeight` — the untransformed border box, in layout pixels. */
  layout: { width: number; height: number };
  /** `getComputedStyle(element)`. */
  computed: ComputedReader;
  /** `element.style` — where a percentage the author typed still says `%`. */
  specified: ComputedReader;
}

/**
 * The declaration to resolve, and whether the author ever wrote one.
 *
 * 🔴 **The specified value is read first, and that is the same finding as `describeSize`'s.**
 * A rendered element's *computed* `transform-origin` is a used pixel pair: `50%` and `180px` on a
 * 360-wide element are the identical string by the time it is asked for, and which one the author
 * wrote is the entire question. The specified declaration is where `%` survives — the viewer
 * writes it inline in `updateTransformOrigin` — so it is what the label names and what the point
 * is resolved from.
 */
export function readOriginDeclaration(input: OriginInput): { value: string; isDefault: boolean } {
  const inline = (input.specified.getPropertyValue('transform-origin') || '').trim();
  if (inline) return { value: inline, isDefault: false };

  const computed = (input.computed.getPropertyValue('transform-origin') || '').trim();
  if (computed) {
    // 🔴 **The drive's finding.** On an element whose origin has never been touched, the computed
    // value is a resolved pixel pair — `180px 30px` on the 360×60 fixture — and the first build
    // printed it. An author who has set nothing then reads two numbers they never typed, in units
    // they never chose, with nothing saying this is simply the centre. It is the used value
    // wearing the specified value's clothes, and it is the same trap `describeSize` documents.
    //
    // There is no provenance to read here — `getComputedStyle` cannot say whether a declaration
    // came from a stylesheet or from CSS's own initial value — so the question is settled **by
    // value** instead: an origin that resolves to the centre of the box behaves exactly as the
    // default does, whoever wrote it. An author who set it to the centre by hand sees it called
    // the default and is not misled by that, because it is what the default would have done.
    const centre = originOf(computed, input);
    if (centre && isCentreOf(centre, input.layout)) {
      return { value: DEFAULT_ORIGIN, isDefault: true };
    }
    return { value: computed, isDefault: false };
  }

  return { value: DEFAULT_ORIGIN, isDefault: true };
}

/** Resolve a declaration against the layout box, without going back through the declaration reader. */
function originOf(declaration: string, input: OriginInput): Point | null {
  const halves = splitOrigin(declaration);
  if (!halves) return null;
  const x = resolveOriginAxis(halves.x, input.layout.width);
  const y = resolveOriginAxis(halves.y, input.layout.height);
  return x === null || y === null ? null : { x, y };
}

/** Half a pixel: below what anyone can see, above what sub-pixel layout leaves behind. */
const CENTRE_TOLERANCE = 0.5;

function isCentreOf(point: Point, layout: { width: number; height: number }): boolean {
  return (
    Math.abs(point.x - layout.width / 2) <= CENTRE_TOLERANCE &&
    Math.abs(point.y - layout.height / 2) <= CENTRE_TOLERANCE
  );
}

/** The origin in the element's own coordinates: pixels right and down from its border-box corner. */
export function originInElement(input: OriginInput): Point | null {
  const halves = splitOrigin(readOriginDeclaration(input).value);
  if (!halves) return null;

  const x = resolveOriginAxis(halves.x, input.layout.width);
  const y = resolveOriginAxis(halves.y, input.layout.height);
  if (x === null || y === null) return null;

  return { x, y };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Placing it on screen
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The 2D part of a computed `transform`.
 *
 * Parsed by hand rather than through `DOMMatrix` so the geometry can be graded in a test
 * environment that has no layout engine — the same reason `ComputedReader` is an interface and
 * not a `CSSStyleDeclaration`.
 *
 * ⚠️ **`matrix3d` is projected, not honoured.** Its first two columns are taken and the
 * perspective row is dropped, which is exact for a 3D transform that happens to be flat and an
 * approximation for one that is not. A crosshair drawn on a rotated-in-Z element is a harder
 * question than this scope asked, and a wrong-by-perspective point is better than none.
 */
export function parseTransformMatrix(value: string): Matrix2D {
  const text = (value || '').trim();
  if (!text || text === 'none') return IDENTITY;

  const open = text.indexOf('(');
  if (open === -1 || text.charAt(text.length - 1) !== ')') return IDENTITY;

  const name = text.substring(0, open).trim();
  const parts = text
    .substring(open + 1, text.length - 1)
    .split(',')
    .map((part) => parseFloat(part));

  if (parts.some((n) => !isFinite(n))) return IDENTITY;

  if (name === 'matrix' && parts.length >= 6) {
    return { a: parts[0], b: parts[1], c: parts[2], d: parts[3], e: parts[4], f: parts[5] };
  }
  if (name === 'matrix3d' && parts.length >= 16) {
    return { a: parts[0], b: parts[1], c: parts[4], d: parts[5], e: parts[12], f: parts[13] };
  }
  return IDENTITY;
}

function applyMatrix(m: Matrix2D, p: Point): Point {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f
  };
}

/**
 * Where the origin lands in viewport coordinates.
 *
 * 🔴 **`getBoundingClientRect()` is not the border box the percentage resolves against, and on
 * exactly the elements this feature is for it is not even close.** An element with a transform —
 * which is the only kind whose origin matters — reports the axis-aligned bounding box of its
 * *transformed* self, so a 100×100 square rotated 45° reports 141×141 and a `50% 50%` resolved
 * against that rect misses the true centre. The layout size is taken from `offsetWidth` instead,
 * the transformed corners are worked out here, and the rect is used only to say where that
 * bounding box ended up.
 *
 * ✅ **A uniform page zoom falls out of the arithmetic for free.** The editor sets
 * `document.body.style.zoom` on the preview, which scales the rect but not `offsetWidth`; the
 * ratio between the computed bounding box and the reported one recovers that factor without
 * anyone having to know it. The one thing it cannot recover is a non-uniform scale, which
 * `body.zoom` never is.
 */
export function resolveOriginPoint(input: OriginInput): Point | null {
  const local = originInElement(input);
  if (!local) return null;

  const matrix = parseTransformMatrix(input.computed.getPropertyValue('transform'));
  const width = input.layout.width;
  const height = input.layout.height;

  // The transform is applied about the origin, so the corners move around a point that does not.
  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ].map((corner) => {
    const moved = applyMatrix(matrix, { x: corner.x - local.x, y: corner.y - local.y });
    return { x: moved.x + local.x, y: moved.y + local.y };
  });

  let minX = corners[0].x;
  let minY = corners[0].y;
  let maxX = corners[0].x;
  let maxY = corners[0].y;
  for (let i = 1; i < corners.length; i++) {
    minX = Math.min(minX, corners[i].x);
    minY = Math.min(minY, corners[i].y);
    maxX = Math.max(maxX, corners[i].x);
    maxY = Math.max(maxY, corners[i].y);
  }

  const localWidth = maxX - minX;
  const localHeight = maxY - minY;
  // Degenerate boxes (a zero-height element, a collapsed row) have no ratio to recover; 1 is the
  // only honest guess and it is right whenever the page is not zoomed.
  const scaleX = localWidth > 0 ? input.rect.width / localWidth : 1;
  const scaleY = localHeight > 0 ? input.rect.height / localHeight : 1;

  return {
    x: input.rect.x + (local.x - minX) * scaleX,
    y: input.rect.y + (local.y - minY) * scaleY
  };
}

/**
 * The two arms, as rects.
 *
 * They span the element *and* the point, because `transform-origin` is not confined to the
 * element — `150%` and `-20px` are legal and are precisely the values whose effect is hardest to
 * picture. An arm that stopped at the element's edge would stop short of the thing it is pointing
 * at in exactly those cases.
 */
export function crosshairArms(
  rect: RectLike,
  point: Point,
  overhang: number
): { horizontal: RectLike; vertical: RectLike } {
  const left = Math.min(rect.x, point.x) - overhang;
  const right = Math.max(rect.x + rect.width, point.x) + overhang;
  const top = Math.min(rect.y, point.y) - overhang;
  const bottom = Math.max(rect.y + rect.height, point.y) + overhang;

  return {
    horizontal: { x: left, y: point.y, width: right - left, height: 0 },
    vertical: { x: point.x, y: top, width: 0, height: bottom - top }
  };
}

/**
 * Move a label clear of something already on screen.
 *
 * 🔴 **The second thing a screenshot found and no spec would have.** The crosshair's label and the
 * box model's fact chip both want to sit beside the same element, and the first build let them:
 * the label landed squarely on the chip and hid `width`, `height` and half the alignment sentence
 * behind it. Two overlays explaining one element, each making the other unreadable.
 *
 * The label yields, because it is the transient one — it is on screen only while a field has focus,
 * and the chip was there first. Below the obstacle is tried before above, so the label stays near
 * the point it names rather than jumping over the element.
 */
export function nudgeClear(
  spot: Point,
  size: { width: number; height: number },
  obstacle: RectLike | null,
  viewport: { width: number; height: number }
): Point {
  if (!obstacle) return spot;

  const gap = 8;
  const overlaps = (y: number) =>
    spot.x < obstacle.x + obstacle.width &&
    spot.x + size.width > obstacle.x &&
    y < obstacle.y + obstacle.height &&
    y + size.height > obstacle.y;

  if (!overlaps(spot.y)) return spot;

  const clampY = (y: number) => Math.max(gap, Math.min(y, viewport.height - size.height - gap));

  const below = obstacle.y + obstacle.height + gap;
  if (below + size.height <= viewport.height - gap) return { x: spot.x, y: clampY(below) };

  const above = obstacle.y - size.height - gap;
  if (above >= gap) return { x: spot.x, y: clampY(above) };

  // Nowhere vertical works, so move it sideways instead — off the obstacle's left edge.
  const left = obstacle.x - size.width - gap;
  if (left >= gap) return { x: left, y: clampY(spot.y) };

  return { x: spot.x, y: clampY(spot.y) };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Whether the declaration is already the two pixel numbers the second line would print. */
function statesThePixels(declaration: string, local: Point): boolean {
  const halves = splitOrigin(declaration);
  if (!halves) return false;
  if (halves.x.indexOf('px') === -1 || halves.y.indexOf('px') === -1) return false;
  return Math.abs(parseFloat(halves.x) - local.x) < 0.05 && Math.abs(parseFloat(halves.y) - local.y) < 0.05;
}

/**
 * What the label says: the declaration, then where it landed.
 *
 * Both lines are needed and they are not the same fact. The first is the author's own words and
 * the thing they can edit; the second is the answer to *"a percentage of what?"*, stated in the
 * element's own pixels so there is no second ambiguity about which box it counted from.
 */
export function describeOrigin(input: OriginInput): string[] {
  const declaration = readOriginDeclaration(input);
  const local = originInElement(input);
  if (!local) return [];

  const lines = ['transform-origin: ' + declaration.value + (declaration.isDefault ? ' (default)' : '')];

  // ⚠️ **The second line earns its place only when the first one is not already the answer.**
  // The drive showed the label saying `180px 30px` and then `180px, 30px from the element's top
  // left` — two lines, one fact, and the redundancy is worst in exactly the case where the author
  // has the least idea what is going on. A percentage or a keyword needs resolving; a pixel pair
  // is already resolved.
  if (!statesThePixels(declaration.value, local)) {
    lines.push(round(local.x) + 'px, ' + round(local.y) + 'px from the element’s top left');
  }

  const width = input.layout.width;
  const height = input.layout.height;
  if (local.x < 0 || local.y < 0 || local.x > width || local.y > height) {
    lines.push('outside the element — it rotates and scales about a point beyond its own edge');
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// The DOM half
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** How far the arms run past the element (or the point), so the crossing never sits on an edge. */
const OVERHANG = 16;

/** Diameter of the ring at the point. Odd, so it centres on a whole pixel. */
const RING = 11;

/**
 * Every stroke is the same near-black core inside a near-white halo that `box-model-overlay`
 * grades: a single colour cannot hold 3:1 against both black and white content, and this one is
 * drawn over a document whose colours nobody controls. The pair is why the claim is provable.
 */
function strokeShadow(): string {
  return '0 0 0 1px ' + OVERLAY_COLORS.edgeLight;
}

export class TransformOriginCrosshair {
  root: HTMLDivElement;
  private horizontal: HTMLDivElement;
  private vertical: HTMLDivElement;
  private ring: HTMLDivElement;
  private label: HTMLDivElement;

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.setAttribute('data-noodl-transform-origin', '');
    // AC3 again: nothing this feature adds may become a hit-test target, or the inspect
    // click-through the Inspector depends on starts landing on editor chrome instead.
    root.style.pointerEvents = 'none';
    root.style.display = 'none';
    parent.appendChild(root);
    this.root = root;

    this.horizontal = this.createArm();
    this.vertical = this.createArm();

    this.ring = document.createElement('div');
    this.ring.style.position = 'absolute';
    this.ring.style.top = '0';
    this.ring.style.left = '0';
    this.ring.style.boxSizing = 'border-box';
    this.ring.style.width = RING + 'px';
    this.ring.style.height = RING + 'px';
    this.ring.style.borderRadius = '50%';
    this.ring.style.border = '1px solid ' + OVERLAY_COLORS.edgeDark;
    this.ring.style.boxShadow = strokeShadow() + ', inset 0 0 0 1px ' + OVERLAY_COLORS.edgeLight;

    this.label = document.createElement('div');
    this.label.setAttribute('data-noodl-transform-origin-label', '');
    this.label.style.position = 'absolute';
    this.label.style.top = '0';
    this.label.style.left = '0';
    this.label.style.padding = '6px 8px';
    this.label.style.borderRadius = '4px';
    this.label.style.backgroundColor = OVERLAY_COLORS.chipBackground;
    this.label.style.color = OVERLAY_COLORS.chipForeground;
    this.label.style.font = '500 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    this.label.style.whiteSpace = 'nowrap';
    this.label.style.boxShadow = '0 0 0 1px ' + OVERLAY_COLORS.edgeLight + ', 0 2px 8px rgba(0,0,0,0.45)';

    root.appendChild(this.horizontal);
    root.appendChild(this.vertical);
    root.appendChild(this.ring);
    root.appendChild(this.label);
  }

  private createArm(): HTMLDivElement {
    const arm = document.createElement('div');
    arm.style.position = 'absolute';
    arm.style.top = '0';
    arm.style.left = '0';
    arm.style.backgroundColor = OVERLAY_COLORS.edgeDark;
    arm.style.boxShadow = strokeShadow();
    return arm;
  }

  clear(): void {
    this.root.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }

  /**
   * @param readStyle the caller's own `getComputedStyle`, when it has one. The highlighter reads
   * the style every frame anyway, and a second read is a second forced style recalculation.
   */
  update(
    element: HTMLElement | null,
    readStyle?: CSSStyleDeclaration,
    readRect?: RectLike,
    obstacle?: RectLike | null
  ): void {
    if (!element || !element.isConnected) {
      this.clear();
      return;
    }

    const computed = readStyle || window.getComputedStyle(element);
    const rect = readRect || element.getBoundingClientRect();
    const input: OriginInput = {
      rect,
      layout: { width: element.offsetWidth, height: element.offsetHeight },
      computed,
      specified: element.style
    };

    const point = resolveOriginPoint(input);
    if (!point) {
      this.clear();
      return;
    }

    const arms = crosshairArms(rect, point, OVERHANG);

    this.horizontal.style.transform = 'translateX(' + arms.horizontal.x + 'px) translateY(' + point.y + 'px)';
    this.horizontal.style.width = arms.horizontal.width + 'px';
    this.horizontal.style.height = '1px';

    this.vertical.style.transform = 'translateX(' + point.x + 'px) translateY(' + arms.vertical.y + 'px)';
    this.vertical.style.width = '1px';
    this.vertical.style.height = arms.vertical.height + 'px';

    const half = (RING - 1) / 2;
    this.ring.style.transform = 'translateX(' + (point.x - half) + 'px) translateY(' + (point.y - half) + 'px)';

    this.renderLabel(input, point, obstacle || null);

    this.root.style.display = 'block';
  }

  private renderLabel(input: OriginInput, point: Point, obstacle: RectLike | null): void {
    const lines = describeOrigin(input);

    while (this.label.childNodes.length > lines.length) {
      this.label.removeChild(this.label.lastChild);
    }
    while (this.label.childNodes.length < lines.length) {
      const line = document.createElement('div');
      this.label.appendChild(line);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = this.label.childNodes[i] as HTMLDivElement;
      line.textContent = lines[i];
      // The declaration leads; what it resolved to is support, in the chip's quieter ink.
      line.style.color = i === 0 ? OVERLAY_COLORS.chipForeground : OVERLAY_COLORS.chipSecondary;
    }

    // The point is the subject, not the element: a zero-size rect at the crossing puts the label
    // beside the thing it names, and inherits `chipPosition`'s clamping on both axes — which the
    // first drive of the fact chip proved is the half that is easy to get wrong.
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const size = this.label.getBoundingClientRect();
    const spot = chipPosition({ x: point.x, y: point.y, width: 0, height: 0 }, size, viewport);
    const clear = nudgeClear(spot, size, obstacle, viewport);
    this.label.style.transform = 'translateX(' + clear.x + 'px) translateY(' + clear.y + 'px)';
  }
}
