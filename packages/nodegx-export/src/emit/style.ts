/**
 * Style extraction — the per-node content-vs-style parameter split and the parameter → CSS
 * mapping (EXP-002 step 4, semantics settled in EXP-002-TARGET-OUTPUT.md §1):
 *
 * - A node's parameters split into two piles: content/behaviour (text, src, alt, label, …) go to
 *   JSX; layout and style go to one CSS-module class per visual node. The split is an explicit
 *   table per visual type, never a guess.
 * - Runtime style semantics become their CSS equivalents by table: `clip: true` →
 *   `overflow: hidden`; `sizeMode` gates whether width/height are emitted; the `boxShadow*`
 *   params fold into one `box-shadow` (missing pieces fall back to the catalog's port defaults,
 *   because the interpreter falls back to the same); per-corner radii fold when uniform;
 *   padding/margin use shorthands when the sides agree.
 * - Token references (`var(--space-5)`) pass through verbatim; literals pass through literally;
 *   `{value, unit}` dimensions join into CSS lengths (`0` stays unitless).
 * - `Text` renders with `margin: 0`; flex containers state `display: flex` and their
 *   `flex-direction` explicitly rather than relying on a global reset.
 *
 * Parameters that are neither content nor style (variant, cssClassName, mounted, …) are returned
 * as `unhandled` — analysis reports them; nothing is silently dropped.
 */

import { CatalogIndex } from '../catalog';
import { NodeIR, ParamValue } from '../ir/types';

/** How a rendered node behaves for style purposes. */
export type StyleRole = 'group' | 'text' | 'image' | 'button' | 'input' | 'page';

export interface Decl {
  prop: string;
  value: string;
}

export interface NodeStyle {
  /** Ordered, ready to print. */
  decls: Decl[];
  /** Parameter names the style tables know nothing about — report, never guess. */
  unhandled: string[];
}

/**
 * The content/behaviour half of the split: parameters that bind into JSX rather than CSS,
 * per visual type. `children` renders as the element's text child; `attr:<name>` as a JSX
 * attribute; `head` as a hoisted document tag; `routing` is consumed by the route table.
 */
export const CONTENT_PARAMS: Record<string, Record<string, string>> = {
  Text: { text: 'children' },
  Label: { text: 'children' },
  Image: { src: 'attr:src', srcSet: 'attr:srcSet', alt: 'attr:alt' },
  'net.noodl.controls.button': { label: 'children' },
  Button: { label: 'children' },
  'net.noodl.controls.textinput': {
    placeholder: 'attr:placeholder',
    startValue: 'attr:defaultValue',
    type: 'attr:type',
    maxLength: 'attr:maxLength'
  },
  'Text Input': {
    placeholder: 'attr:placeholder',
    startValue: 'attr:defaultValue',
    type: 'attr:type',
    maxLength: 'attr:maxLength'
  },
  Page: { title: 'head', description: 'head', urlPath: 'routing' },
  'For Each': { template: 'template', items: 'items', inputMappingScript: 'mapping' }
};

/** JSX attribute order per element, so generated attribute lists are stable and readable. */
export const CONTENT_ATTR_ORDER: string[] = ['src', 'srcSet', 'alt', 'type', 'placeholder', 'defaultValue', 'maxLength'];

/**
 * Style parameters that map 1:1 to a CSS property (camelCase → kebab-case). Everything with
 * fold/gate semantics (width/height, borders, radii, shadows, padding/margin) is handled by the
 * dedicated rules below and deliberately absent here.
 */
const PASSTHROUGH = new Set([
  'alignContent',
  'alignItems',
  'backgroundColor',
  'color',
  'columnGap',
  'flexWrap',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'justifyContent',
  'letterSpacing',
  'lineHeight',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'objectFit',
  'opacity',
  'position',
  'rowGap',
  'textTransform',
  'wordBreak',
  'zIndex'
]);

/**
 * Style-semantic switches consumed by the rules below rather than emitted as properties.
 * `flexDirection` is consumed by the flex base; the `boxShadow*` family folds into `box-shadow`.
 */
const CONSUMED = new Set([
  'sizeMode',
  'clip',
  'flexDirection',
  'boxShadowEnabled',
  'boxShadowInset',
  'boxShadowOffsetX',
  'boxShadowOffsetY',
  'boxShadowBlurRadius',
  'boxShadowSpreadRadius',
  'boxShadowColor'
]);

const BORDER_SIDES: Array<{ param: string; css: string }> = [
  { param: '', css: 'border' },
  { param: 'Top', css: 'border-top' },
  { param: 'Right', css: 'border-right' },
  { param: 'Bottom', css: 'border-bottom' },
  { param: 'Left', css: 'border-left' }
];

