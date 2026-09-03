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
export type StyleRole =
  | 'group'
  | 'text'
  | 'image'
  | 'button'
  | 'input'
  | 'page'
  | 'columns'
  | 'icon'
  | 'checkbox'
  | 'radio'
  | 'radiogroup'
  | 'select'
  | 'range'
  | 'video'
  | 'circle';

export interface Decl {
  prop: string;
  value: string;
}

export interface NodeStyle {
  /** Ordered, ready to print. */
  decls: Decl[];
  /** Parameter names the style tables know nothing about — report, never guess. */
  unhandled: string[];
  /** Anything the tables dropped knowingly (unusable layout tokens, …) — report verbatim. */
  notes: string[];
}

/** Pseudo/companion CSS a role owns beyond its one class (VISUALS-TARGET). */
export interface RoleCss {
  /** Printed as `.cls<suffix> { … }` right after the node's own block, decls hand-ordered. */
  blocks: Array<{ suffix: string; decls: Decl[] }>;
  /** A companion class beside the node's own: the control's label wrapper, the columns query container. */
  wrapper?: { role: 'label' | 'container'; decls: Decl[] };
  /** `@container (max-width: …)` overrides of the node's own class (columns breakpoints). */
  containerQueries: Array<{ maxWidth: string; decls: Decl[] }>;
  notes: string[];
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
  // `enabled` is the control gate from addControlEventsAndStates (boolean, default true,
  // coerced !!value); the DOM spells it inverted, so its role inverts (LOGIC-TARGET §7).
  'net.noodl.controls.button': { label: 'children', enabled: 'attr-not:disabled' },
  Button: { label: 'children', enabled: 'attr-not:disabled' },
  'net.noodl.controls.textinput': {
    placeholder: 'attr:placeholder',
    startValue: 'attr:defaultValue',
    type: 'attr:type',
    maxLength: 'attr:maxLength',
    enabled: 'attr-not:disabled'
  },
  'Text Input': {
    placeholder: 'attr:placeholder',
    startValue: 'attr:defaultValue',
    type: 'attr:type',
    maxLength: 'attr:maxLength',
    enabled: 'attr-not:disabled'
  },
  Page: { title: 'head', description: 'head', urlPath: 'routing' },
  'For Each': { template: 'template', items: 'items', inputMappingScript: 'mapping' },
  ...aliased(['net.noodl.visual.icon'], {
    iconSourceType: 'icon-source',
    iconIconSource: 'icon-source',
    iconImageSource: 'icon-source'
  }),
  ...aliased(['net.noodl.controls.checkbox', 'Checkbox'], {
    checked: 'attr:defaultChecked',
    enabled: 'attr-not:disabled',
    label: 'label',
    useLabel: 'control',
    useIcon: 'control'
  }),
  ...aliased(['net.noodl.controls.radiobutton', 'Radio Button'], {
    value: 'attr:value',
    enabled: 'attr-not:disabled',
    label: 'label',
    useLabel: 'control',
    useIcon: 'control'
  }),
  ...aliased(['Radio Button Group'], { value: 'group-value' }),
  ...aliased(['net.noodl.controls.range', 'Range'], {
    min: 'attr:min',
    max: 'attr:max',
    step: 'attr:step',
    value: 'attr:defaultValue',
    enabled: 'attr-not:disabled'
  }),
  ...aliased(['net.noodl.controls.options', 'Options'], {
    items: 'options',
    placeholder: 'placeholder',
    value: 'attr:defaultValue',
    enabled: 'attr-not:disabled',
    useLabel: 'control',
    placeholderOpacity: 'control'
  }),
  ...aliased(['Video'], {
    src: 'attr:src',
    poster: 'attr:poster',
    autoplay: 'attr:autoPlay',
    controls: 'attr:controls',
    muted: 'attr:muted',
    loop: 'attr:loop'
  }),
  ...aliased(['Circle'], {
    size: 'shape',
    fillEnabled: 'shape',
    fillColor: 'shape',
    strokeEnabled: 'shape',
    strokeWidth: 'shape',
    strokeColor: 'shape',
    strokeLineCap: 'shape',
    startAngle: 'shape',
    endAngle: 'shape'
  })
};

