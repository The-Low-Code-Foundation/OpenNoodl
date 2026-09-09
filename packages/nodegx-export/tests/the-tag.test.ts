import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { authoredTag } from '../src/emit/component';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';
import { typecheckEmittedApp } from './helpers/typecheckApp';

/**
 * EXP-015 — the tag the author chose.
 *
 * `Text` and `Group` each carry an `as` port ("Advanced HTML → Tag") whose description says it
 * *"changes nothing visually but matters for screen readers and SEO"*; the runtime honours it in two
 * lines (`Text.tsx` `props.as || 'div'`, `Group.tsx` `const { as = 'div' }`). The exporter never read
 * it. One landing-page template set it 61 times — `section` ×15, `span` ×17, `h2` ×17, `h3` ×4,
 * `h1` ×3, `main` ×3, `header` ×1, `footer` ×1 — and the exported site had no heading of any level and
 * no landmark of any kind, while the viewer rendered every one of them from the same directory.
 *
 * ⚠️ **One claim in the task file was wrong and is corrected here by measurement.** EXP-015 §1/§6 said
 * the authored value was "not refused, not noted, not counted as a translation gap". It WAS noted: 61
 * `parameter as on <id> has no style/content mapping — dropped, reported` lines, in the notes and in
 * `EXPORT-REPORT.md`. What was missing was the translation, not the report. §E grades the disappearance
 * of those 61 notes as part of this fix.
 *
 * Fixture: `tests/fixtures/tag-desk` — every landmark and heading the two enums offer, a Group whose
 * tag rides the PAGE COLLAPSE onto the page div, untagged nodes as the byte-identical regression guard,
 * a value outside each enum, an explicit `div` restating the default, and an `as` on a `Page`, a node
 * type whose catalog has no Tag port at all.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'tag-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const PAGE = 'Pages/Tag';
const TSX_FILE = 'src/pages/Tag.tsx';
const CSS_FILE = 'src/pages/Tag.module.css';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR): ComponentIR => source.components.find((c) => c.path === PAGE)!;
const nodeOf = (source: ExportIR, id: string): NodeIR => componentOf(source).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

/** The app re-emitted with one node changed. */
const withNode = (id: string, mutate: (node: NodeIR) => void) => {
  const ir = cloneIr();
  mutate(nodeOf(ir, id));
  return emitApp(ir, catalog);
};
const count = (haystack: string, needle: RegExp): number => haystack.match(needle)?.length ?? 0;
/** How many times an element opens in the emitted JSX. */
const tags = (src: string, tag: string): number => count(src, new RegExp(`<${tag}[\\s>]`, 'g'));
/** A synthetic node, for grading `authoredTag` where no fixture can reach the case. */
const asNode = (type: string, value?: string): NodeIR =>
  ({
    id: 'probe',
    type,
    parameters: value === undefined ? [] : [{ name: 'as', value: literal(value) }]
  }) as unknown as NodeIR;