const RADIUS_CORNERS: Array<{ param: string; css: string }> = [
  { param: 'borderTopLeftRadius', css: 'border-top-left-radius' },
  { param: 'borderTopRightRadius', css: 'border-top-right-radius' },
  { param: 'borderBottomRightRadius', css: 'border-bottom-right-radius' },
  { param: 'borderBottomLeftRadius', css: 'border-bottom-left-radius' }
];

/**
 * Canonical property order for a generated class, derived from the hand-written target output:
 * resets, then layout, box, visual chrome, spacing, typography. Unknown properties sort last,
 * alphabetically.
 */
const PROPERTY_ORDER = [
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'display',
  'flex-direction',
  'flex-wrap',
  'align-items',
  'align-content',
  'justify-content',
  'position',
  'z-index',
  'width',
  'height',
  'max-width',
  'max-height',
  'min-width',
  'min-height',
  'object-fit',
  'background-color',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-top',
  'border-top-width',
  'border-top-style',
  'border-top-color',
  'border-right',
  'border-right-width',
  'border-right-style',
  'border-right-color',
  'border-bottom',
  'border-bottom-width',
  'border-bottom-style',
  'border-bottom-color',
  'border-left',
  'border-left-width',
  'border-left-style',
  'border-left-color',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'box-shadow',
  'overflow',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'row-gap',
  'column-gap',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-align',
  'color',
  'opacity'
];

const ORDER_INDEX = new Map(PROPERTY_ORDER.map((prop, i) => [prop, i]));

export function computeNodeStyle(node: NodeIR, role: StyleRole, catalog: CatalogIndex): NodeStyle {
  const params = new Map(node.parameters.map((p) => [p.name, p.value]));
  const content = CONTENT_PARAMS[node.type] ?? {};
  const decls: Decl[] = [];
  const unhandled: string[] = [];
  const consumed = new Set<string>();

  const literal = (name: string): string | number | boolean | undefined => {
    const v = params.get(name);
    return v?.kind === 'literal' ? v.value : undefined;
  };
  const cssParam = (name: string): string | undefined => {
    const v = params.get(name);
    return v === undefined ? undefined : cssValue(v);
  };
  const catalogDefault = (name: string): unknown =>
    node.catalogRef ? catalog.inputDefault(node.catalogRef, name) : undefined;

  // Resets and flex bases: the interpreted runtime's Text has no margins and its containers are
  // flex columns, so the class states both explicitly (TARGET-OUTPUT §1) instead of leaning on a
  // global reset.
  if (role === 'text') decls.push({ prop: 'margin', value: '0' });
  if (role === 'group' || role === 'page') {
    decls.push({ prop: 'display', value: 'flex' });
    const direction = literal('flexDirection') ?? catalogDefault('flexDirection') ?? 'column';
    decls.push({ prop: 'flex-direction', value: String(direction) });
  }

  // sizeMode gates width/height: 'explicit' emits both, 'contentHeight' only width,
  // 'contentWidth' only height, 'contentSize' neither. The default is the catalog's.
  const sizeMode = String(literal('sizeMode') ?? catalogDefault('sizeMode') ?? 'explicit');
  if ((sizeMode === 'explicit' || sizeMode === 'contentHeight') && params.has('width')) {
    decls.push({ prop: 'width', value: cssParam('width')! });
  }
  if ((sizeMode === 'explicit' || sizeMode === 'contentWidth') && params.has('height')) {
    decls.push({ prop: 'height', value: cssParam('height')! });
  }
  consumed.add('width');
  consumed.add('height');

  // Borders fold to `border[-side]: width style color` when all three pieces are present.
  for (const side of BORDER_SIDES) {
    const width = cssParam(`border${side.param}Width`);
    const style = cssParam(`border${side.param}Style`);
    const color = cssParam(`border${side.param}Color`);
    if (width !== undefined && style !== undefined && color !== undefined) {
      decls.push({ prop: side.css, value: `${width} ${style} ${color}` });
    } else {
      if (width !== undefined) decls.push({ prop: `${side.css}-width`, value: width });
      if (style !== undefined) decls.push({ prop: `${side.css}-style`, value: style });
      if (color !== undefined) decls.push({ prop: `${side.css}-color`, value: color });
    }
    consumed.add(`border${side.param}Width`);
    consumed.add(`border${side.param}Style`);
    consumed.add(`border${side.param}Color`);
  }

  // Radii: a uniform borderRadius passes through; per-corner params fold back to border-radius
  // only when all four agree, and stay per-corner otherwise (.card vs .photo in the target).
  const uniformRadius = cssParam('borderRadius');
  const corners = RADIUS_CORNERS.map((c) => ({ css: c.css, value: cssParam(c.param) }));
  const presentCorners = corners.filter((c) => c.value !== undefined);
  if (uniformRadius !== undefined) {
    decls.push({ prop: 'border-radius', value: uniformRadius });
  }
  if (presentCorners.length === 4 && uniformRadius === undefined && corners.every((c) => c.value === corners[0].value)) {
    decls.push({ prop: 'border-radius', value: corners[0].value! });
  } else {
    for (const corner of presentCorners) decls.push({ prop: corner.css, value: corner.value! });
  }
  consumed.add('borderRadius');
  for (const c of RADIUS_CORNERS) consumed.add(c.param);

  // The four boxShadow* params fold into one box-shadow when enabled; absent pieces take the
  // catalog's port defaults because the interpreter falls back to exactly those.
  if (literal('boxShadowEnabled') === true) {
    const piece = (name: string) => {
      const authored = params.get(name);
      return authored !== undefined ? shadowLength(cssValue(authored)) : shadowLength(catalogDefault(name));
    };
    const color = cssParam('boxShadowColor') ?? String(catalogDefault('boxShadowColor') ?? 'currentcolor');
    const inset = literal('boxShadowInset') === true ? 'inset ' : '';
    decls.push({
      prop: 'box-shadow',
      value: `${inset}${piece('boxShadowOffsetX')} ${piece('boxShadowOffsetY')} ${piece(
        'boxShadowBlurRadius'
      )} ${piece('boxShadowSpreadRadius')} ${color}`
    });
  }

  if (literal('clip') === true) decls.push({ prop: 'overflow', value: 'hidden' });

  boxShorthand('padding', params, decls);
  boxShorthand('margin', params, decls);
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    consumed.add(`padding${side}`);
    consumed.add(`margin${side}`);
  }

  const textAlign = cssParam('textAlignX');
  if (textAlign !== undefined) decls.push({ prop: 'text-align', value: textAlign });
  consumed.add('textAlignX');

  for (const { name } of node.parameters) {
    if (consumed.has(name) || CONSUMED.has(name)) continue;
    if (content[name] !== undefined) continue;
    if (PASSTHROUGH.has(name)) {
      decls.push({ prop: kebabCase(name), value: cssParam(name)! });
    } else {
      unhandled.push(name);
    }
  }

  return { decls: orderDecls(decls), unhandled };
}

