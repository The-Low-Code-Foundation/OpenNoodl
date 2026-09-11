/**
 * SUB-011 — Object-valued (inline expression) parameters through the v2 format
 *
 * The shipped `fx` toggle turns a stored parameter from a primitive into
 * `{mode: 'expression', expression, fallback, version}` on a port still typed
 * `string`/`number`. SUB-002's corpus carried no fixture of that object form, so
 * its round-trip fidelity was *untested* rather than proven — and a future
 * normalisation or typed-serialisation pass that mishandled it would mangle user
 * expressions silently, the exact loss class SUB-002 exists to prevent.
 *
 * This file is the fixture half of SUB-011 only. The "embrace vs freeze" posture
 * decision is deliberately NOT taken here — it defines what a valid graph is and
 * is recorded in the task spec, not in a test.
 *
 * The fixture leans on what a careless pass would eat:
 *   - falsy fallbacks (`0`, `""`, `false`, `null`) — anything written as
 *     `fallback || default` loses these
 *   - an absent `fallback` key, and an absent `version`
 *   - expressions containing quotes, backticks, `${}`, backslashes, tabs,
 *     newlines, `</script>`, emoji and unicode
 *   - a structured (nested object/array) fallback
 *   - an unknown future `version`
 *   - the object form inside the OTHER parameter bags: `stateParameters` and
 *     variant `parameters`/`stateParamaters` (note the model's historical
 *     misspelling), which travel different exporter paths from node parameters
 *
 * Result at the time of writing: no loss. Whole-object round-trip is clean and
 * the semantic validator is silent. These specs pin that down.
 *
 * Uses Jasmine matchers (Electron runner).
 */

import { ProjectExporter, LegacyProject, LegacyNode, legacyNameToPath } from '../../src/editor/src/io/ProjectExporter';
import { ProjectImporter, ImportInput } from '../../src/editor/src/io/ProjectImporter';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File
} from '../../src/editor/src/schemas';
import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { formatDiagnosticLine } from '../../src/editor/src/validation/diagnostics';
import { fromLegacyProject, LegacyProjectLike } from '../../src/editor/src/validation/normalize';
import { contentAt } from './v2-files';

/* eslint-disable @typescript-eslint/no-var-requires */
const fixture = require('./fixtures/expression-parameters.project.json') as LegacyProject;
/* eslint-enable @typescript-eslint/no-var-requires */

/** Export to v2 files, import straight back — the same bridge SUB-002 uses. */
function roundTrip(project: LegacyProject): LegacyProject {
  const result = new ProjectExporter().export(project);
  const components: ImportInput['components'] = {};
  for (const comp of project.components) {
    const compPath = legacyNameToPath(comp.name);
    const component = contentAt<ComponentV2File>(result, `components/${compPath}/component.json`);
    const nodes = contentAt<NodesV2File>(result, `components/${compPath}/nodes.json`);
    const connections = contentAt<ConnectionsV2File>(result, `components/${compPath}/connections.json`);
    if (component && nodes && connections) components[compPath] = { component, nodes, connections };
  }
  const routes = contentAt<RoutesV2File>(result, 'nodegx.routes.json');
  const styles = contentAt<StylesV2File>(result, 'nodegx.styles.json');
  const input: ImportInput = {
    project: contentAt<ProjectV2File>(result, 'nodegx.project.json'),
    registry: contentAt<RegistryV2File>(result, 'components/_registry.json'),
    ...(routes ? { routes } : {}),
    ...(styles ? { styles } : {}),
    components
  };
  return new ProjectImporter().import(input).project;
}

/** Flatten a legacy graph to an id→node map. */
function nodesById(project: LegacyProject): Map<string, LegacyNode> {
  const map = new Map<string, LegacyNode>();
  const visit = (nodes: LegacyNode[] | undefined): void => {
    for (const n of nodes ?? []) {
      // Braces, not an implicit return: `Map.set` returns the map, and a truthy
      // return means "stop" to this codebase's recursive walkers.
      map.set(n.id, n);
      visit(n.children);
    }
  };
  visit(project.components[0].graph.roots);
  return map;
}

/**
 * The object form of a parameter — the shape this suite exists to guard.
 * `fallback` is `unknown` rather than absent because it is legitimately falsy in
 * one fixture (0, '', false and null all have to survive), and optional because
 * another fixture omits it entirely. `version` comes from the
 * forward-compatibility fixture.
 */
interface ExpressionParameter {
  mode: string;
  expression: string;
  fallback?: unknown;
  version?: number;
}

/**
 * A parameter bag mixes the object form with ordinary literals — `expr-mixed-with-plain`
 * carries both on one node, which is the whole point of that fixture.
 */
type ParameterBag = Record<string, ExpressionParameter | string | number | boolean | null>;

function params(node: LegacyNode | undefined): ParameterBag {
  return (node?.parameters ?? {}) as ParameterBag;
}

/**
 * Narrow a bag entry to the object form.
 *
 * This throws rather than casting, and the throw is the point: if a round-trip ever
 * flattens an expression parameter back to a bare value, every assertion downstream
 * of it would otherwise read `undefined` and this suite would report a confusing
 * `expected undefined to be 'expression'`. Failing here names the actual defect.
 */
