/**
 * LIB-006 — the acceptance fixtures, end to end against the REAL catalog.
 *
 * Two projects, and the difference between them is the honest half of the task's
 * fourth risk ("no genuinely old project is available to test against"):
 *
 * - `real-noodl-form` is a genuine Noodl 2.x project — the `form` prefab from the
 *   Noodl docs library, snapshotted before phase 21's overhaul touches it. It is
 *   the answer to "does a real legacy project import?" and the answer is yes,
 *   cleanly. That is a finding about the product, not a gap in the test.
 * - `synthetic-unconvertible` is exactly what its name says. **No genuinely-old
 *   project in this repo exercises the placeholder path**, because PLAT-003 kept
 *   every deprecated node registered and nothing legacy was ever deleted. So the
 *   only way to exercise that code is a project written to exercise it, and
 *   saying so plainly beats calling a synthetic run "verified".
 *
 * Both committed reports are regenerated with `UPDATE_LIB006_FIXTURES=1`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { assess } from '../../src/editor/src/utils/import-engine/legacy/assess';
import { defaultCatalogQuery } from '../../src/editor/src/utils/import-engine/legacy/catalogQuery';
import { buildReport, renderReportMarkdown } from '../../src/editor/src/utils/import-engine/legacy/report';
import type { ImportReport, LegacyOutcome } from '../../src/editor/src/utils/import-engine/legacy/types';
import type { ProjectData } from '../../src/editor/src/utils/import-engine/types';

const FIXTURES = path.resolve(__dirname, '../../../../dev-docs/qa-fixtures/legacy-import');
const NOW = new Date('2026-08-02T00:00:00.000Z');
const UPDATE = process.env.UPDATE_LIB006_FIXTURES === '1';

/** The React 18→19 set, restated minimally — the real one pulls @noodl/platform. */
const CODE_PATTERNS = [
  { name: 'findDOMNode', description: 'use a ref instead', test: (c: string) => /\bfindDOMNode\s*\(/.test(c) }
];

function runFixture(name: string, modulesTravelWithImport: boolean): ImportReport {
  const dir = path.join(FIXTURES, name);
  const project = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')) as ProjectData;
  const { findings, constructsAssessed, nodeCount } = assess({
    sourceDir: dir,
    project,
    catalog: defaultCatalogQuery(),
    modulesTravelWithImport,
    codePatterns: CODE_PATTERNS
  });
  const report = buildReport({
    sourceDir: `<fixture>/${name}`,
    sourceProjectName: project.name,
    sourceProjectVersion: project.version === undefined ? undefined : String(project.version),
    findings,
    constructsAssessed,
    nodeCount,
    now: NOW
  });

  const markdownPath = path.join(dir, 'IMPORT-REPORT.md');
  const markdown = renderReportMarkdown(report);
  if (UPDATE) {
    fs.writeFileSync(markdownPath, markdown);
    fs.writeFileSync(path.join(dir, 'import-report.json'), JSON.stringify(report, null, 2) + '\n');
  } else {
    // The committed artifact is the acceptance evidence. If this fails, either
    // the assessment changed or the catalog did — both are worth a human look.
    expect(markdown).toBe(fs.readFileSync(markdownPath, 'utf8'));
  }

  return report;
}

function sumCounts(counts: Record<LegacyOutcome, number>): number {
  return counts.converted + counts['converted-with-changes'] + counts.placeholder + counts.dropped;
}

// ─── The real legacy project ─────────────────────────────────────────────────

describe('fixture: a genuine Noodl 2.x project (the `form` prefab)', () => {
  let report: ImportReport;
  beforeAll(() => {
    report = runFixture('real-noodl-form', false);
  });

  it('accounts for every construct — the no-silent-drops criterion', () => {
    expect(sumCounts(report.counts)).toBe(report.coverage.constructsAssessed);
    expect(report.coverage.constructsAssessed).toBeGreaterThan(50);
  });

  it('imports cleanly — which is the headline finding, not a weak test', () => {
    // PLAT-003 kept every deprecated node registered and nothing legacy was ever
    // deleted, so a Noodl 2.x graph resolves almost in full. If this ever starts
    // failing, a node type was removed and the inventory table needs updating.
    expect(report.counts.placeholder).toBe(0);
    expect(report.verdict.recommendation).toBe('proceed');
    expect(report.verdict.fidelity).toBe(1);
  });

  it('gives an assistant nothing to do, and says so rather than inventing work', () => {
    expect(report.handoff.repairable).toEqual([]);
    expect(report.handoff.unrepairable).toEqual([]);
  });
});

// ─── The synthetic one ───────────────────────────────────────────────────────

describe('fixture: synthetic unconvertible constructs', () => {
  let report: ImportReport;
  beforeAll(() => {
    report = runFixture('synthetic-unconvertible', false);
  });

  it('accounts for every construct', () => {
    expect(sumCounts(report.counts)).toBe(report.coverage.constructsAssessed);
  });

  it('placeholders the removed BYOB types and the module type nothing provides', () => {
    const placeholders = report.findings.filter((f) => f.outcome === 'placeholder');
    expect(placeholders.map((f) => f.original).sort()).toEqual([
      'SomeModuleProvidedNode',
      'noodl.byob.CreateRecord',
      'noodl.byob.QueryData',
      'noodl.byob.SubscribeToChanges'
    ]);
  });

  it('converts the script-free REST node and leaves the scripted one alone', () => {
    const rest = report.findings.filter((f) => f.original === 'REST2');
    expect(rest.map((f) => f.reason).sort()).toEqual(['rest-has-scripts', 'rest-to-http']);
  });

  it('reports both silent project-field drops', () => {
    const dropped = report.findings.filter((f) => f.outcome === 'dropped').map((f) => f.original);
    expect(dropped.sort()).toEqual(['deviceSettings', 'thumbnailURI']);
  });

  it('reports the version upgrade, the root rewrite and the external backend', () => {
    const reasons = report.findings.map((f) => f.reason);
    expect(reasons).toContain('project-version-upgraded');
    expect(reasons).toContain('root-component-to-node-id');
    expect(reasons).toContain('external-backend-unverified');
  });

  it('flags the React 19 removal without touching the code', () => {
    const code = report.findings.find((f) => f.kind === 'user-code');
    expect(code?.outcome).toBe('converted');
    expect(code?.location?.parameter).toBe('functionScript');
  });

  it('notes the deprecated Label once, aggregated, and does not rewrite it', () => {
    const label = report.findings.find((f) => f.original === 'Label');
    expect(label?.reason).toBe('type-deprecated');
    expect(label?.outcome).toBe('converted');
    expect(label?.converted).toBeUndefined();
  });

  it('recommends rebuilding: this project is small and largely unconverted', () => {
    expect(report.verdict.recommendation).toBe('rebuild');
  });

  it('hands the assistant a split it can act on', () => {
    // Four placeholders + two drops. Everything with a known equivalent is
    // repairable; the rest is honestly listed as a rebuild.
    expect(report.handoff.repairable.length).toBeGreaterThan(0);
    expect(report.handoff.unrepairable.length).toBeGreaterThan(0);
    expect(report.handoff.catalogTypes).toContain('DbCollection2');
  });

  it('changes classification when a module travels with the import', () => {
    // The hinge documented on AssessInput, exercised against the real catalog.
    const withModules = assess({
      sourceDir: '/x',
      project: JSON.parse(
        fs.readFileSync(path.join(FIXTURES, 'synthetic-unconvertible', 'project.json'), 'utf8')
      ) as ProjectData,
      catalog: defaultCatalogQuery(),
      modulesTravelWithImport: true
    });
    const moduleNode = withModules.findings.find((f) => f.original === 'SomeModuleProvidedNode');
    expect(moduleNode?.outcome).toBe('converted');
    expect(moduleNode?.reason).toBe('type-module-provided');
  });
});
