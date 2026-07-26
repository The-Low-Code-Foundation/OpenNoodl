/**
 * WF-002 step-kind catalog COVERAGE GATE.
 *
 * SUB-004's node catalog is generated from the live node registers and gated by
 * `catalog:check`; SUB-005's enrichment is gated by `catalog:merge:check
 * --require-coverage`, which fails CI if a node ships without documentation.
 * A workflow step kind is not a canvas node and cannot enter either artifact
 * (see WF-002-NOTES.md), so this suite is the local equivalent of that gate.
 *
 * It fails if a step kind is:
 *   - implemented but missing from the spec table, or specced but not
 *     implemented (the two must be the same set as the StepKind union),
 *   - specced but not documented in docs/runtime/WORKFLOW-NODES.md,
 *   - specced without the fields an author or an agent needs to use it.
 *
 * A kind that ships invisible to the validator and the authoring loop is the
 * failure this exists to prevent.
 */
import * as fs from 'fs';
import * as path from 'path';

import { CompositeStepExecutor } from '../src/workflow/steps/CompositeStepExecutor';
import { STEP_KINDS, STEP_KIND_SPECS, stepKindCatalog, isStepKind } from '../src/workflow/steps/kinds';
import type { WorkflowRunner } from '../src/workflow/WorkflowRunner';

const DOC = path.resolve(__dirname, '../../../docs/runtime/WORKFLOW-NODES.md');

const EXPECTED_KINDS = [
  'call-function',
  'branch',
  'switch',
  'for-each',
  'merge',
  'retry',
  'stop',
  'wait',
  'wait-until'
];

describe('WF-002 step-kind catalog coverage', () => {
  it('the spec table and the StepKind union are the same set', () => {
    // If this fails you added a kind to types.ts (or the table) and not the
    // other. TypeScript enforces the Record<StepKind, ...> half; this catches
    // the reverse and pins the intended list.
    expect([...STEP_KINDS].sort()).toEqual([...EXPECTED_KINDS].sort());
    for (const k of EXPECTED_KINDS) expect(isStepKind(k)).toBe(true);
    expect(isStepKind('try-catch')).toBe(false);
  });

  it('every specced kind has an executor, and every executor has a spec', () => {
    const executor = new CompositeStepExecutor({ getRunner: () => null as unknown as WorkflowRunner });
    expect([...executor.kinds()].sort()).toEqual([...STEP_KINDS].sort());
  });

  it('every kind carries the fields an author or an agent needs', () => {
    for (const kind of STEP_KINDS) {
      const spec = STEP_KIND_SPECS[kind];
      expect(spec.kind).toBe(kind);
      expect(spec.displayName.length).toBeGreaterThan(0);
      expect(spec.category.length).toBeGreaterThan(0);
      // Traceability back to the phase-11 spec (or WF-001) that specified it.
      expect(spec.source).toMatch(/^(CF11-00[123]|WF-001)$/);
      // A summary must be a sentence, not a label — and short enough to skim,
      // mirroring the enrichment corpus's 140-char rule.
      expect(spec.summary.length).toBeGreaterThan(20);
      expect(spec.summary.length).toBeLessThanOrEqual(140);
      expect(spec.whenToUse.length).toBeGreaterThan(40);
      expect(spec.output.length).toBeGreaterThan(10);
      for (const p of spec.params) {
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.description.length).toBeGreaterThan(10);
      }
      for (const r of spec.routes) expect(r.description.length).toBeGreaterThan(5);
    }
  });

  it('function-invoking kinds are exactly the ones that take a ref', () => {
    const invoking = STEP_KINDS.filter((k) => STEP_KIND_SPECS[k].invokesFunction);
    expect([...invoking].sort()).toEqual(['call-function', 'for-each', 'retry']);
  });

  it('the served catalog is complete and self-describing', () => {
    const catalog = stepKindCatalog();
    expect(catalog.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(catalog.docs).toBe('docs/runtime/WORKFLOW-NODES.md');
    expect(catalog.kinds.map((k) => k.kind)).toEqual(STEP_KINDS);
    // It must survive the wire: the whole point is that an agent reads it.
    expect(JSON.parse(JSON.stringify(catalog)).kinds).toHaveLength(STEP_KINDS.length);
  });
});

describe('WF-002 author documentation coverage', () => {
  const doc = fs.readFileSync(DOC, 'utf-8');

  it('documents every step kind under its own heading', () => {
    for (const kind of STEP_KINDS) {
      expect(doc).toContain(`### \`${kind}\``);
    }
  });

  it('documents every route name and every param of every kind', () => {
    for (const kind of STEP_KINDS) {
      const spec = STEP_KIND_SPECS[kind];
      for (const route of spec.routes) {
        if (route.dynamic) continue; // switch case labels are user-chosen
        expect(doc).toContain(route.name);
      }
      for (const param of spec.params) {
        if (param.name === 'ref') continue; // a step field, documented once
        expect(doc).toContain(`\`${param.name}\``);
      }
    }
  });

  it('carries the cost warning that makes server-side waiting honest', () => {
    // CF11-003's brief specifically required the server-side cost of waiting to
    // be explicit in the node's own documentation, not assumed.
    expect(doc).toMatch(/holds a concurrency slot/i);
    expect(doc).toMatch(/24-hour ceiling|24h cap/i);
    expect(doc).toMatch(/schedule\s+trigger/i);
  });

  it('explains why these are absent from the node catalog', () => {
    expect(doc).toMatch(/not in the node catalog|not a canvas node/i);
  });
});
