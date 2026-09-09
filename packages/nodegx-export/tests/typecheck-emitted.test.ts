/**
 * EXP-011 §24.6 — the emitted app must **typecheck**, not merely parse.
 *
 * §24.3 recorded the hole this closes: with the row-earning clauses removed, the export emitted
 * `lastLinkError.set(helpError)` with no `useState` above it — a component that cannot compile —
 * and all 1054 rows stayed green, because every emitted-code assertion in this package parses and
 * an undeclared identifier is valid syntax. The defect was caught only by building the app.
 *
 * Each fixture project is parsed, emitted and compiled with the scaffold's own `compilerOptions`.
 * `tests/helpers/typecheckApp.ts` documents what resolves for real and what this cannot see.
 */
import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';

const FIXTURES = path.join(__dirname, 'fixtures');
const catalog: Catalog = loadCatalog();

/**
 * Read from disk rather than listed, so a fixture added later is compiled without anyone
 * remembering to add it here. A hard-coded list is a silent cap on what this suite covers.
 */
const fixtureNames = fs
  .readdirSync(FIXTURES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const emitFixture = (name: string) => {
  const ir = parseProject(path.join(FIXTURES, name), catalog);
  return emitApp(ir, catalog);
};

describe('every fixture emits an app that typechecks', () => {
  // Guards the discovery above: an empty or truncated fixture list would make every row below
  // vacuously pass, and the suite would report success having compiled nothing.
  test('there are fixtures to compile', () => {
    expect(fixtureNames.length).toBeGreaterThanOrEqual(7);
  });

  test.each(fixtureNames)('%s', (name) => {
    expect(typecheckEmittedApp(emitFixture(name))).toEqual([]);
  });
});

/**
 * 🔴 The control arm. A checker that cannot go red grades nothing, and this one is only credible
 * beside a defect it demonstrably catches — so the sabotage lives in the suite permanently rather
 * than in a session's scratchpad.
 */
describe('the checker rejects what a parse accepts', () => {
  const app = emitFixture('cheer');
  const fileOf = (suffix: string) => {
    const found = Object.keys(app.files).find((f) => f.endsWith(suffix));
    if (!found) throw new Error(`no emitted file ending ${suffix}`);
    return found;
  };

  test('a name that is read and never declared is caught', () => {
    const target = fileOf('src/App.tsx');
    const sabotaged = app.files[target].replace('\n', '\nconst unreachable = neverDeclaredAnywhere;\n');
    expect(sabotaged).not.toBe(app.files[target]);

    const diagnostics = typecheckEmittedApp(app, { [target]: sabotaged });
    expect(diagnostics).toContainEqual(expect.stringContaining("Cannot find name 'neverDeclaredAnywhere'"));
  });

  test('§24.3 exactly: a state read whose useState declaration was dropped is caught', () => {
    // The shape the mutant produced — the read survives, the declaration does not.
    const target = Object.keys(app.files).find(
      (f) => f.endsWith('.tsx') && /const \[[A-Za-z0-9_]+, set[A-Za-z0-9_]+\] = useState/.test(app.files[f])
    );
    if (!target) throw new Error('no emitted component declares state with useState');

    const declaration = app.files[target].match(/^.*const \[([A-Za-z0-9_]+), set[A-Za-z0-9_]+\] = useState.*$/m)!;
    const stateName = declaration[1];
    const sabotaged = app.files[target].replace(declaration[0] + '\n', '');
    expect(sabotaged).not.toBe(app.files[target]);

    const diagnostics = typecheckEmittedApp(app, { [target]: sabotaged });
    expect(diagnostics).toContainEqual(expect.stringContaining(`Cannot find name '${stateName}'`));
  });

  test('the same sabotage still parses, which is why the parse rows missed it', () => {
    const target = fileOf('src/App.tsx');
    const sabotaged = app.files[target].replace('\n', '\nconst unreachable = neverDeclaredAnywhere;\n');
    const sourceFile = ts.createSourceFile(target, sabotaged, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    const parseDiagnostics = (sourceFile as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(parseDiagnostics).toEqual([]);
  });
});
