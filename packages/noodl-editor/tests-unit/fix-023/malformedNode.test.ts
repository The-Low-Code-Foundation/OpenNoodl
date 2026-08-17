/**
 * FIX-023 — one typeless node killed the whole project's write surface.
 *
 * A node object with no `type` reached `isComponentRef(node.type)` as
 * `undefined` and threw `Cannot read properties of undefined (reading
 * 'startsWith')` out of the walk. The MCP server surfaced that as
 * `io-error: Unexpected failure: …`, so `validate_project`, `create_component`
 * and `update_component` all failed for the entire project, with nothing in the
 * message naming the node, the component, or even the project. Measured across
 * the on-disk corpus: 56 project directories, exactly one carrying such a node
 * (1 of its 119 node objects) — and it was the project Richard has a registered
 * MCP server for.
 *
 * `isComponentRef` was declared `(type: string)`, and the call sites pass
 * `node.type` whose declared type is also `string`, so **no `tsc` gate could
 * ever have seen this**. That is why the fix is a runtime guard at the load
 * boundary plus a spec, and not a type change alone.
 *
 * ## What this file is actually grading, and why the fixture has the shape it has
 *
 * "It no longer throws" is a weak claim: a walk that aborts silently at the
 * malformed node satisfies it just as well as a walk that carries on. So the
 * fixture puts the typeless node **third of four** in a component whose
 * **fourth** node carries an independently-detectable defect (an unknown type),
 * and lists that component **first** in the registry ahead of a second
 * component that carries another. The assertions that matter are therefore not
 * about the malformed node at all — they are that the node *after* it and the
 * component *after* it are still reported. A fixture of one component, or one
 * with the defect last, cannot tell the two outcomes apart.
 *
 * The three fixes are graded separately, because they fail independently:
 *   A — the load boundary substitutes a placeholder and records the reason;
 *   B — a diagnostic names the node id and the component path *in the message*;
 *   C — `isComponentRef` tolerates a non-string, for the raw-file walkers in
 *       `noodl-mcp` that never pass through normalisation.
 */
import * as path from 'path';

import {
  DiagnosticCode,
  MALFORMED_NODE_TYPE,
  fromLegacyProject,
  isComponentRef,
  normalizeV2Component,
  validateProject,
  type Diagnostic
} from '../../src/editor/src/validation';
import { loadV2Directory } from '../../src/editor/src/validation/loadV2Project';

const FIXTURE = path.join(__dirname, 'fixtures', 'typeless-node');

/** The id carried verbatim from the real project this was reproduced on. */
const TYPELESS_ID = '6d5ec795-be88-fdd9-b555-1bb2f6bba281';

function reportForFixture(): Diagnostic[] {
  return validateProject(loadV2Directory(FIXTURE)).diagnostics;
}

const withCode = (ds: Diagnostic[], code: DiagnosticCode) => ds.filter((d) => d.code === code);

describe('FIX-023 — a typeless node on disk', () => {
  it('does not throw the walk (AC1)', () => {
    // The whole defect, stated as the assertion it always should have been.
    expect(() => reportForFixture()).not.toThrow();
  });

  it('reports one malformed-node error naming the node id and the component path (AC2)', () => {
    const malformed = withCode(reportForFixture(), DiagnosticCode.MalformedNode);

    expect(malformed).toHaveLength(1);
    expect(malformed[0].severity).toBe('error');
    expect(malformed[0].location.nodeId).toBe(TYPELESS_ID);

    // In the MESSAGE, not only in `location`: the point of this diagnostic is
    // that the identifying detail survives whatever formatter it passes
    // through, so an agent has a string to search for.
    expect(malformed[0].message).toContain(TYPELESS_ID);
    expect(malformed[0].message).toContain('Pages/Admin Login');
  });

  it('keeps checking the nodes AFTER the malformed one', () => {
    // `login_field` is the fourth node in the same component, one past the
    // typeless third. If the walk aborted at the malformed node this is the
    // assertion that fails — "did not throw" alone would still pass.
    const unknown = withCode(reportForFixture(), DiagnosticCode.UnknownNodeType);
    expect(unknown.map((d) => d.location.nodeId)).toContain('login_field');
  });

  it('keeps checking the components AFTER the malformed one', () => {
    // `Pages/Admin Login` is listed first in the registry; `Pages/Home` second.
    const unknown = withCode(reportForFixture(), DiagnosticCode.UnknownNodeType);
    expect(unknown.map((d) => d.location.nodeId)).toContain('home_greeting');
  });

  it('does not also report the malformed node as an unknown type', () => {
    // The normaliser substitutes an empty-string placeholder. Reported naively
    // that reads `Unknown node type ""` — the placeholder blamed on the author,
    // beside the diagnostic that actually explains the problem.
    const unknown = withCode(reportForFixture(), DiagnosticCode.UnknownNodeType);
    expect(unknown.map((d) => d.location.nodeId)).not.toContain(TYPELESS_ID);
  });
});

describe('FIX-023 fix A — the load boundary', () => {
  it('substitutes the placeholder and records the reason (v2 path)', () => {
    const component = normalizeV2Component(
      '/Pages/Admin Login',
      { nodes: [{ id: 'ok', type: 'Group' }, { id: TYPELESS_ID }] } as never,
      { connections: [] } as never
    );

    expect(component.nodes[0].type).toBe('Group');
    expect(component.nodes[0].malformed).toBeUndefined();
    expect(component.nodes[1].type).toBe(MALFORMED_NODE_TYPE);
    expect(component.nodes[1].malformed).toEqual(['missing-type']);
  });

  it('substitutes the placeholder and records the reason (legacy / in-memory path)', () => {
    // `ProjectModel.instance.toJSON()` is exactly this shape, so the editor's
    // own validator reaches the same guard — the v2 loader is not the only way
    // in, and fixing only it would leave half the callers exposed.
    const project = fromLegacyProject({
      components: [{ name: '/Pages/Admin Login', graph: { roots: [{ id: TYPELESS_ID } as never] } }]
    });

    expect(project.components[0].nodes[0].type).toBe(MALFORMED_NODE_TYPE);
    expect(project.components[0].nodes[0].malformed).toEqual(['missing-type']);
  });

  it('treats an empty-string type as malformed too, not as a real type', () => {
    const component = normalizeV2Component('/X', { nodes: [{ id: 'n', type: '' }] } as never, {
      connections: []
    } as never);
    expect(component.nodes[0].malformed).toEqual(['missing-type']);
  });
});

describe('FIX-023 fix C — isComponentRef tolerates a non-string', () => {
  // Defence in depth for the callers that walk RAW v2 files and never pass
  // through normalisation: `noodl-mcp`'s planTools, read and describe. The
  // census found 20 call sites across the editor and the MCP server and
  // exactly two of them guarded — someone hit this before and patched the one
  // line they were standing on.
  it.each([
    ['undefined', undefined],
    ['null', null]
  ])('returns false for %s instead of throwing', (_label, value) => {
    expect(() => isComponentRef(value as never)).not.toThrow();
    expect(isComponentRef(value as never)).toBe(false);
  });

  it('still answers correctly for real types', () => {
    expect(isComponentRef('/Pages/Home')).toBe(true);
    expect(isComponentRef('#Home')).toBe(true);
    expect(isComponentRef('Group')).toBe(false);
    expect(isComponentRef(MALFORMED_NODE_TYPE)).toBe(false);
  });
});
