import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { blurLength, computeNodeStyle, cssUrl } from '../src/emit/style';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';
import { typecheckEmittedApp } from './helpers/typecheckApp';

/**
 * EXP-014 — the ground the headline sits on.
 *
 * A Group's `backgroundGradient`, `backgroundImage`, `backgroundSize`, `backgroundPosition` and
 * `backdropBlur` were dropped with a `has no style/content mapping` note and no translation, so the
 * hero of every shipped landing page exported as white display type on the page's cream ground —
 * a contrast ratio of 1.03:1, measured. The fold now lives in `computeNodeStyle`, transcribed from
 * the runtime's `_updateBackgroundLayers` rather than reinvented.
 *
 * The fixture is `tests/fixtures/ground-desk`: a hero carrying BOTH layers with authored companions,
 * then a column of panels isolating each half — gradient alone, picture alone, a backdrop blur, the
 * companions with nothing to size, a zero blur, a bare-number blur, a token blur, an already-absolute
 * picture URL, and a whitespace-only gradient.
 *
 * 🔴 **The reverted arm is a row here, not a memory.** `computeNodeStyle` is called directly with the
 * ground parameters stripped, which is exactly what the exporter did before this task, and §F asserts
 * the pre-fix reading — no `background-image` at all, and the four parameters coming back as
 * `unhandled`. A recommendation that only measures the fixed arm measures some property, not this one.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'ground-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const PAGE = 'Pages/Ground';
const CSS_FILE = 'src/pages/Ground.module.css';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, id: string): NodeIR => componentOf(source, PAGE).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

/** One generated class block, `.name { … }`, from the emitted stylesheet. */
const block = (css: string, cls: string): string => {
  const match = new RegExp(`\\n\\.${cls} \\{\\n([^}]*)\\}`).exec(css);
  expect(match).not.toBeNull();
  return match![1];
};
/** The declarations of one class, in emitted order. */
const decls = (css: string, cls: string): string[] =>
  block(css, cls)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

/** The style a node computes on its own, straight from the rule under test. */
const styleOf = (id: string, mutate?: (node: NodeIR) => void) => {
  const ir = cloneIr();
  const node = nodeOf(ir, id);
  mutate?.(node);
  return computeNodeStyle(node, 'group', index);
};
const valueOf = (id: string, prop: string, mutate?: (node: NodeIR) => void): string | undefined =>
  styleOf(id, mutate).decls.find((d) => d.prop === prop)?.value;

