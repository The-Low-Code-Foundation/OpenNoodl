/**
 * AIB-001 — the parameter-value rule, run over every real project in the repo.
 *
 * A validation rule is only as good as its false-positive rate, and this one
 * has a worse-than-usual failure mode: its diagnostics feed an *automated*
 * repair round, so a rule that rejects a legitimate value spends the user's
 * money making the candidate worse, and on an update it can make a component
 * permanently unrevisable (the agent is told never to argue with a diagnostic).
 *
 * So the rule's shape was derived from this corpus rather than from the port
 * type names — which is how two of AIB-001's own stated wire formats turned out
 * to be wrong. A `dimension` is not `"100px"` and a units-typed `number` is not
 * a bare number: both are `{ value, unit }` objects in every one of the 462 and
 * 3,127 real occurrences.
 *
 * The corpus is the shipped prefabs, modules, examples and test fixtures. It is
 * legacy content, so a small number of genuine findings is expected and named
 * below; what must not happen is the number growing quietly.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkParameterValues } from '../../src/editor/src/validation/parameterValues';
import type { Diagnostic } from '../../src/editor/src/validation/diagnostics';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const REPO = path.resolve(__dirname, '../../../..');

interface LegacyNode {
  id?: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: LegacyNode[];
}

function flatten(roots: LegacyNode[] | undefined, into: ParameterizedNode[]): ParameterizedNode[] {
  for (const node of roots ?? []) {
    into.push({
      id: node.id ?? '?',
      type: node.type,
      ...(node.label ? { label: node.label } : {}),
      parameters: node.parameters ?? null
    });
    flatten(node.children, into);
  }
  return into;
}

function projectFiles(): string[] {
  const out = execFileSync(
    'find',
    [REPO, '-name', 'project.json', '-not', '-path', '*/node_modules/*'],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  return out.split('\n').filter(Boolean);
}

interface CorpusResult {
  parametersChecked: number;
  diagnostics: Diagnostic[];
}

function runCorpus(): CorpusResult {
  const catalog = loadDefaultCatalog();
  const diagnostics: Diagnostic[] = [];
  let parametersChecked = 0;

  for (const file of projectFiles()) {
    let project: { components?: Array<{ name?: string; graph?: { roots?: LegacyNode[] } }> };
    try {
      project = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // a fixture that is deliberately malformed is not this rule's business
    }
    for (const component of project.components ?? []) {
      const nodes = flatten(component.graph?.roots, []);
      for (const node of nodes) parametersChecked += Object.keys(node.parameters ?? {}).length;
      diagnostics.push(
        ...checkParameterValues(nodes, catalog, {
          component: `${path.relative(REPO, file)}::${component.name ?? '?'}`
        })
      );
    }
  }
  return { parametersChecked, diagnostics };
}

// One pass, shared — walking the corpus costs ~1s and every assertion below is
// about the same numbers.
const corpus = runCorpus();

/** A finding, collapsed to what it is *about* rather than which file it is in. */
function classOf(d: Diagnostic): string {
  return `${d.location.nodeType}.${d.location.port}`;
}

describe('the rule against every real project in the repository', () => {
  it('has a corpus worth measuring against', () => {
    // Guards the test itself: a `find` that returns nothing, or a schema drift
    // that empties `graph.roots`, would make every assertion below vacuously
    // true — which is exactly how a rule ships believing it was measured.
    expect(corpus.parametersChecked).toBeGreaterThan(3000);
  });

  it('errors on fewer than 0.5% of real parameter values', () => {
    const errors = corpus.diagnostics.filter((d) => d.severity === 'error');
    const rate = errors.length / corpus.parametersChecked;
    if (rate >= 0.005) {
      // Thrown rather than asserted so the failure names what regressed. A bare
      // `toBeLessThan` would report a ratio and leave the next reader to
      // rediscover which port type started crying wolf.
      throw new Error(
        `the rule now errors on ${errors.length}/${corpus.parametersChecked} real values ` +
          `(${(rate * 100).toFixed(2)}%): ${[...new Set(errors.map(classOf))].join(', ')}`
      );
    }
    expect(rate).toBeLessThan(0.005);
  });

  it('finds exactly the known legacy drift, and nothing else', () => {
    const errors = corpus.diagnostics.filter((d) => d.severity === 'error');
    // `childSize` was a Group/Text size mode that no longer exists in the enum.
    // These are real: the runtime falls back to a default and the prefab lays
    // out differently than its author intended. Correctly found, not fixed here.
    expect([...new Set(errors.map(classOf))].sort()).toEqual(['Text.sizeMode']);
  });

  it('warns about an unnamed port at most a handful of times', () => {
    const warnings = corpus.diagnostics.filter((d) => d.code === DiagnosticCode.UnknownParameter);
    // Every one of these is a legacy parameter name the current runtime dropped
    // and never reads: `image` became `src`, `fill` became `backgroundColor`,
    // `textAlign` became `textAlignX`, `fillMode` became `objectFit`, and `y`
    // was absolute positioning. None resolves against the shipped catalog under
    // any condition — checked port by port, not assumed.
    //
    // They surfaced when the exemption narrowed from "declares any dynamic
    // ports" to "ports are runtime-determined". The old rule was silent about
    // `Text`, `Group` and `Image` altogether, which is the whole population a
    // page is drawn from; the price of seeing `fontWeight` on a Text node is
    // seeing the legacy drift on these too, and the drift is real.
    expect([...new Set(warnings.map(classOf))].sort()).toEqual([
      'Drag.style',
      'Group.fill',
      'Group.scrollBehavior',
      'Group.scrollDirection',
      'Group.scrollMouseWheelEnabled',
      'Group.style',
      'Image.fillMode',
      'Image.image',
      'Image.style',
      'Image.y',
      'Text.style',
      'Text.textAlign',
      'Text.y'
    ]);
  });

  it('never reports a units-typed port, which is 3,589 of the corpus in object form', () => {
    // The single most dangerous false positive available to this rule: AIB-001
    // stated the wire formats for `number` and `dimension` as a bare number and
    // `"100px"`, and a rule written from that table would have rejected every
    // one of these.
    const unitsFindings = corpus.diagnostics.filter(
      (d) => d.code === DiagnosticCode.InvalidParameterValue && /\((number|dimension)\)/.test(d.message)
    );
    expect(unitsFindings).toEqual([]);
  });
});
