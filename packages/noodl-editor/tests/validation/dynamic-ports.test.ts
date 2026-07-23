/**
 * SUB-006 — Dynamic-port false-positive guards
 *
 * These are written FIRST and matter MOST (see the task's testing plan). The
 * single greatest risk of a semantic validator is flagging ports that are
 * legitimately created at runtime — Function outputs, Expression inputs,
 * numbered And/Or inputs, conditionally-declared group ports. If any of these
 * produce a spurious error, real projects flood with noise and the tool is
 * abandoned.
 *
 * Every test here asserts NO error is produced for a runtime-determined port,
 * with a contrast test proving a genuinely-static node still errors (so the
 * guard suppresses false positives without suppressing true ones).
 *
 * Uses the real shipped catalog — the exact vocabulary end users validate against.
 */

import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { NormNode, NormProject, buildComponentRefs } from '../../src/editor/src/validation/model';

function node(id: string, type: string, extra: Partial<NormNode> = {}): NormNode {
  return { id, type, children: [], instancePorts: [], ...extra };
}

function project(nodes: NormNode[], connections: NormProject['components'][0]['connections']): NormProject {
  return {
    components: [{ name: '/#Test', nodes, connections }],
    componentRefs: buildComponentRefs(['/#Test'])
  };
}

function errorsOf(report: { diagnostics: { code: DiagnosticCode; severity: string }[] }) {
  return report.diagnostics.filter((d) => d.severity === 'error');
}

describe('SUB-006 dynamic-port guards', () => {
  const validator = new SemanticValidator();

  it('does NOT error on a runtime-discovered output (JavaScriptFunction)', () => {
    // Function outputs are created by user code — the catalog cannot know them.
    const p = project(
      [node('fn', 'JavaScriptFunction'), node('txt', 'Text')],
      [{ fromId: 'fn', fromProperty: 'myCustomOutput', toId: 'txt', toProperty: 'text' }]
    );
    expect(errorsOf(validator.validate(p)).length).toBe(0);
  });

  it('does NOT error on a runtime-discovered input (Expression free variable)', () => {
    // Expression "a + b" yields inputs a and b at runtime.
    const p = project(
      [node('num', 'Number'), node('ex', 'Expression')],
      [{ fromId: 'num', fromProperty: 'stored', toId: 'ex', toProperty: 'a' }]
    );
    expect(errorsOf(validator.validate(p)).length).toBe(0);
  });

  it('does NOT error on numbered inputs (And)', () => {
    const p = project(
      [node('b1', 'Boolean'), node('and', 'And')],
      [{ fromId: 'b1', fromProperty: 'stored', toId: 'and', toProperty: 'input5' }]
    );
    expect(errorsOf(validator.validate(p)).length).toBe(0);
  });

  it('does NOT error on a legacy/adapter port of a declared-port-groups node (Text Input `disabled`)', () => {
    // `disabled` is neither in Text Input's static inputs nor its declared groups,
    // yet it appears in real projects. Because the node carries dynamic ports, we
    // must skip rather than error.
    const p = project(
      [node('b', 'Boolean'), node('ti', 'Text Input')],
      [{ fromId: 'b', fromProperty: 'stored', toId: 'ti', toProperty: 'disabled' }]
    );
    expect(errorsOf(validator.validate(p)).length).toBe(0);
  });

  it('emits an info (not an error) for a skipped dynamic port when requested', () => {
    const p = project(
      [node('fn', 'JavaScriptFunction'), node('txt', 'Text')],
      [{ fromId: 'fn', fromProperty: 'madeUp', toId: 'txt', toProperty: 'text' }]
    );
    const report = validator.validate(p, { emitDynamicPortInfo: true });
    expect(errorsOf(report).length).toBe(0);
    expect(report.diagnostics.some((d) => d.code === DiagnosticCode.DynamicPortSkipped && d.severity === 'info')).toBe(true);
  });

  it('CONTRAST: a fully-static node still errors on a genuinely-missing port', () => {
    // Boolean has no dynamic ports; "nope" is a real error, proving the guard is
    // not suppressing true positives.
    const p = project(
      [node('a', 'Boolean'), node('b', 'Boolean')],
      [{ fromId: 'a', fromProperty: 'stored', toId: 'b', toProperty: 'nope' }]
    );
    const errs = errorsOf(validator.validate(p));
    expect(errs.length).toBe(1);
    expect(errs[0].code).toBe(DiagnosticCode.NonexistentPort);
  });
});
