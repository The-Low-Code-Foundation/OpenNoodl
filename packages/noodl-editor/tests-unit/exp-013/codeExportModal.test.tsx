/**
 * EXP-013 AC2/AC3/AC4 — the pre-flight modal names nodes, separates the two numbers, and leads
 * with the verdict when a cascade costs a pathway.
 *
 * ## Graded on two fixtures, through the real exporter
 *
 * `task-desk` (a button → `Run Tasks` → `Cloud Function` → `Navigate`, and `Run Tasks` → `Set
 * Variable`) trips the verdict: one root, five silenced, two of them pathways. `quiet-desk` (the
 * same shape with only the `Set Variable` behind the root) does not. Both summaries come from
 * `parseProject → emitApp → summarizePreflight` on the fixture directories, imported by relative
 * path into the exporter's source — so the modal is graded on the rows the product hands it, not
 * on rows this file invents. A hand-built summary would pass against a modal that read a field
 * the exporter never fills.
 *
 * ⚠️ The exporter is compiled by ts-jest under the editor's (non-strict) tsconfig, exactly as the
 * editor bundle compiles it (EXP-012). That is a few seconds, and it is the price of the claim.
 *
 * The modal calls no hooks, so it is evaluated as an element tree (`support/renderElements`).
 */

import * as fs from 'fs';
import * as path from 'path';
import React from 'react';

import { parseProject } from '../../../nodegx-export/src/parse/parseProject';
import { emitApp } from '../../../nodegx-export/src/emit/emitApp';
import { summarizePreflight } from '../../../nodegx-export/src/emit/preflight';
import { CodeExportModal, confirmLabel } from '../../src/editor/src/views/PopupLayer/CodeExportModal';
import { alphaNotice } from '../../../nodegx-export/src/ledger';
import { render, text, walk } from '../support/renderElements';

import type { Catalog } from '../../../nodegx-export/src/catalog';
import type { PreflightSummary } from '../../../nodegx-export/src/emit/preflight';