function aliased(typeNames: string[], roles: Record<string, string>): Record<string, Record<string, string>> {
  return Object.fromEntries(typeNames.map((name) => [name, roles]));
}

/** JSX attribute order per element, so generated attribute lists are stable and readable. */
export const CONTENT_ATTR_ORDER: string[] = [
  'src',
  'srcSet',
  'alt',
  'poster',
  'type',
  'value',
  'placeholder',
  'defaultValue',
  'defaultChecked',
  'min',
  'max',
  'step',
  'maxLength',
  'controls',
  'autoPlay',
  'muted',
  'loop',
  'disabled'
];

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
  'fontVariantNumeric',
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
 * The style parameters a **wire** may land on (EXP-011 §49) — printed as an inline `style={{…}}`
 * on the element, which wins over the module class exactly as a wired value replaces the
 * authored parameter in the runtime. `sink` is what the position holds, for the untyped-source
 * table in `component.ts`; `css` is the React style key.
 *
 * Three, chosen by what the animation pair drives and by what needs no unit: `opacity` is
 * unitless, the two colours are strings. A wired `width` would need the port's `defaultUnit`
 * appended and a wired `transformX` a `transform` the static style has no rule for — both
 * refused by name until a fixture asks. Keys in emit order.
 */
export const WIRED_STYLE_SINKS: Record<string, { css: string; sink: 'number' | 'string' }> = {
  opacity: { css: 'opacity', sink: 'number' },
  color: { css: 'color', sink: 'string' },
  backgroundColor: { css: 'backgroundColor', sink: 'string' }
};

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
  'content',
  'appearance',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'display',
  'grid-template-columns',
  'place-content',
  'flex-direction',
  'flex-wrap',
  'flex-shrink',
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
  'object-position',
  'fill',
  'accent-color',
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
  'opacity',
  'user-select'
];

const ORDER_INDEX = new Map(PROPERTY_ORDER.map((prop, i) => [prop, i]));