// ---------------------------------------------------------------------------------------------------
describe('§A the authored tag wins — every element both enums offer', () => {
  const src = () => app.files[TSX_FILE];

  test('A1 a Text set to h1/h2/h3/p emits exactly that element', () => {
    expect(src()).toContain('<h1 className={styles.h1Text}>The tag the author chose</h1>');
    expect(src()).toContain('<h2 className={styles.text}>What it does</h2>');
    expect(src()).toContain('<h3 className={styles.text}>And how</h3>');
    expect(src()).toContain('<p className={styles.text}>A paragraph the author spelled out.</p>');
  });

  test('A2 a Group set to a landmark emits that landmark, opened and closed', () => {
    for (const [tag, cls] of [
      ['header', 'banner'],
      ['nav', 'bar'],
      ['section', 'hero'],
      ['aside', 'sidebar']
    ]) {
      expect(src()).toContain(`<${tag} className={styles.${cls}}>`);
      expect(src()).toContain(`</${tag}>`);
    }
  });

  test('A3 a Text set to span emits an inline element, not a paragraph', () => {
    expect(src()).toContain('<span className={styles.navLink}>Home</span>');
  });

  test('A4 the page carries exactly the structure the author asked for — counts, not presence', () => {
    expect(tags(src(), 'h1')).toBe(1);
    expect(tags(src(), 'h2')).toBe(1);
    expect(tags(src(), 'h3')).toBe(1);
    expect(tags(src(), 'main')).toBe(1);
    expect(tags(src(), 'header')).toBe(1);
    expect(tags(src(), 'nav')).toBe(1);
    expect(tags(src(), 'section')).toBe(1);
    expect(tags(src(), 'aside')).toBe(1);
  });

  test('A5 heading order is REPRODUCED, never renumbered — the author’s sequence, in source order', () => {
    const order = (src().match(/<h[1-6][\s>]/g) ?? []).map((m) => m.slice(1, 3));
    expect(order).toEqual(['h1', 'h2', 'h3']);
  });

  test('A6 an author who skips a level gets the skip, not a repair', () => {
    const emitted = withNode('h2Text', (node) => setParam(node, 'as', literal('h4')));
    const order = (emitted.files[TSX_FILE].match(/<h[1-6][\s>]/g) ?? []).map((m) => m.slice(1, 3));
    expect(order).toEqual(['h1', 'h4', 'h3']);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the regression guard — a node with no tag is what it always was', () => {
  test('B1 an untagged Text is still <p>, an untagged Group still <div>', () => {
    expect(app.files[TSX_FILE]).toContain('<p className={styles.text}>No tag was chosen here.</p>');
    expect(app.files[TSX_FILE]).toContain('<div className={styles.plainGroup}>');
  });

  test('B2 removing every `as` in the fixture reproduces a page of div and p, and nothing else', () => {
    const ir = cloneIr();
    for (const node of componentOf(ir).nodes) dropParam(node, 'as');
    const src = emitApp(ir, catalog).files[TSX_FILE];
    for (const tag of ['h1', 'h2', 'h3', 'main', 'header', 'nav', 'section', 'aside', 'span']) {
      expect(tags(src, tag)).toBe(0);
    }
    expect(tags(src, 'div')).toBeGreaterThan(0);
    expect(tags(src, 'p')).toBeGreaterThan(0);
  });

  test('B3 an `as` restating the role default changes nothing — an explicit div on a Group', () => {
    const emitted = withNode('plainGroup', (node) => setParam(node, 'as', literal('div')));
    expect(emitted.files[TSX_FILE]).toBe(app.files[TSX_FILE]);
  });

  test('B4 …and an explicit `div` on a TEXT is honoured, because the role default there is <p>', () => {
    // The port's own default is `div` for both node types; `p` is this exporter's Text default.
    expect(app.files[TSX_FILE]).toContain('<div className={styles.text}>An explicitly chosen div.</div>');
    expect(index.inputDefault('Text', 'as')).toBe('div');
  });

  test('B5 an empty or whitespace-only `as` is no choice at all', () => {
    for (const value of ['', '   ']) {
      const emitted = withNode('plainText', (node) => setParam(node, 'as', literal(value)));
      expect(emitted.files[TSX_FILE]).toBe(app.files[TSX_FILE]);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C validation — the catalog’s enum, per node type, and never a second copy', () => {
  test('C1 the two enums are read from the catalog and they DIFFER — one list would be wrong for both', () => {
    expect(index.enumValues('Text', 'as')).toEqual(['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span']);
    expect(index.enumValues('Group', 'as')).toEqual([
      'div',
      'section',
      'article',
      'aside',
      'nav',
      'header',
      'footer',
      'main',
      'span'
    ]);
  });

  test('C2 a value outside Text’s enum falls back to <p> AND is reported, naming the options', () => {
    expect(app.files[TSX_FILE]).toContain('<p className={styles.text}>A tag Text does not offer.</p>');
    expect(app.notes).toContain(
      `${PAGE}: parameter as on offEnumText is "figure", which Text does not offer ` +
        `(div, h1, h2, h3, h4, h5, h6, p, span) — the element stays <p>, reported`
    );
  });

  test('C3 a value outside Group’s enum falls back to <div> AND is reported', () => {
    expect(app.files[TSX_FILE]).toContain('<div className={styles.offEnum}>');
    expect(app.notes).toContain(
      `${PAGE}: parameter as on offEnum is "marquee", which Group does not offer ` +
        `(div, section, article, aside, nav, header, footer, main, span) — the element stays <div>, reported`
    );
  });

  test('C4 a tag legal on ONE node type and not the other is refused on the other — the drift the catalog prevents', () => {
    // `main` is a Group landmark and is not in Text's enum; `h1` is the mirror case.
    expect(authoredTag(asNode('Text', 'main'), 'p', index).tag).toBe('p');
    expect(authoredTag(asNode('Text', 'main'), 'p', index).refusal!.reason).toContain('which Text does not offer');
    expect(authoredTag(asNode('Group', 'h1'), 'div', index).tag).toBe('div');
    expect(authoredTag(asNode('Group', 'h1'), 'div', index).refusal!.reason).toContain('which Group does not offer');
  });

  test('C5 a node type the catalog gives no Tag port is refused by name — the export invents no element', () => {
    // `section` is a perfectly good element and a Group's own enum offers it. On a Page it is still
    // refused, because the authority is the port, not the vocabulary.
    expect(app.notes).toContain(
      `${PAGE}: parameter as on tdPage is "section", but Page has no Tag port — the element stays <div>, reported`
    );
    expect(index.enumValues('Page', 'as')).toBeUndefined();
  });

  test('C6 …and that refusal fires before the value is trusted: an arbitrary string never becomes an element', () => {
    const chosen = authoredTag(asNode('Page', 'script'), 'div', index);
    expect(chosen.tag).toBe('div');
    expect(chosen.refusal!.reason).toContain('has no Tag port');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D void elements — the guard, and the invariant that keeps it unreachable', () => {
  test('D1 an element that cannot take children falls back to <div> and reports, by that name', () => {
    expect(app.files[TSX_FILE]).toContain('<div className={styles.voidGroup}>');
    expect(app.notes).toContain(
      `${PAGE}: parameter as on voidGroup is "img", an element that cannot take children — the element stays <div>, reported`
    );
  });

  test('D1b the void gate is checked FIRST — `img` is off Group’s enum too, and the void reason is the one given', () => {
    // Ordering is the whole guard: behind the enum test it would be dead code, and the day `hr`
    // joins the enum it would emit `<hr>…</hr>` instead of refusing.
    expect(index.enumValues('Group', 'as')).not.toContain('img');
    expect(authoredTag(asNode('Group', 'img'), 'div', index).refusal!.reason).toContain(
      'an element that cannot take children'
    );
    expect(authoredTag(asNode('Page', 'br'), 'div', index).refusal!.reason).toContain(
      'an element that cannot take children'
    );
  });

  test('D2 NEITHER shipped enum contains a void element — this guard has no live path, and that is asserted', () => {
    const voidish = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
    for (const type of ['Text', 'Group']) {
      for (const value of index.enumValues(type, 'as') ?? []) {
        expect(voidish).not.toContain(value);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E nothing else keys off the tag — the element is the ONLY difference', () => {
  test('E1 a Group as section, nav, main, article and footer emits identical CSS, and JSX that differs ONLY in the element name', () => {
    // Element names erased on both sides: whatever is left is the class names, the attributes, the
    // children, the markers and the whitespace. If any of those moved with the tag, this goes red.
    const skeleton = (src: string) => src.replace(/<\/?[A-Za-z][A-Za-z0-9]*/g, (m) => (m.startsWith('</') ? '</X' : '<X'));
    for (const value of ['section', 'nav', 'main', 'article', 'footer']) {
      const arm = withNode('plainGroup', (node) => setParam(node, 'as', literal(value)));
      expect(arm.files[CSS_FILE]).toBe(app.files[CSS_FILE]);
      expect(skeleton(arm.files[TSX_FILE])).toBe(skeleton(app.files[TSX_FILE]));
      // …and the element really did change, so the skeleton comparison is not passing on a no-op.
      expect(arm.files[TSX_FILE]).toContain(`<${value} className={styles.plainGroup}>`);
      expect(arm.files[TSX_FILE]).not.toBe(app.files[TSX_FILE]);
    }
  });

  test('E2 the class name is the node’s, not the element’s — the naming pass never sees a tag', () => {
    expect(app.files[TSX_FILE]).toContain('<h1 className={styles.h1Text}>');
    expect(app.files[CSS_FILE]).toContain('.h1Text {');
  });

  test('E3 a Text as h1 carries the same declarations a Text as p would', () => {
    const asP = withNode('h1Text', (node) => setParam(node, 'as', literal('p')));
    expect(asP.files[CSS_FILE]).toBe(app.files[CSS_FILE]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the page collapse — a landmark directly under a Page is the one most likely to be lost', () => {
  test('F1 the page div renders as the collapsed Group’s tag', () => {
    expect(app.files[TSX_FILE]).toContain('<main className={styles.tdPage}>');
    expect(app.files[TSX_FILE].trimEnd().endsWith('</main>\n  );\n}')).toBe(true);
  });

  test('F2 with the Group’s tag removed the page div is a div again — the Page’s own `as` never wins here', () => {
    const emitted = withNode('shell', (node) => dropParam(node, 'as'));
    expect(emitted.files[TSX_FILE]).toContain('<div className={styles.tdPage}>');
  });

  test('F3 …and the Page’s refused `as` is reported either way, because an ignored authored value is the defect', () => {
    const emitted = withNode('shell', (node) => dropParam(node, 'as'));
    expect(emitted.notes.join('\n')).toContain('parameter as on tdPage is "section", but Page has no Tag port');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§G the report, and the app that ships', () => {
  test('G1 no `as` is reported as an unmapped parameter any more — 61 such notes on one template', () => {
    expect(app.notes.join('\n')).not.toContain('parameter as on shell has no style/content mapping');
    expect(app.notes.filter((n) => n.includes('as has no style/content mapping'))).toEqual([]);
  });

  test('G2 the only notes left are the four refusals, each naming its node', () => {
    expect(app.notes.filter((n) => n.startsWith(`${PAGE}:`))).toHaveLength(4);
    expect(app.notes.filter((n) => n.startsWith(`${PAGE}:`)).every((n) => n.includes('parameter as on'))).toBe(true);
  });

  test('G3 no TODO(export) marker sits on a node whose tag was honoured', () => {
    const tsx = app.files[TSX_FILE];
    expect(tsx).not.toContain('node shell renders');
    expect(tsx).not.toContain('node h1Text renders');
  });

  test('G4 …and every refused node DOES carry its marker, where a person reading the code will find it', () => {
    const tsx = app.files[TSX_FILE];
    for (const id of ['offEnumText', 'offEnum', 'voidGroup']) expect(tsx).toContain(`node ${id} renders`);
    expect(tsx).toContain('the authored "as" parameter is "figure", which Text does not offer');
    expect(tsx).toContain('the authored "as" parameter is "img", an element that cannot take children');
  });

  test('G5 the collapsed Page’s refusal marks the element that RENDERS — the page div, not a node nobody emits', () => {
    // The Page is the root, so its marker rides the leftover channel rather than a sibling comment;
    // what matters is that the deferral is keyed to the rendered id and reaches the file at all.
    expect(app.files[TSX_FILE]).toContain('the authored "as" parameter is "section", but Page has no Tag port');
  });

  test('G6 the emitted app typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
