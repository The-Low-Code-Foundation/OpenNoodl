import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

/**
 * Every emitted TypeScript file must **parse**.
 *
 * 🔴 This gate exists because a `toContain` assertion cannot fail on unparseable code, and one
 * did not. EXP-011 Tier 1.1's `Clear Array` emitted
 *
 *     if (notes.peek().length > 0) { notes.clear(); lastAction.set(x); }; else lastNoop.set(y);
 *
 * — an empty statement between a block and its `else`, which is a SyntaxError. Three tests
 * asserting the presence of `if (notes.peek().length > 0)`, `notes.clear()` and `else` all
 * passed on it, because every one of those substrings really was there. The defect was only
 * visible by reading the emitted file, and the same shape is latent in the `branch` emit.
 *
 * A parse is the weakest possible check that could have caught it, and it is cheap enough to run
 * over every fixture. It is not a substitute for `tsc` over a built app (the corpus harness does
 * that) — it is the floor beneath it, and it fails in one second rather than one minute.
 */

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

const FIXTURES = fs
  .readdirSync(path.join(__dirname, 'fixtures'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(__dirname, 'fixtures', e.name, 'nodegx.project.json')))
  .map((e) => e.name)
  .sort();

/** Syntax diagnostics only — an unresolved import is a different question and not this one's. */
const syntaxErrorsIn = (file: string, source: string): string[] => {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  // `parseDiagnostics` is not on the public SourceFile type, but it is the only place the parser
  // records what it could not read; a file with entries here did not parse.
  const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
  return diagnostics.map((d) => {
    const at = d.start === undefined ? '' : ` at ${JSON.stringify(source.slice(Math.max(0, d.start - 60), d.start + 60))}`;
    return `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}${at}`;
  });
};

describe.each(FIXTURES)('emitted source parses — %s', (fixture) => {
  const app = emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);
  const sources = Object.entries(app.files).filter(([p]) => p.endsWith('.ts') || p.endsWith('.tsx'));

  it('emits at least one TypeScript file', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('has no syntax errors in any emitted file', () => {
    const errors = sources.flatMap(([p, source]) => syntaxErrorsIn(p, source));
    expect(errors).toEqual([]);
  });
});

/**
 * The control pair the gate is only trustworthy with: the checker must **disagree** about a
 * known-good and a known-broken input. Without this a `syntaxErrorsIn` that always answered `[]`
 * — a wrong `parseDiagnostics` field name, say — would make every case above pass while checking
 * nothing at all.
 */
describe('the syntax gate itself', () => {
  it('passes the shape that replaced the defect', () => {
    expect(syntaxErrorsIn('good.ts', 'const f = () => { if (a.peek().length > 0) { a.clear(); b.set(1); } else c.set(2); };')).toEqual([]);
  });

  it('fails the exact shape that shipped', () => {
    expect(syntaxErrorsIn('bad.ts', 'const f = () => { if (x) { a(); b(); }; else c(); };').length).toBeGreaterThan(0);
  });
});