export function computeNodeStyle(node: NodeIR, role: StyleRole, catalog: CatalogIndex): NodeStyle {
  const params = new Map(node.parameters.map((p) => [p.name, p.value]));
  const content = CONTENT_PARAMS[node.type] ?? {};
  const decls: Decl[] = [];
  const unhandled: string[] = [];
  const notes: string[] = [];
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
  // The controls always draw their box (the interpreter applies these port defaults whether or
  // not the author touched them), so the class states the effective value: authored, else the
  // catalog's. Numeric defaults on px-united ports become px dimensions.
  const injectDefault = (name: string) => {
    if (params.has(name)) return;
    const def = catalogDefault(name);
    if (def === undefined || def === null) return;
    params.set(
      name,
      typeof def === 'number'
        ? { kind: 'dimension', value: def, unit: 'px' }
        : { kind: 'literal', value: def as string | boolean }
    );
  };

  // Resets and flex bases: the interpreted runtime's Text has no margins and its containers are
  // flex columns, so the class states both explicitly (TARGET-OUTPUT §1) instead of leaning on a
  // global reset.
  if (role === 'text') decls.push({ prop: 'margin', value: '0' });
  if (role === 'group' || role === 'page' || role === 'radiogroup') {
    decls.push({ prop: 'display', value: 'flex' });
    const direction = literal('flexDirection') ?? catalogDefault('flexDirection') ?? 'column';
    decls.push({ prop: 'flex-direction', value: String(direction) });
  }

  // Columns → CSS Grid (VISUALS-TARGET §1): the layout string's fractions are fr units, the
  // negative-margin gutter is gap, Auto Fit is the repeat() it was imitating. Breakpoints live
  // in computeRoleCss as @container rules over the same track vocabulary.
  if (role === 'columns') {
    for (const name of COLUMNS_LAYOUT_PARAMS) consumed.add(name);
    decls.push({ prop: 'display', value: 'grid' });
    const sizing = literal('sizing') ?? catalogDefault('sizing') ?? 'layoutString';
    const minWidth = cssParam('minWidth');
    if (sizing === 'autoFit') {
      decls.push({ prop: 'grid-template-columns', value: autoFitTracks(minWidth) });
    } else {
      const layout = String(literal('layoutString') ?? catalogDefault('layoutString') ?? '1 2 1');
      decls.push({ prop: 'grid-template-columns', value: layoutTracks(layout, minWidth, notes) });
    }
    decls.push({ prop: 'column-gap', value: cssParam('marginX') ?? gapDefault(catalogDefault('marginX')) });
    decls.push({ prop: 'row-gap', value: cssParam('marginY') ?? gapDefault(catalogDefault('marginY')) });
    const justify = literal('justifyContent');
    if (typeof justify === 'string' && justify !== 'flex-start') {
      decls.push({ prop: 'justify-content', value: justify.replace(/^flex-/, '') });
    }
  }

  // Icon: one element per source kind (VISUALS-TARGET §2); the class carries the size/colour the
  // wrapper style carried in the runtime.
  if (role === 'icon') {
    consumed.add('iconSize');
    consumed.add('iconColor');
    const size = cssParam('iconSize') ?? pxDefault(catalogDefault('iconSize'), '16px');
    const color = cssParam('iconColor') ?? String(catalogDefault('iconColor') ?? '#FFFFFF');
    const source = iconSourceOf(node, catalog);
    if (source.kind === 'font') {
      decls.push({ prop: 'font-size', value: size });
      decls.push({ prop: 'line-height', value: '1' });
      decls.push({ prop: 'color', value: color });
      decls.push({ prop: 'user-select', value: 'none' });
    } else if (source.kind === 'sprite' || source.kind === 'image') {
      decls.push({ prop: 'display', value: 'block' });
      decls.push({ prop: 'width', value: size });
      decls.push({ prop: 'height', value: size });
      if (source.kind === 'sprite') decls.push({ prop: 'fill', value: color });
    }
  }

  // Checkbox / Radio Button: the runtime control is a custom-styled box; appearance: none styles
  // the native input to the same box, with the effective (authored-or-default) dimensions and
  // border the interpreter always draws. The mark lives in computeRoleCss.
  if (role === 'checkbox' || role === 'radio') {
    for (const name of ['iconSize', 'iconColor', 'labelSpacing', 'fillColor', 'fillSpacing']) consumed.add(name);
    decls.push({ prop: 'appearance', value: 'none' });
    decls.push({ prop: 'margin', value: '0' });
    decls.push({ prop: 'display', value: 'grid' });
    decls.push({ prop: 'place-content', value: 'center' });
    for (const name of ['width', 'height', 'borderStyle', 'borderWidth', 'borderColor', 'borderRadius']) {
      injectDefault(name);
    }
  }

  if (role === 'select') {
    for (const name of ['borderStyle', 'borderWidth', 'borderColor', 'borderRadius']) injectDefault(name);
  }

  if (role === 'range') {
    consumed.add('thumbColor');
    if (!params.has('width')) decls.push({ prop: 'width', value: '100%' });
    const thumb = cssParam('thumbColor');
    if (thumb !== undefined) decls.push({ prop: 'accent-color', value: thumb });
  }

  // Video: the runtime's object-fit default (contain) is not CSS's (fill), so the class always
  // states it; the two position halves fold into object-position when authored.
  if (role === 'video') {
    for (const name of ['objectFit', 'objectPositionX', 'objectPositionY']) consumed.add(name);
    decls.push({ prop: 'object-fit', value: cssParam('objectFit') ?? String(catalogDefault('objectFit') ?? 'contain') });
    if (params.has('objectPositionX') || params.has('objectPositionY')) {
      const x = cssParam('objectPositionX') ?? '50%';
      const y = cssParam('objectPositionY') ?? '50%';
      decls.push({ prop: 'object-position', value: `${x} ${y}` });
    }
  }

  if (role === 'circle') {
    decls.push({ prop: 'display', value: 'block' });
    decls.push({ prop: 'flex-shrink', value: '0' });
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

  return { decls: orderDecls(decls), unhandled, notes };
}

/** The columns ports the grid translation consumes wholesale (VISUALS-TARGET §1). */
const COLUMNS_LAYOUT_PARAMS = [
  'layoutString',
  'sizing',
  'packing',
  'direction',
  'minWidth',
  'marginX',
  'marginY',
  'justifyContent',
  'mediumBreakpoint',
  'mediumLayout',
  'smallBreakpoint',
  'smallLayout'
];

/**
 * The layout string as grid tracks — `readLayoutToken`'s own rule (Columns.tsx): entries that
 * are not positive finite numbers are dropped (reported here, where the runtime's validator
 * cannot run), and a wholly unusable string renders one full-width column. An authored non-zero
 * minWidth wraps each track in minmax(), the fold's floor spelled in CSS.
 */
export function layoutTracks(layoutString: string, minWidth: string | undefined, notes: string[]): string {
  const tokens = layoutString.split(' ').filter((t) => t !== '');
  const fractions = tokens.filter((t) => {
    const n = Number(t);
    return Number.isFinite(n) && n > 0;
  });
  const dropped = tokens.filter((t) => !fractions.includes(t));
  if (dropped.length > 0) {
    notes.push(
      `layout string ${JSON.stringify(layoutString)}: ${dropped.map((t) => JSON.stringify(t)).join(', ')} ${
        dropped.length === 1 ? 'is not a positive number and is' : 'are not positive numbers and are'
      } dropped (the runtime drops them too)`
    );
  }
  const usable = fractions.length > 0 ? fractions.map(Number) : [1];
  const min = minWidth !== undefined && minWidth !== '0' ? minWidth : undefined;
  return usable.map((f) => (min !== undefined ? `minmax(${min}, ${f}fr)` : `${f}fr`)).join(' ');
}

/** Auto Fit's tracks; a zero/absent minimum degrades to one column, the runtime's own floor. */
export function autoFitTracks(minWidth: string | undefined): string {
  if (minWidth === undefined || minWidth === '0') return '1fr';
  return `repeat(auto-fit, minmax(${minWidth}, 1fr))`;
}

function gapDefault(def: unknown): string {
  return typeof def === 'number' ? (def === 0 ? '0' : `${def}px`) : '16px';
}

function pxDefault(def: unknown, fallback: string): string {
  return typeof def === 'number' ? (def === 0 ? '0' : `${def}px`) : fallback;
}

/** The three `Noodl.Icon` shapes plus image sources, resolved from static parameters. */
export type IconSource =
  | { kind: 'font'; classes: string[]; text?: string }
  | { kind: 'sprite'; url: string; symbolId: string }
  | { kind: 'image'; src: string }
  | { kind: 'inline' }
  | { kind: 'none' };

export function iconSourceOf(node: NodeIR, catalog: CatalogIndex): IconSource {
  const param = (name: string) => node.parameters.find((p) => p.name === name)?.value;
  const sourceTypeParam = param('iconSourceType');
  const sourceType =
    sourceTypeParam?.kind === 'literal'
      ? String(sourceTypeParam.value)
      : String((node.catalogRef && catalog.inputDefault(node.catalogRef, 'iconSourceType')) ?? 'icon');
  if (sourceType === 'image') {
    const src = param('iconImageSource');
    return src?.kind === 'literal' && typeof src.value === 'string' ? { kind: 'image', src: src.value } : { kind: 'none' };
  }
  const source = param('iconIconSource');
  if (source?.kind !== 'json' || typeof source.value !== 'object' || source.value === null) return { kind: 'none' };
  const value = source.value as { kind?: string; url?: string; symbolId?: string; class?: string; code?: string; codeAsClass?: boolean };
  if (value.kind === 'sprite') {
    return typeof value.url === 'string' && typeof value.symbolId === 'string'
      ? { kind: 'sprite', url: value.url, symbolId: value.symbolId }
      : { kind: 'none' };
  }
  if (value.kind === 'inline') return { kind: 'inline' };
  if (typeof value.class === 'string' || typeof value.code === 'string') {
    // Font — IconGlyph's two branches: codeAsClass sets carry one class per glyph; the others
    // put the codepoint in the element's text.
    if (value.codeAsClass === true) {
      return { kind: 'font', classes: [value.class, value.code].filter((c): c is string => typeof c === 'string' && c.length > 0) };
    }
    return {
      kind: 'font',
      classes: typeof value.class === 'string' && value.class.length > 0 ? [value.class] : [],
      ...(typeof value.code === 'string' ? { text: value.code } : {})
    };
  }
  return { kind: 'none' };
}

/**
 * The tick, as a mask so the mark's colour is an ordinary background-color — a stroked data-URI
 * cannot carry `var()`, and the mark takes the border colour, which corpus projects write as
 * tokens. The path is the runtime's own default check (Checkbox.tsx `_renderDefaultCheck`).
 */
const TICK_MASK =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E` +
  `%3Cpath d='M3.5 8.5l3 3 6-6' fill='none' stroke='black' stroke-width='2' ` +
  `stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat`;

/**
 * The CSS a role owns beyond its single class: control marks (::before), label wrappers, and
 * the columns breakpoints' @container rules. Kept beside computeNodeStyle because the two must
 * agree on effective values (border colour feeds both the box and the mark).
 */
export function computeRoleCss(node: NodeIR, role: StyleRole, catalog: CatalogIndex): RoleCss {
  const result: RoleCss = { blocks: [], containerQueries: [], notes: [] };
  const params = new Map(node.parameters.map((p) => [p.name, p.value]));
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

  if (role === 'checkbox' || role === 'radio') {
    // The mark takes the border colour — FB-020's own rule (checkbox tick and radio dot both),
    // with radio's authored fillColor winning when present.
    const borderColor = cssParam('borderColor') ?? String(catalogDefault('borderColor') ?? '#000000');
    if (literal('useIcon') === false) {
      result.notes.push(
        `node ${node.id} draws no default mark (Enable Icon is off); its visual-state mark styling is not translated`
      );
    } else if (role === 'checkbox') {
      const size = cssParam('iconSize') ?? pxDefault(catalogDefault('iconSize'), '16px');
      result.blocks.push({
        suffix: '::before',
        decls: [
          { prop: 'content', value: "''" },
          { prop: 'width', value: size },
          { prop: 'height', value: size },
          { prop: 'background-color', value: borderColor },
          { prop: 'mask', value: TICK_MASK },
          { prop: 'transform', value: 'scale(0)' }
        ]
      });
      result.blocks.push({ suffix: ':checked::before', decls: [{ prop: 'transform', value: 'scale(1)' }] });
    } else {
      const spacing = cssParam('fillSpacing') ?? pxDefault(catalogDefault('fillSpacing'), '2px');
      const inset = spacing === '0' ? '100%' : `calc(100% - ${spacing} * 2)`;
      const fill = cssParam('fillColor') ?? borderColor;
      result.blocks.push({
        suffix: '::before',
        decls: [
          { prop: 'content', value: "''" },
          { prop: 'width', value: inset },
          { prop: 'height', value: inset },
          { prop: 'border-radius', value: 'inherit' },
          { prop: 'background-color', value: fill },
          { prop: 'transform', value: 'scale(0)' }
        ]
      });
      result.blocks.push({ suffix: ':checked::before', decls: [{ prop: 'transform', value: 'scale(1)' }] });
    }
    if (literal('useLabel') === true) {
      const spacing = cssParam('labelSpacing') ?? pxDefault(catalogDefault('labelSpacing'), '10px');
      result.wrapper = {
        role: 'label',
        decls: [
          { prop: 'display', value: 'flex' },
          { prop: 'align-items', value: 'center' },
          { prop: 'gap', value: spacing }
        ]
      };
    }
  }

  if (role === 'columns') {
    // Container width, not viewport width, is the runtime's breakpoint key (NDA-006 §3) — which
    // is @container. Medium emits before small so the cascade gives small the final word, the
    // runtime's own small-first check. A half-configured pair is inert, also the runtime's rule.
    const minWidth = cssParam('minWidth');
    const pairs: Array<{ breakpoint: string | undefined; layout: unknown }> = [
      { breakpoint: cssParam('mediumBreakpoint'), layout: literal('mediumLayout') },
      { breakpoint: cssParam('smallBreakpoint'), layout: literal('smallLayout') }
    ];
    for (const pair of pairs) {
      if (pair.breakpoint === undefined || pair.breakpoint === '0') continue;
      if (typeof pair.layout !== 'string' || pair.layout.trim() === '') continue;
      result.containerQueries.push({
        maxWidth: pair.breakpoint,
        decls: [{ prop: 'grid-template-columns', value: layoutTracks(pair.layout, minWidth, result.notes) }]
      });
    }
    if (result.containerQueries.length > 0) {
      result.wrapper = { role: 'container', decls: [{ prop: 'container-type', value: 'inline-size' }] };
    }
  }

  return result;
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