/**
 * padding/margin collapse to shorthands when the sides agree: one value when all four match,
 * `vertical horizontal` when the pairs match, four values when all four are present, and
 * individual properties otherwise.
 */
function boxShorthand(base: 'padding' | 'margin', params: Map<string, ParamValue>, decls: Decl[]): void {
  const side = (name: string) => {
    const v = params.get(`${base}${name}`);
    return v === undefined ? undefined : cssValue(v);
  };
  const top = side('Top');
  const right = side('Right');
  const bottom = side('Bottom');
  const left = side('Left');
  if (top !== undefined && right !== undefined && bottom !== undefined && left !== undefined) {
    if (top === bottom && right === left) {
      decls.push({ prop: base, value: top === right ? top : `${top} ${right}` });
    } else {
      decls.push({ prop: base, value: `${top} ${right} ${bottom} ${left}` });
    }
    return;
  }
  if (top !== undefined) decls.push({ prop: `${base}-top`, value: top });
  if (right !== undefined) decls.push({ prop: `${base}-right`, value: right });
  if (bottom !== undefined) decls.push({ prop: `${base}-bottom`, value: bottom });
  if (left !== undefined) decls.push({ prop: `${base}-left`, value: left });
}

/** Tokens and literals pass through verbatim; dimensions join value and unit; zero drops its unit. */
export function cssValue(value: ParamValue): string {
  switch (value.kind) {
    case 'literal':
      return String(value.value);
    case 'dimension':
      return value.value === 0 ? '0' : `${value.value}${value.unit}`;
    default:
      // Script/expression/json-valued style parameters have no static CSS meaning; the caller's
      // unhandled path reports them. Stringify defensively rather than throw (nothing in emit
      // is allowed to fail on content).
      return JSON.stringify('source' in value ? value.source : value.value);
  }
}

/** Catalog defaults for shadow lengths are bare numbers meaning px; zero stays unitless. */
function shadowLength(value: unknown): string {
  if (typeof value === 'number') return value === 0 ? '0' : `${value}px`;
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
    return value === '0' ? '0' : `${value}px`;
  }
  return String(value ?? '0');
}

function kebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function orderDecls(decls: Decl[]): Decl[] {
  return decls
    .map((decl, i) => ({ decl, i }))
    .sort((a, b) => {
      const ai = ORDER_INDEX.get(a.decl.prop) ?? PROPERTY_ORDER.length;
      const bi = ORDER_INDEX.get(b.decl.prop) ?? PROPERTY_ORDER.length;
      if (ai !== bi) return ai - bi;
      if (a.decl.prop !== b.decl.prop) return a.decl.prop < b.decl.prop ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.decl);
}