function expr(bag: ParameterBag, port: string): ExpressionParameter {
  const value = bag[port];
  if (value === null || typeof value !== 'object') {
    throw new Error(
      `parameter "${port}" is not the object form — got ${JSON.stringify(value)}. The round-trip flattened it.`
    );
  }
  return value;
}

describe('SUB-011 expression parameters — v2 round-trip', () => {
  const before = nodesById(fixture);
  const after = nodesById(roundTrip(fixture));

  it('the fixture really does carry the object form (guard against a vacuous suite)', () => {
    const p = expr(params(before.get('expr-string-port')), 'text');
    expect(p.mode).toBe('expression');
    expect(typeof p.expression).toBe('string');
    expect(before.size).toBe(10);
  });

  it('keeps every node', () => {
    expect(after.size).toBe(before.size);
  });

  it('preserves an expression parameter whole, on a string port', () => {
    expect(params(after.get('expr-string-port')).text).toEqual(params(before.get('expr-string-port')).text);
    expect(expr(params(after.get('expr-string-port')), 'text').expression).toBe(
      "Variables.firstName + ' ' + Variables.lastName"
    );
  });

  it('preserves an expression parameter whole, on a number port', () => {
    expect(params(after.get('expr-number-port')).fontSize).toEqual(params(before.get('expr-number-port')).fontSize);
  });

  it('preserves falsy fallbacks — 0, "", false and null all survive', () => {
    const out = params(after.get('expr-falsy-fallbacks'));
    expect(expr(out, 'text').fallback).toBe('');
    expect(expr(out, 'fontSize').fallback).toBe(0);
    expect(expr(out, 'visible').fallback).toBe(false);
    expect(expr(out, 'opacity').fallback).toBe(null);
    // and nothing invented one where there was none
    expect(out).toEqual(params(before.get('expr-falsy-fallbacks')));
  });

  it('does not invent a fallback or version where the author omitted them', () => {
    const out = expr(params(after.get('expr-no-fallback')), 'text');
    expect(out).toEqual({ mode: 'expression', expression: 'Variables.bare' });
    expect('fallback' in out).toBe(false);
    expect('version' in out).toBe(false);
  });

  it('preserves expressions containing quotes, backticks, escapes, markup and unicode', () => {
    const src = expr(params(before.get('expr-special-chars')), 'text');
    const out = expr(params(after.get('expr-special-chars')), 'text');
    expect(out).toEqual(src);
    // Spot-check the characters most likely to be eaten by a naive escape pass.
    expect(out.expression).toContain('`tpl ${Variables.x}`');
    // Two literal backslashes: the expression *source* escapes one.
    expect(out.expression).toContain('back\\\\slash');
    expect(out.expression).toContain('</script>');
    expect(out.expression).toContain('emoji 🎛 ünïcode');
    expect(out.fallback).toContain('\n');
  });

  it('preserves a structured (nested object/array) fallback', () => {
    const out = expr(params(after.get('expr-object-fallback')), 'text');
    expect(out.fallback).toEqual({ nested: { deep: [1, 2, { three: true }] }, list: ['a', 'b'] });
  });

  it('preserves an unknown future version rather than rewriting it', () => {
    expect(expr(params(after.get('expr-future-version')), 'text').version).toBe(99);
  });

  it('keeps expression and plain parameters side by side on one node', () => {
    const out = params(after.get('expr-mixed-with-plain'));
    expect(out).toEqual(params(before.get('expr-mixed-with-plain')));
    // ⚠️ `textAlignX`, not `textAlign`: Text declares `textAlignX`/`textAlignY`
    // and `textAlign` is only the CSS property the node sets internally, so the
    // original fixture set a parameter nothing reads. It stood in for "a plain
    // parameter beside an expression one" and a real port serves that better —
    // the same dead parameter §2b⁗ found in noodl-preview's fixture.
    expect(out.textAlignX).toBe('center');
    expect(out.fontSize).toBe(18);
    expect(expr(out, 'text').mode).toBe('expression');
  });

  it('preserves the object form inside stateParameters', () => {
    const out = after.get('expr-in-state-bags');
    expect(out.stateParameters).toEqual(before.get('expr-in-state-bags').stateParameters);
    expect(expr((out.stateParameters as Record<string, ParameterBag>).hover, 'fontSize').fallback).toBe(0);
  });

  it('preserves the object form inside variant parameters', () => {
    const out = roundTrip(fixture);
    expect(out.variants).toEqual(fixture.variants);
    expect(expr(out.variants![0].parameters as ParameterBag, 'text').mode).toBe('expression');
  });
});

describe('SUB-011 expression parameters — the validator stays silent', () => {
  it('emits no diagnostics at all on a project full of expression parameters', () => {
    const report = new SemanticValidator().validate(fromLegacyProject(fixture as LegacyProjectLike));
    if (report.diagnostics.length > 0) {
      fail(`Expected silence, got:\n${report.diagnostics.map(formatDiagnosticLine).join('\n')}`);
    }
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });

  it('stays silent in strict mode too', () => {
    const report = new SemanticValidator().validate(fromLegacyProject(fixture as LegacyProjectLike), { strict: true });
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });

  it('is still silent after a round-trip (normalisation did not create findings)', () => {
    const report = new SemanticValidator().validate(fromLegacyProject(roundTrip(fixture) as LegacyProjectLike), {
      strict: true
    });
    expect(report.summary.errors).toBe(0);
    expect(report.summary.warnings).toBe(0);
  });
});
