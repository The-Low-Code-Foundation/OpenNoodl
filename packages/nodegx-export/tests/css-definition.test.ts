import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §48 — `CSS Definition` (Tier 3.9), and the authored CSS Class it targets.
 *
 * The runtime appends the authored CSS to `document.head` in a `<style>` for as long as the node
 * exists and removes it with the node (css-definition.ts `updateStyle`/`removeStyleDeclaration`).
 * So the export is a module constant holding the text verbatim and a mount effect that appends
 * and removes it — the node's own two methods, per instance. Its one input is `allowEditOnly`
 * with a CSS code editor, which the parser carries as `{ kind: 'script', source }`.
 *
 * A stylesheet targets class names, and every visual node's "CSS Class" (`cssClassName`,
 * react-component-node.ts: `this.props.className = value`) was an unmapped parameter dropped
 * with a note — so the second half of this slice folds an authored one into the element's
 * `className`, after the module class and before the visibility toggle.
 *
 * §A the stylesheet, §B the class names, §C the fixture `tests/fixtures/due-desk` whole.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'due-desk');
const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const withoutBackend = (source: ExportIR = cloneIr()): ExportIR => {
  delete source.project.cloudservices;
  return source;
};
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const css = (source: string): ParamValue => ({ kind: 'script', source }) as ParamValue;
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const wire = (source: ExportIR, componentPath: string, fromId: string, fromProperty: string, toId: string, toProperty: string) => {
  componentOf(source, componentPath).connections.push({
    key: `${fromId}:${fromProperty}->${toId}:${toProperty}`,
    fromId,
    fromProperty,
    toId,
    toProperty,
    kind: 'value'
  });
};
const addSheet = (source: ExportIR, id: string, label: string | undefined, style: string): NodeIR => {
  const node = {
    id,
    type: 'CSS Definition',
    catalogRef: 'CSS Definition',
    parameters: [{ name: 'style', value: css(style) }],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...(label !== undefined ? { authoredLabel: label } : {})
  } as unknown as NodeIR;
  componentOf(source, HOME).nodes.push(node);
  return node;
};
const home = (built: ReturnType<typeof emitApp>): string => built.files[HOME_FILE];
const dispositionOf = (source: ExportIR, nodeId: string): { kind: string; into?: string; reason?: string } | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  return project.plans.find((p) => p.path === HOME)!.dispositions[nodeId] as { kind: string; into?: string; reason?: string } | undefined;
};

const SHEET_CONST =
  'const DESK_STYLES = `.due-desk {\n  border-left: 6px solid rgb(0, 128, 0);\n}\n.due-title {\n  text-decoration: underline;\n}`;';
const SHEET_EFFECT = [
  '  // Desk styles — added to the page while this component is mounted and removed with it (css-definition.ts).',
  '  useEffect(() => {',
  "    const style = document.createElement('style');",
  '    style.textContent = DESK_STYLES;',
  '    document.head.appendChild(style);',
  '    return () => {',
  '      style.remove();',
  '    };',
  '  }, []);'
].join('\n');
const NO_TRANSLATION = 'node deskStyles (CSS Definition) has no translation in this slice';