const ROOT = path.join(__dirname, '..', '..', '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'noodl-types', 'src', 'node-catalog.json'), 'utf8')) as Catalog;
const summaryOf = (fixture: string): PreflightSummary =>
  summarizePreflight(emitApp(parseProject(path.join(ROOT, 'nodegx-export', 'tests', 'fixtures', fixture), catalog), catalog));

const trips = summaryOf('task-desk');
const quiet = summaryOf('quiet-desk');
const noop = () => undefined;

const byTest = (tree: ReturnType<typeof render>, name: string) => walk(tree).filter((n) => n.props['data-test'] === name);

describe('the fixtures are the shapes the file claims (asserted, not assumed)', () => {
  test('task-desk: one root, five silenced, a pathway lost', () => {
    expect(trips.cascade.roots).toHaveLength(1);
    expect(trips.cascade.unsilenced).toBe(1);
    expect(trips.cascade.silenced).toBe(5);
    expect(trips.verdict).not.toBeNull();
  });

  test('quiet-desk: one root, three silenced, nothing that is a pathway', () => {
    expect(quiet.cascade.roots).toHaveLength(1);
    expect(quiet.cascade.silenced).toBe(3);
    expect(quiet.cascade.pathway).toEqual([]);
    expect(quiet.verdict).toBeNull();
  });
});

describe('the alpha notice (0.2.2) — on every pre-flight, whatever the summary says', () => {
  test('both fixtures and the clean summary carry the one sentence, with the ledger\'s number', () => {
    const clean: PreflightSummary = {
      ...quiet,
      refusals: 0,
      attention: [],
      noFile: [],
      cascade: { roots: [], unsilenced: 0, silenced: 0, pathway: [] },
      verdict: null
    };
    for (const s of [trips, quiet, clean]) {
      const tree = render(<CodeExportModal summary={s} onConfirm={noop} onCancel={noop} />);
      const alpha = byTest(tree, 'code-export-alpha');
      expect(alpha).toHaveLength(1);
      expect(text(alpha[0])).toBe(alphaNotice());
      expect(text(alpha[0])).toMatch(/Code export is in alpha\. \d+ of the \d+ nodes you can place export today \(\d+%\)/);
      // Above the verdict and the counts: it is the first thing said after "nothing written yet".
      const all = text(tree);
      expect(all.indexOf('Code export is in alpha')).toBeLessThan(all.indexOf('will not translate') === -1 ? all.length : all.indexOf('will not translate'));
    }
  });
});

describe('AC4 — the verdict leads, and the button changes with it', () => {
  test('task-desk leads with the pathway sentence naming the root', () => {
    const tree = render(<CodeExportModal summary={trips} onConfirm={noop} onCancel={noop} />);
    const verdict = byTest(tree, 'code-export-verdict');
    expect(verdict).toHaveLength(1);
    const sentence = text(verdict[0]);
    expect(sentence).toContain('This export would be missing a pathway, not a node');
    expect(sentence).toContain('"Run the batch" (Run Tasks)');
    expect(sentence).toContain('"Sync tasks" (Cloud Function)');
    expect(sentence).toContain('"Go home" (Navigate)');
    expect(sentence).toContain('Replace it or wait for a release that translates it.');
    // The verdict comes before the count — it is the first paragraph after the file line.
    const all = text(tree);
    expect(all.indexOf('missing a pathway')).toBeLessThan(all.indexOf('will not translate'));
  });

  test('quiet-desk has no verdict paragraph at all — the control', () => {
    const tree = render(<CodeExportModal summary={quiet} onConfirm={noop} onCancel={noop} />);
    expect(byTest(tree, 'code-export-verdict')).toHaveLength(0);
    expect(text(tree)).not.toContain('missing a pathway');
  });

  test('the confirm button says "anyway" only when a pathway is missing', () => {
    expect(confirmLabel(trips)).toBe('Export anyway — choose folder…');
    expect(confirmLabel(quiet)).toBe('Choose folder and export…');
    const button = (s: PreflightSummary) =>
      text(byTest(render(<CodeExportModal summary={s} onConfirm={noop} onCancel={noop} />), 'code-export-choose-folder')[0]);
    expect(button(trips)).toBe('Export anyway — choose folder…');
    expect(button(quiet)).toBe('Choose folder and export…');
  });
});

describe('AC3 — the two numbers, separated', () => {
  test('task-desk reads 1 + 5, never 6', () => {
    const tree = render(<CodeExportModal summary={trips} onConfirm={noop} onCancel={noop} />);
    const headline = text(byTest(tree, 'code-export-cascade')[0]);
    expect(headline).toContain('1 node the export has no rule for, and 5 more left out only because it fires them.');
    expect(headline).not.toContain('6 node');
    const roots = byTest(tree, 'code-export-root');
    expect(roots).toHaveLength(1);
    expect(text(roots[0])).toContain('"Run the batch" (Run Tasks)');
    expect(text(roots[0])).toContain('5 nodes are left out only because this one fires them');
  });

  test('quiet-desk reads 1 + 3', () => {
    const tree = render(<CodeExportModal summary={quiet} onConfirm={noop} onCancel={noop} />);
    expect(text(byTest(tree, 'code-export-cascade')[0])).toContain('1 node the export has no rule for, and 3 more');
  });

  test('the total line still counts every line the report prints, and says so', () => {
    const tree = render(<CodeExportModal summary={trips} onConfirm={noop} onCancel={noop} />);
    // `text()` prints a node's own text before its children's, so the `<strong>` boundary splits
    // the sentence; both halves are asserted, in the order they are rendered.
    const all = text(tree);
    expect(all).toContain(`${trips.refusals} things will not translate`);
    expect(all).toContain(' in all. Each is a node, wire, parameter');
  });
});

describe('AC2 — the nodes by type and label, under their component', () => {
  test('every refused node of task-desk is named, with the root marked as silencing the rest', () => {
    const tree = render(<CodeExportModal summary={trips} onConfirm={noop} onCancel={noop} />);
    const rows = byTest(tree, 'code-export-node').map(text);
    // One row per node the export has no rule for; the silenced ones ride on its row.
    expect(rows).toHaveLength(1);
    // §53 translated Run Tasks; the fixture's one names no Template, which is now the refusal's own sentence.
    expect(rows[0]).toContain('"Run the batch" (Run Tasks) — it names no Template component');
    for (const name of ['"Sync tasks" (Cloud Function)', '"Go home" (Navigate)', '"Mark finished" (Set Variable)', '"finished" (String)', '"status" (Variable)']) {
      expect(rows[0]).toContain(name);
    }
    expect(text(tree)).toContain('Pages/Tasks');
  });

  test('a summary with no refusals draws none of the EXP-013 surfaces', () => {
    const clean: PreflightSummary = {
      ...quiet,
      refusals: 0,
      attention: [],
      noFile: [],
      cascade: { roots: [], unsilenced: 0, silenced: 0, pathway: [] },
      verdict: null
    };
    const tree = render(<CodeExportModal summary={clean} onConfirm={noop} onCancel={noop} />);
    expect(byTest(tree, 'code-export-cascade')).toHaveLength(0);
    expect(byTest(tree, 'code-export-node')).toHaveLength(0);
    expect(text(tree)).toContain('Everything translates.');
  });
});