// ---------------------------------------------------------------------------------------------------
describe('§A the fold — two ports, one declaration, gradient first', () => {
  test('A1 the hero emits both layers in ONE background-image, gradient before the picture', () => {
    expect(decls(app.files[CSS_FILE], 'hero')).toContain(
      'background-image: var(--gradient-deep), url("/noodl_modules/starter-imagery/people-coffee-shop.webp");'
    );
  });

  test('A2 the order is the scrim idiom, not alphabetical or authoring order — the gradient paints OVER the picture', () => {
    const value = valueOf('hero', 'background-image')!;
    expect(value.indexOf('var(--gradient-deep)')).toBeLessThan(value.indexOf('url('));
  });

  test('A3 one declaration, never two — a second background-image would silently erase the first', () => {
    expect(styleOf('hero').decls.filter((d) => d.prop === 'background-image')).toHaveLength(1);
  });

  test('A4 a gradient alone is a complete ground: the declaration, and no url()', () => {
    const value = valueOf('gradientOnly', 'background-image')!;
    expect(value).toBe('var(--gradient-brand)');
    expect(value).not.toContain('url(');
  });

  test('A5 a picture alone is a complete ground: the url(), and no comma', () => {
    const value = valueOf('pictureOnly', 'background-image')!;
    expect(value).toBe('url("/noodl_modules/starter-imagery/food-grocer.webp")');
    expect(value).not.toContain(',');
  });

  test('A6 a whitespace-only gradient is no gradient — the runtime trims to undefined and so does this', () => {
    expect(valueOf('emptyGradient', 'background-image')).toBeUndefined();
    expect(styleOf('emptyGradient').unhandled).not.toContain('backgroundGradient');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the companions — the runtime’s defaults, and the property nobody may set', () => {
  test('B1 authored size and position are emitted verbatim beside the layers', () => {
    expect(decls(app.files[CSS_FILE], 'hero')).toEqual(
      expect.arrayContaining(['background-size: contain;', 'background-position: top center;'])
    );
  });

  test('B2 unauthored size and position take the CATALOG defaults, which are the runtime’s || fallbacks', () => {
    expect(valueOf('gradientOnly', 'background-size')).toBe('cover');
    expect(valueOf('gradientOnly', 'background-position')).toBe('center');
    expect(index.inputDefault('Group', 'backgroundSize')).toBe('cover');
    expect(index.inputDefault('Group', 'backgroundPosition')).toBe('center');
  });

  test('B3 background-repeat is always no-repeat and is never read from a port — Group has none', () => {
    expect(valueOf('hero', 'background-repeat')).toBe('no-repeat');
    expect(valueOf('gradientOnly', 'background-repeat')).toBe('no-repeat');
    const groupPorts = (catalog.nodes.find((n) => n.typeName === 'Group')?.inputs ?? []).map((p) => p.name);
    expect(groupPorts).not.toContain('backgroundRepeat');
  });

  test('B4 with NEITHER layer set, none of the four properties is emitted — the runtime REMOVES them', () => {
    const flat = styleOf('flat').decls.map((d) => d.prop);
    expect(flat).not.toContain('background-image');
    expect(flat).not.toContain('background-size');
    expect(flat).not.toContain('background-position');
    expect(flat).not.toContain('background-repeat');
  });

  test('B5 …and the authored companions with nothing to size are still consumed, not reported', () => {
    // `flat` sets backgroundSize and backgroundPosition and no layer. The runtime drops them just
    // as silently; a `has no style/content mapping` note here would be a refusal of correct output.
    expect(styleOf('flat').unhandled).toEqual([]);
    expect(app.notes.join('\n')).not.toContain('parameter backgroundSize');
    expect(app.notes.join('\n')).not.toContain('parameter backgroundPosition');
  });

  test('B6 the four properties sit together in PROPERTY_ORDER, image first, in the runtime’s write order', () => {
    const props = styleOf('hero').decls.map((d) => d.prop);
    const ground = ['background-image', 'background-size', 'background-position', 'background-repeat'];
    const at = ground.map((p) => props.indexOf(p));
    expect(at).toEqual([at[0], at[0] + 1, at[0] + 2, at[0] + 3]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C backdrop blur — both spellings or neither', () => {
  test('C1 an authored blur emits BOTH the prefixed and the unprefixed property, same value', () => {
    expect(decls(app.files[CSS_FILE], 'frosted')).toEqual(
      expect.arrayContaining(['-webkit-backdrop-filter: blur(14px);', 'backdrop-filter: blur(14px);'])
    );
  });

  test('C2 a ZERO blur emits NEITHER — blur(0px) still promotes the element to its own layer', () => {
    const props = styleOf('blurZero').decls.map((d) => d.prop);
    expect(props).not.toContain('backdrop-filter');
    expect(props).not.toContain('-webkit-backdrop-filter');
  });

  test('C3 an absent blur emits neither, and is not reported', () => {
    const style = styleOf('flat');
    expect(style.decls.map((d) => d.prop)).not.toContain('backdrop-filter');
    expect(style.unhandled).not.toContain('backdropBlur');
  });

  test('C4 a bare number is px — the shape a parameter carries when it did not come from the editor', () => {
    expect(valueOf('blurBare', 'backdrop-filter')).toBe('blur(8px)');
  });

  test('C5 a token reference paints: it is not a number, so the zero gate does not fire on it', () => {
    expect(valueOf('blurToken', 'backdrop-filter')).toBe('blur(var(--blur-panel))');
  });

  test('C6 the two spellings are never separable — one without the other is the arm this asserts', () => {
    for (const id of ['frosted', 'blurBare', 'blurToken', 'blurZero', 'flat']) {
      const props = styleOf(id).decls.map((d) => d.prop);
      expect(props.includes('backdrop-filter')).toBe(props.includes('-webkit-backdrop-filter'));
    }
  });

  test('C7 blurLength, unit by unit: the runtime’s cssLength followed by its zero gate', () => {
    expect(blurLength(undefined)).toBeUndefined();
    expect(blurLength({ kind: 'dimension', value: 14, unit: 'px' })).toBe('14px');
    expect(blurLength({ kind: 'dimension', value: 0, unit: 'px' })).toBeUndefined();
    expect(blurLength({ kind: 'dimension', value: 2, unit: 'rem' })).toBe('2rem');
    expect(blurLength({ kind: 'literal', value: 8 })).toBe('8px');
    expect(blurLength({ kind: 'literal', value: 0 })).toBeUndefined();
    expect(blurLength({ kind: 'literal', value: '' })).toBeUndefined();
    expect(blurLength({ kind: 'literal', value: '  ' })).toBeUndefined();
    expect(blurLength({ kind: 'literal', value: 'var(--blur-panel)' })).toBe('var(--blur-panel)');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the token survives as a token, and the picture URL resolves', () => {
  test('D1 var(--gradient-deep) is emitted VERBATIM, never resolved to a literal gradient', () => {
    const css = app.files[CSS_FILE];
    expect(css).toContain('var(--gradient-deep)');
    // A themed gradient must re-theme with the project — the whole reason the port is a string.
    expect(css).not.toContain('linear-gradient(');
  });

  test('D2 a project-relative picture becomes root-absolute — a relative url() in CSS resolves against the STYLESHEET', () => {
    expect(valueOf('pictureOnly', 'background-image')).toContain('url("/noodl_modules/');
    expect(valueOf('pictureOnly', 'background-image')).not.toContain('url("noodl_modules/');
  });

  test('D3 …and that is the same path the asset is copied to, so the URL resolves in the built app', () => {
    // The emitted URL, minus its leading slash, is the `to` of a copy under `public/`.
    const url = /url\("([^"]+)"\)/.exec(valueOf('pictureOnly', 'background-image')!)![1];
    expect(`public${url}`).toBe('public/noodl_modules/starter-imagery/food-grocer.webp');
  });

  test('D4 an already-absolute URL passes through untouched', () => {
    expect(valueOf('absoluteImage', 'background-image')).toBe('url("https://cdn.example.com/hero.jpg")');
  });

  test('D5 cssUrl, shape by shape', () => {
    expect(cssUrl('noodl_modules/a/b.webp')).toBe('/noodl_modules/a/b.webp');
    expect(cssUrl('/already/root.png')).toBe('/already/root.png');
    expect(cssUrl('https://cdn.example.com/x.jpg')).toBe('https://cdn.example.com/x.jpg');
    expect(cssUrl('//cdn.example.com/x.jpg')).toBe('//cdn.example.com/x.jpg');
    expect(cssUrl('data:image/gif;base64,R0lGOD')).toBe('data:image/gif;base64,R0lGOD');
    // The two characters that would break out of `url("…")`.
    expect(cssUrl('shots/a"b.png')).toBe('/shots/a\\"b.png');
    expect(cssUrl('shots/a\\b.png')).toBe('/shots/a\\\\b.png');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E the refusals disappear, and nothing replaces them', () => {
  test('E1 no ground parameter is reported as unmapped anywhere in the app', () => {
    const notes = app.notes.join('\n');
    for (const name of ['backgroundGradient', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backdropBlur']) {
      expect(notes).not.toContain(`parameter ${name}`);
    }
  });

  test('E2 …and no new note takes their place: the page reports nothing at all', () => {
    expect(app.notes.filter((n) => n.startsWith(`${PAGE}:`))).toEqual([]);
  });

  test('E3 no TODO(export) marker survives on any node carrying a ground parameter', () => {
    const tsx = app.files['src/pages/Ground.tsx'];
    expect(tsx).not.toContain('TODO(export)');
  });

  test('E4 the emitted app typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the reverted arm — what the exporter did before this task, measured rather than remembered', () => {
  const stripped = (id: string) =>
    styleOf(id, (node) => {
      for (const name of ['backgroundGradient', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backdropBlur']) {
        dropParam(node, name);
      }
    });

  test('F1 with the parameters gone the hero has NO ground at all — the 1.03:1 reading', () => {
    const props = stripped('hero').decls.map((d) => d.prop);
    expect(props).not.toContain('background-image');
    expect(props).not.toContain('background-color');
  });

  test('F2 the frosted panel keeps its see-through fill and loses the frost, which is why it read as a flat wash', () => {
    const props = stripped('frosted').decls.map((d) => d.prop);
    expect(props).toContain('background-color');
    expect(props).not.toContain('backdrop-filter');
  });

  test('F3 …and the ONLY thing that changed is the rule: the same node, parameters intact, paints', () => {
    expect(styleOf('hero').decls.map((d) => d.prop)).toContain('background-image');
    expect(styleOf('frosted').decls.map((d) => d.prop)).toContain('backdrop-filter');
  });

  test('F4 an unknown ground-shaped parameter is STILL reported — the fold consumed five names, not the category', () => {
    const style = styleOf('hero', (node) => setParam(node, 'backgroundBlendMode', literal('multiply')));
    expect(style.unhandled).toContain('backgroundBlendMode');
  });
});
