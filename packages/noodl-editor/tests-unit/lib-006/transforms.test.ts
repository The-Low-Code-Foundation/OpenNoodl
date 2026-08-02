/**
 * LIB-006 — the in-memory transforms an import applies to the source project.
 *
 * Fakes stand in for the live model, which is exactly why `transforms.ts` keeps
 * its imports type-only. The `forEachNodeRecursive` fake reproduces the real
 * contract — a truthy callback return STOPS the walk — so the trap this project
 * has hit three times is actually under test rather than assumed away.
 */

import type { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { HTTP_TYPE, REST_TYPE } from '../../src/editor/src/utils/import-engine/legacy/constructs';
import { buildReport } from '../../src/editor/src/utils/import-engine/legacy/report';
import { applyLegacyTransforms } from '../../src/editor/src/utils/import-engine/legacy/transforms';
import type { LiveNode } from '../../src/editor/src/utils/import-engine/legacy/transforms';
import {
  LEGACY_IMPORT_METADATA_KEY,
  LegacyFinding,
  LegacyImportMarker,
  LegacyOutcome,
  LegacyReason
} from '../../src/editor/src/utils/import-engine/legacy/types';

// ─── Fakes ───────────────────────────────────────────────────────────────────

function fakeNode(id: string, typename: string): LiveNode {
  return {
    id,
    typename,
    retypeTo(next: string) {
      this.typename = next;
    }
  };
}

/**
 * A component whose walker honours the real `forEachRecursive` contract:
 * a truthy return from the callback stops the walk. If `indexNodes` ever
 * regresses to an implicit-return arrow, this fake makes it fail.
 */
function fakeComponent(name: string, nodes: LiveNode[]) {
  return {
    name,
    forEachNodeRecursive(callback: (node: LiveNode) => boolean | void): boolean {
      for (const node of nodes) {
        if (callback(node)) {
          return true;
        }
      }
      return false;
    }
  };
}

function fakeProject(components: ReturnType<typeof fakeComponent>[]): ProjectModel {
  return { components } as unknown as ProjectModel;
}

function finding(over: Partial<LegacyFinding> & { id: string; outcome: LegacyOutcome; reason: LegacyReason }) {
  return {
    kind: 'node',
    original: 'noodl.byob.QueryData',
    message: 'm',
    equivalents: [],
    ...over
  } as LegacyFinding;
}

function reportOf(findings: LegacyFinding[]) {
  return buildReport({
    sourceDir: '/src',
    findings,
    constructsAssessed: findings.length,
    nodeCount: findings.length,
    now: new Date('2026-08-02T12:00:00.000Z')
  });
}

const markerOn = (node: LiveNode) => node.metadata?.[LEGACY_IMPORT_METADATA_KEY] as LegacyImportMarker | undefined;

// ─── Marking ─────────────────────────────────────────────────────────────────

describe('applyLegacyTransforms — marking placeholders', () => {
  it('marks the node without touching its type', () => {
    const node = fakeNode('n1', 'noodl.byob.QueryData');
    const project = fakeProject([fakeComponent('/App', [node])]);
    const result = applyLegacyTransforms(
      reportOf([finding({ id: 'f1', outcome: 'placeholder', reason: 'type-removed', location: { nodeId: 'n1' } })]),
      project
    );

    expect(result.marked).toBe(1);
    expect(node.typename).toBe('noodl.byob.QueryData');
    expect(markerOn(node)).toEqual({
      findingId: 'f1',
      originalType: 'noodl.byob.QueryData',
      reason: 'type-removed',
      importedAt: '2026-08-02T12:00:00.000Z'
    });
  });

  it('preserves metadata the node already carried', () => {
    const node = fakeNode('n1', 'noodl.byob.QueryData');
    node.metadata = { comment: 'keep me' };
    applyLegacyTransforms(
      reportOf([finding({ id: 'f1', outcome: 'placeholder', reason: 'type-removed', location: { nodeId: 'n1' } })]),
      fakeProject([fakeComponent('/App', [node])])
    );

    expect(node.metadata.comment).toBe('keep me');
    expect(markerOn(node)).toBeDefined();
  });

  it('walks EVERY node, not just the first — the forEachRecursive stop-on-truthy trap', () => {
    const a = fakeNode('a', 'noodl.byob.QueryData');
    const b = fakeNode('b', 'noodl.byob.CreateRecord');
    const c = fakeNode('c', 'noodl.byob.DeleteRecord');
    const result = applyLegacyTransforms(
      reportOf([
        finding({ id: 'fa', outcome: 'placeholder', reason: 'type-removed', location: { nodeId: 'a' } }),
        finding({ id: 'fb', outcome: 'placeholder', reason: 'type-removed', location: { nodeId: 'b' } }),
        finding({ id: 'fc', outcome: 'placeholder', reason: 'type-removed', location: { nodeId: 'c' } })
      ]),
      fakeProject([fakeComponent('/App', [a, b, c])])
    );

    expect(result.marked).toBe(3);
    expect(result.unlocated).toEqual([]);
  });

  it('indexes across every component', () => {
    const a = fakeNode('a', 'X');
    const b = fakeNode('b', 'Y');
    const result = applyLegacyTransforms(
      reportOf([
        finding({ id: 'fa', outcome: 'placeholder', reason: 'type-unresolved', location: { nodeId: 'a' } }),
        finding({ id: 'fb', outcome: 'placeholder', reason: 'type-unresolved', location: { nodeId: 'b' } })
      ]),
      fakeProject([fakeComponent('/One', [a]), fakeComponent('/Two', [b])])
    );

    expect(result.marked).toBe(2);
  });
});

// ─── The REST conversion ─────────────────────────────────────────────────────

describe('applyLegacyTransforms — the REST conversion', () => {
  it('retypes a REST node to HTTP Request', () => {
    const node = fakeNode('n1', REST_TYPE);
    const result = applyLegacyTransforms(
      reportOf([
        finding({
          id: 'f1',
          outcome: 'converted-with-changes',
          reason: 'rest-to-http',
          original: REST_TYPE,
          location: { nodeId: 'n1' }
        })
      ]),
      fakeProject([fakeComponent('/App', [node])])
    );

    expect(result.converted).toBe(1);
    expect(node.typename).toBe(HTTP_TYPE);
    // A conversion is not a placeholder — it must not gain a marker, or the
    // validator would error on a node that converted fine.
    expect(markerOn(node)).toBeUndefined();
  });

  it('leaves a REST node alone when the finding says its scripts carry code', () => {
    const node = fakeNode('n1', REST_TYPE);
    const result = applyLegacyTransforms(
      reportOf([
        finding({
          id: 'f1',
          outcome: 'converted',
          reason: 'rest-has-scripts',
          original: REST_TYPE,
          location: { nodeId: 'n1' }
        })
      ]),
      fakeProject([fakeComponent('/App', [node])])
    );

    expect(result.converted).toBe(0);
    expect(node.typename).toBe(REST_TYPE);
  });
});

// ─── Findings that touch nothing ─────────────────────────────────────────────

describe('applyLegacyTransforms — findings with no node', () => {
  it('ignores project-level findings', () => {
    const result = applyLegacyTransforms(
      reportOf([
        finding({ id: 'f1', outcome: 'dropped', reason: 'field-not-carried', location: { field: 'deviceSettings' } })
      ]),
      fakeProject([])
    );

    expect(result).toEqual({ marked: 0, converted: 0, unlocated: [] });
  });

  it('reports a placeholder whose node it cannot find, rather than failing silently', () => {
    const result = applyLegacyTransforms(
      reportOf([
        finding({ id: 'gone', outcome: 'placeholder', reason: 'type-removed', location: { nodeId: 'missing' } })
      ]),
      fakeProject([fakeComponent('/App', [fakeNode('other', 'Group')])])
    );

    expect(result.marked).toBe(0);
    expect(result.unlocated).toEqual(['gone']);
  });

  it('does not report an unlocated CONVERTED finding — nothing was owed', () => {
    const result = applyLegacyTransforms(
      reportOf([
        finding({ id: 'note', outcome: 'converted', reason: 'type-deprecated', location: { nodeId: 'missing' } })
      ]),
      fakeProject([])
    );

    expect(result.unlocated).toEqual([]);
  });

  it('leaves a clean project entirely untouched', () => {
    const node = fakeNode('n1', 'Group');
    const result = applyLegacyTransforms(reportOf([]), fakeProject([fakeComponent('/App', [node])]));

    expect(result).toEqual({ marked: 0, converted: 0, unlocated: [] });
    expect(node.metadata).toBeUndefined();
  });
});
