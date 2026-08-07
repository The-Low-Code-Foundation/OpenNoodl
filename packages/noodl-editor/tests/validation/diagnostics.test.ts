/**
 * SUB-006 — Diagnostic formatting + the "fixable by an AI" contract
 *
 * The diagnostics are data; formatting happens at the edge. These tests cover
 * the human and JSON formatters the CLI/editor/MCP share, and assert the
 * success criterion that matters most for AI authoring: a deliberately broken
 * component yields diagnostics sufficient to fix it with no other context.
 */

import {
  Diagnostic,
  DiagnosticCode,
  formatDiagnosticLine,
  sortDiagnostics,
  toJSON
} from '../../src/editor/src/validation/diagnostics';
import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { fromLegacyProject } from '../../src/editor/src/validation/normalize';

function diag(partial: Partial<Diagnostic>): Diagnostic {
  return {
    code: DiagnosticCode.UnknownNodeType,
    severity: 'warning',
    message: 'msg',
    location: { component: '/#A' },
    ...partial
  };
}

describe('SUB-006 diagnostics formatting', () => {
  it('renders severity, code, location, suggestion and alternatives', () => {
    const line = formatDiagnosticLine(
      diag({
        code: DiagnosticCode.NonexistentPort,
        severity: 'error',
        message: 'Boolean has no input "valeu".',
        location: { component: '/#A', nodeId: 'n1', nodeType: 'Boolean', port: 'valeu', plug: 'input' },
        suggestion: 'value',
        alternatives: ['value', 'saveValue']
      })
    );
    expect(line).toContain('ERROR');
    expect(line).toContain('nonexistent-port');
    expect(line).toContain('/#A');
    expect(line).toContain('n1');
    expect(line).toContain('input "valeu"');
    expect(line).toContain('did you mean `value`?');
    expect(line).toContain('available: value, saveValue');
  });

  it('orders diagnostics by component, then severity', () => {
    const sorted = sortDiagnostics([
      diag({ severity: 'warning', location: { component: '/#B' } }),
      diag({ severity: 'error', location: { component: '/#A' } }),
      diag({ severity: 'warning', location: { component: '/#A' } })
    ]);
    expect(sorted[0].location.component).toBe('/#A');
    expect(sorted[0].severity).toBe('error');
  });

  it('produces machine-readable JSON carrying full location data', () => {
    const json = toJSON(
      {
        diagnostics: [
          diag({
            code: DiagnosticCode.NonexistentPort,
            severity: 'error',
            location: { component: '/#A', nodeId: 'n1', port: 'x', plug: 'input' }
          })
        ],
        summary: { errors: 1, warnings: 0, infos: 0, nodesChecked: 1, endpointsChecked: 1 }
      },
      'demo'
    ) as any;
    expect(json.target).toBe('demo');
    expect(json.summary.errors).toBe(1);
    expect(json.diagnostics[0].location.nodeId).toBe('n1');
    expect(json.diagnostics[0].location.port).toBe('x');
  });
});

describe('SUB-006 AI-fixability contract', () => {
  it('a deliberately broken component yields enough to fix it without other context', () => {
    const broken = {
      name: 'Broken',
      components: [
        {
          name: '/#App',
          graph: {
            roots: [
              { id: 'n1', type: 'Butonn' }, // typo for Button
              { id: 'n2', type: 'Boolean' }
            ],
            connections: [
              // Boolean has no input "inputt" (its inputs are saveValue, value).
              // ⚠️ The *source* port must be a real one, or the first NonexistentPort
              // diagnostic found below is about the output rather than the input, and its
              // alternatives are the output list. ERG-001 removed `stored` from this family;
              // `completed` is what replaced it.
              { fromId: 'n2', fromProperty: 'completed', toId: 'n2', toProperty: 'inputt' }
            ]
          }
        }
      ]
    };
    const report = new SemanticValidator().validate(fromLegacyProject(broken));

    const typeDiag = report.diagnostics.find((d) => d.code === DiagnosticCode.UnknownNodeType);
    expect(typeDiag).toBeDefined();
    // The fix is in the message: rename Butonn → Button.
    expect(typeDiag!.suggestion).toBe('Button');

    const portDiag = report.diagnostics.find((d) => d.code === DiagnosticCode.NonexistentPort);
    expect(portDiag).toBeDefined();
    // The fix set is in the message: the ports Boolean actually has.
    expect(portDiag!.alternatives).toContain('value');
  });
});
