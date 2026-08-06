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
  'return',
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
      // Traceability back to the spec that specified it: phase 11, WF-001, or —
      // for a kind added after the fact — the phase-42 task that argued for it.
      expect(spec.source).toMatch(/^(CF11-00[123]|WF-001|CWF-00[1-9])$/);
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

  it('the value language is served whole, and survives the wire (WFA-003)', () => {
    // A param is only usable if a client knows what may go IN it. WFA-003 put
    // that in the same document as the kinds, for the same reason WF-002 served
    // the kinds at all: a bundled copy can disagree with the backend that will
    // execute the definition.
    const wire = JSON.parse(JSON.stringify(stepKindCatalog())) as ReturnType<typeof stepKindCatalog>;
    expect(wire.valueLanguage.forms.map((f) => f.form)).toEqual(['literal', '$path', '$literal']);
    expect(wire.valueLanguage.scope.map((s) => s.name)).toContain('upstream.<stepId>');
    expect(wire.valueLanguage.maxDepth).toBeGreaterThan(0);
    expect(wire.valueLanguage.payload.canonical.body).toBeTruthy();
    expect(wire.valueLanguage.pathRules.length).toBeGreaterThan(2);
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

  it('documents every value form and every scope name the catalog serves (WFA-003)', () => {
    // The drift this catches: adding a scope root (or a form) to the served spec
    // without telling an author it exists. The spec table and the page are the
    // two things a definition author reads, and they must agree.
    const { valueLanguage } = stepKindCatalog();
    for (const form of valueLanguage.forms) {
      if (form.form === 'literal') continue; // prose, not a token
      expect(doc).toContain(form.form);
    }
    for (const entry of valueLanguage.scope) {
      // Placeholders are documented under their pattern, not their literal text.
      const token = entry.name.startsWith('<') ? null : entry.name.replace('.<stepId>', '');
      if (token) expect(doc).toContain(`\`${token}`);
    }
    expect(doc).toContain('## Passing data between steps');
    // The one deprecated key that could not be preserved must be findable by
    // someone whose workflow just stopped seeing `payload.trigger` as a string.
    expect(doc).toMatch(/triggerType/);
  });

  it('documents every condition operator the catalog serves (WFA-004)', () => {
    // The workflow canvas builds its operator dropdown from the served
    // `conditionLanguage`, so an operator can now reach a user's screen without
    // anyone writing it down. Same drift, one surface further out.
    const { conditionLanguage } = stepKindCatalog();
    expect(conditionLanguage.ops.length).toBeGreaterThan(0);
    for (const op of conditionLanguage.ops) {
      expect(doc).toContain(`\`${op.name}\``);
      // A label is what the dropdown shows; a missing one would render an empty
      // option rather than fail anywhere.
      expect(op.label.length).toBeGreaterThan(0);
    }
    // Exactly the operators that take no right-hand operand, so the editor
    // hides the right-hand control for those and only those.
    const unary = conditionLanguage.ops.filter((o) => o.unary).map((o) => o.name).sort();
    expect(unary).toEqual(['empty', 'exists', 'falsy', 'notEmpty', 'notExists', 'truthy']);
  });

  it('tells an author how to build one on the canvas (WFA-004, F10)', () => {
    // F10: this page told authors to use "the Backend Services panel", a
    // surface that did not exist. A doc that names a surface has to name one
    // that is real.
    expect(doc).not.toMatch(/Author them:.*Backend Services panel/);
    expect(doc).toContain('Workflows panel');
    expect(doc).toContain('## Authoring one on the canvas');
    // The deploy interaction is the thing most likely to bite someone, so it
    // must be stated rather than left to be discovered.
    expect(doc).toMatch(/is not deployed with your app/i);
  });

  it('documents which params are DSL structures rather than values', () => {
    for (const kind of STEP_KINDS) {
      for (const param of STEP_KIND_SPECS[kind].params) {
        if (!param.raw) continue;
        expect(doc).toContain(`\`${param.name}\``);
      }
    }
    expect(doc).toMatch(/structures, not values|not a value/i);
  });
});