describe('§A — the stylesheet', () => {
  test('A1 the authored CSS is a module constant above the component, verbatim, under a comment naming the node', () => {
    expect(home(app)).toContain(
      '/** Desk styles — added to the page while this component is mounted and removed with it (css-definition.ts). */\n' + SHEET_CONST
    );
    // Above the component, after joinClasses — module scope, not inside the function.
    expect(home(app).indexOf(SHEET_CONST)).toBeLessThan(home(app).indexOf('export function HomePage()'));
  });

  test('A2 the effect: append on mount, remove on unmount, no dependencies — and useEffect imported for it', () => {
    expect(home(app)).toContain(SHEET_EFFECT);
    expect(home(app)).toContain("import { useEffect, useState } from 'react';");
  });

  test('A3 the node collapses into the page file; the "no translation" note is gone', () => {
    expect(dispositionOf(cloneIr(), 'deskStyles')).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(app.notes.join('\n')).not.toContain(NO_TRANSLATION);
    expect(app.notes.join('\n')).not.toContain('deskStyles');
  });

  test('A4 the three sequences a template literal would read as its own are escaped; everything else verbatim; the app typechecks', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'deskStyles'), 'style', css('.x::before {\n  content: "\\2014 `${x}" ;\n}'));
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain('const DESK_STYLES = `.x::before {\n  content: "\\\\2014 \\`\\${x}" ;\n}`;');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('A5 the constant is named from the label and deduped like a Static Data constant', () => {
    const ir = cloneIr();
    addSheet(ir, 'plain', undefined, 'p { margin: 0; }');
    addSheet(ir, 'digits', '2 col', 'p { margin: 0; }');
    addSheet(ir, 'twin', 'Desk styles', 'p { margin: 1px; }');
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain('const STYLES = `p { margin: 0; }`;');
    expect(home(built)).toContain('const _2_COL = `p { margin: 0; }`;');
    expect(home(built)).toContain('const DESK_STYLES_2 = `p { margin: 1px; }`;');
    expect(home(built)).toContain('style.textContent = DESK_STYLES_2;');
    expect(home(built).match(/document\.createElement\('style'\)/g)).toHaveLength(4);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('A6 a wired Style is refused by name — no constant, no effect', () => {
    const ir = cloneIr();
    wire(ir, HOME, 'savedVar', 'value', 'deskStyles', 'style');
    expect(dispositionOf(ir, 'deskStyles')).toEqual({
      kind: 'deferred',
      to: 'EXP-003',
      reason: 'its Style is wired — only an authored stylesheet translates in this slice'
    });
    const built = emitApp(ir, catalog);
    expect(home(built)).not.toContain('DESK_STYLES');
    expect(home(built)).not.toContain("document.createElement('style')");
    expect(built.notes.join('\n')).toContain('node deskStyles (CSS Definition) deferred: its Style is wired');
  });

  test('A7 an empty Style is static: the runtime appends an empty stylesheet, nothing is emitted, and the note says so', () => {
    for (const empty of ['', '   \n']) {
      const ir = cloneIr();
      setParam(nodeOf(ir, HOME, 'deskStyles'), 'style', css(empty));
      expect(dispositionOf(ir, 'deskStyles')).toEqual({ kind: 'static' });
      const built = emitApp(ir, catalog);
      expect(home(built)).not.toContain("document.createElement('style')");
      expect(built.notes.join('\n')).toContain(
        'node deskStyles (CSS Definition) has an empty Style — the runtime appends an empty stylesheet, so nothing is emitted'
      );
    }
    // A plain literal (a project that stores the port as one) is read the same as the script kind.
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'deskStyles'), 'style', lit('p { margin: 0; }'));
    expect(home(emitApp(ir, catalog))).toContain('const DESK_STYLES = `p { margin: 0; }`;');
  });

  test('A8 the catalog agrees the node has one input and no outputs — the shape this translation assumes', () => {
    const def = (catalog as unknown as { nodes: Array<{ typeName: string; inputs?: Array<{ name: string }>; outputs?: Array<{ name: string }> }> }).nodes.find(
      (n) => n.typeName === 'CSS Definition'
    )!;
    expect(def.inputs?.map((i) => i.name)).toEqual(['style']);
    expect(def.outputs ?? []).toEqual([]);
  });
});

describe('§B — the authored CSS Class', () => {
  test('B1 the collapsed Group’s class lands on the page div, after the module class', () => {
    expect(home(app)).toContain("<div className={joinClasses(styles.page, 'due-desk')}>");
  });

  test('B2 a Text’s class joins its own module class', () => {
    expect(home(app)).toContain("<p className={joinClasses(styles.heading, 'due-title')}>Due Desk</p>");
    expect(home(app)).toContain('function joinClasses(');
  });

  test('B3 neither class is reported as dropped any more — and a sibling without one is untouched', () => {
    expect(app.notes.join('\n')).not.toContain('cssClassName');
    expect(home(app)).toContain('<p className={styles.text}>');
  });

  test('B4 CONTROL — the authored class removed: the module class prints bare, exactly as before', () => {
    const ir = cloneIr();
    nodeOf(ir, HOME, 'heading').parameters = nodeOf(ir, HOME, 'heading').parameters.filter((p) => p.name !== 'cssClassName');
    nodeOf(ir, HOME, 'shell').parameters = nodeOf(ir, HOME, 'shell').parameters.filter((p) => p.name !== 'cssClassName');
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain('<div className={styles.page}>');
    expect(home(built)).toContain('<p className={styles.heading}>Due Desk</p>');
    // The stylesheet still names `.due-title` (that is the author's text); no className does.
    expect(home(built)).not.toContain("'due-title'");
    expect(home(built)).not.toContain("'due-desk'");
  });

  test('B5 a wired CSS Class stays an unmapped parameter, reported as before; a blank one is reported as before', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'heading'), 'cssClassName', { kind: 'expression', source: 'x' } as unknown as ParamValue);
    const built = emitApp(ir, catalog);
    expect(home(built)).toContain('<p className={styles.heading}>Due Desk</p>');
    expect(built.notes.join('\n')).toContain('parameter cssClassName on heading has no style/content mapping — dropped, reported');
    const blank = cloneIr();
    setParam(nodeOf(blank, HOME, 'heading'), 'cssClassName', lit('   '));
    const builtBlank = emitApp(blank, catalog);
    expect(home(builtBlank)).toContain('<p className={styles.heading}>Due Desk</p>');
    expect(builtBlank.notes.join('\n')).toContain('parameter cssClassName on heading has no style/content mapping');
  });

  test('B6 the visibility toggle comes after the authored class; a name that is not a plain class list is JSON-quoted', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'heading'), 'visible', lit(false));
    setParam(nodeOf(ir, HOME, 'titleText'), 'cssClassName', lit("it's odd"));
    const built = emitApp(ir, catalog);
    expect(home(built)).toMatch(/<p className=\{joinClasses\(styles\.heading, 'due-title', styles\.\w+\)\}>Due Desk<\/p>/);
    expect(home(built)).toContain('<p className={joinClasses(styles.text, "it\'s odd")}>');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§C — the fixture whole', () => {
  test('C1 typechecks with and without a backend', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
    expect(typecheckEmittedApp(emitApp(withoutBackend(), catalog))).toEqual([]);
  });
});
