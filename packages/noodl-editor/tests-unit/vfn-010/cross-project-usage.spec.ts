/**
 * VFN-010 §"The usage count across projects, and what it can honestly say" — criteria 3 and 5.
 *
 * > *"this block is placed in 2 projects in 8 places, are you sure? Changes propagate everywhere"*
 *
 * 🔴 **The number is real, its scope is stated, and the warning does not depend on it.** The
 * launcher only knows the projects in its recent list — a record of where it has been, not an
 * inventory of where a block is — so this grades three things that are easy to get silently wrong:
 *
 * 1. the **two on-disk formats** produce the same `ProjectScan` (a converter pointed at the wrong
 *    format finds nothing, and "nothing" is the answer that makes a delete refusal stop refusing);
 * 2. a project that could **not be read** is never counted as a project where the block is absent;
 * 3. "checked, found nothing" and "never checked" are different states.
 *
 * ⚠️ Every assertion that a count is *zero* carries a control in which the same instrument returns
 * non-zero over input that does contain the thing. A suite of absences is indistinguishable from an
 * instrument that measured nothing.
 */

import {
  crossProjectNodeIds,
  crossProjectUsage,
  noCrossProjectCheck,
  wasChecked,
  type ProjectSnapshot
} from '../../src/editor/src/views/BlocklyEditor/myblocks/crossProjectUsage';
import {
  displayNameOf,
  scanFromLegacyProject,
  scanFromV2Components
} from '../../src/editor/src/views/BlocklyEditor/myblocks/projectFile';
import { scanNodeUsage } from '../../src/editor/src/views/BlocklyEditor/myblocks/usage';
import { callStatement, callValue, getInput, number, setOutput, workspace } from '../lgc-007/fixtures';

const DISCOUNT = 'def-discount';
const TAX = 'def-tax';

/** A `workspace` parameter as it is actually stored: a JSON string. */
function callsDiscount(): string {
  return JSON.stringify(workspace(setOutput('total', callValue(DISCOUNT, [number(10)]))));
}

function callsDiscountTwice(): string {
  return JSON.stringify(
    workspace(callStatement(DISCOUNT, [], [], callStatement(DISCOUNT)))
  );
}

function callsNothing(): string {
  return JSON.stringify(workspace(setOutput('total', getInput('price'))));
}

/** A legacy `project.json`, nested exactly as one is on disk. */
function legacyProject(nodes: { id: string; label?: string; workspace?: string }[], componentName = '/Pages/Checkout') {
  return {
    name: 'Alpha',
    components: [
      {
        name: componentName,
        id: 'component-1',
        graph: {
          roots: [
            {
              id: 'group-1',
              type: 'Group',
              parameters: {},
              // 🔴 Nested. The Visual Function nodes are *children* of a group, and a walker that
              // only read `roots` would report zero for a project whose blocks are laid out the way
              // every real project lays them out.
              children: nodes.map((node) => ({
                id: node.id,
                type: 'Logic Builder',
                label: node.label,
                parameters: node.workspace ? { workspace: node.workspace } : {},
                children: []
              }))
            }
          ]
        }
      }
    ]
  };
}

describe('VFN-010 — reading a project off disk, in both formats', () => {
  it('finds a Visual Function nested under a group in a legacy project.json', () => {
    const scan = scanFromLegacyProject(legacyProject([{ id: 'n1', label: 'Order total', workspace: callsDiscount() }]));

    expect(scan.components).toHaveLength(1);
    expect(scan.components[0].path).toBe('/Pages/Checkout');
    // The display name is the last segment, read off the path rather than assembled.
    expect(scan.components[0].name).toBe('Checkout');
    expect(scan.components[0].nodes.map((node) => node.id)).toEqual(['group-1', 'n1']);

    expect(scanNodeUsage(scan).get(DISCOUNT)?.map((site) => site.nodeName)).toEqual(['Order total']);
  });

  it('finds the same node in a v2 project, where `nodes` is FLAT and children are ids', () => {
    const scan = scanFromV2Components([
      {
        path: 'Pages/Checkout',
        component: { id: 'component-1', displayName: 'Checkout' },
        nodes: {
          nodes: [
            { id: 'group-1', type: 'Group', children: ['n1'] },
            { id: 'n1', type: 'Logic Builder', label: 'Order total', parent: 'group-1', parameters: { workspace: callsDiscount() } }
          ]
        }
      }
    ]);

    expect(scan.components[0].nodes.map((node) => node.id)).toEqual(['group-1', 'n1']);
    expect(scanNodeUsage(scan).get(DISCOUNT)?.map((site) => site.nodeName)).toEqual(['Order total']);
  });

  it('🔴 NEGATIVE CONTROL — each converter finds NOTHING in the other format', () => {
    // This is the failure the two converters exist to avoid, and it fails *silently*: the wrong
    // reader returns a well-formed scan with no nodes in it, which reads downstream as "this block
    // is used nowhere" — the input that turns a delete refusal into a deletion.
    const v2Shape = { nodes: [{ id: 'n1', type: 'Logic Builder', parameters: { workspace: callsDiscount() } }] };

    const legacyReaderOnV2 = scanFromLegacyProject(v2Shape);
    expect(legacyReaderOnV2.components).toEqual([]);
    expect(scanNodeUsage(legacyReaderOnV2).get(DISCOUNT)).toBeUndefined();

    const v2ReaderOnLegacy = scanFromV2Components([
      { path: 'Pages/Checkout', nodes: legacyProject([{ id: 'n1', workspace: callsDiscount() }]) as never }
    ]);
    expect(v2ReaderOnLegacy.components[0].nodes).toEqual([]);
    expect(scanNodeUsage(v2ReaderOnLegacy).get(DISCOUNT)).toBeUndefined();

    // …and the same two instruments do find it in the format they are for, so the empties above
    // are findings rather than a pair of readers that always return nothing.
    expect(scanNodeUsage(scanFromLegacyProject(legacyProject([{ id: 'n1', workspace: callsDiscount() }]))).get(DISCOUNT))
      .toHaveLength(1);
  });

  it('never throws on a project file that is not one', () => {
    for (const rubbish of [null, undefined, 42, 'not json', [], {}, { components: 'nope' }]) {
      expect(scanFromLegacyProject(rubbish).components).toEqual([]);
    }
    expect(scanFromV2Components(undefined as never)).toEqual({ components: [] });
  });

  it('survives a cycle in a hand-edited children tree rather than hanging the launcher', () => {
    const a: Record<string, unknown> = { id: 'a', type: 'Group', children: [] };
    const b: Record<string, unknown> = { id: 'b', type: 'Logic Builder', parameters: { workspace: callsDiscount() }, children: [a] };
    (a.children as unknown[]).push(b);

    const scan = scanFromLegacyProject({ components: [{ name: '/App', id: 'c', graph: { roots: [a] } }] });
    expect(scan.components[0].nodes.map((node) => node.id).sort()).toEqual(['a', 'b']);
  });

  it('takes the last path segment as the display name and never assembles one', () => {
    expect(displayNameOf('/Pages/Checkout')).toBe('Checkout');
    expect(displayNameOf('App')).toBe('App');
    expect(displayNameOf('')).toBe('');
  });
});

/** A snapshot, from a legacy project shape, so the fixtures stay in one vocabulary. */
function snapshot(name: string, nodes: { id: string; label?: string; workspace?: string }[], componentName?: string): ProjectSnapshot {
  return {
    id: `${name}-id`,
    name,
    path: `/projects/${name}`,
    scan: scanFromLegacyProject(legacyProject(nodes, componentName))
  };
}

describe('VFN-010 criterion 3 — the count, and everything it must say about itself', () => {
  const AT = () => '2026-08-13T10:00:00.000Z';

  it('counts places and projects, and records every project it read', () => {
    const usage = crossProjectUsage(
      DISCOUNT,
      [
        snapshot('Alpha', [
          { id: 'n1', label: 'Order total', workspace: callsDiscount() },
          { id: 'n2', label: 'Shipping', workspace: callsDiscount() }
        ]),
        snapshot('Beta', [{ id: 'n3', label: 'Basket line', workspace: callsDiscount() }]),
        snapshot('Gamma', [{ id: 'n4', label: 'Untouched', workspace: callsNothing() }]),
        snapshot('Delta', [])
      ],
      [],
      AT
    );

    expect(usage.siteCount).toBe(3);
    expect(usage.projectCount).toBe(2);
    // 🔴 Criterion 3: the projects it *scanned*, not just the ones it found something in. Without
    // this list the sentence cannot name what the number is a sample of.
    expect(usage.scanned.map((project) => project.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(usage.projects.map((project) => project.projectName)).toEqual(['Alpha', 'Beta']);
    expect(usage.checkedAt).toBe('2026-08-13T10:00:00.000Z');
  });

  it('counts a node that calls the block twice as ONE place', () => {
    // A refusal that said "used by 3 nodes" about one node three times is wrong in the direction
    // that makes a builder distrust the whole warning. Deduplicated through VFN-009's own helper.
    const usage = crossProjectUsage(
      DISCOUNT,
      [snapshot('Alpha', [{ id: 'n1', label: 'Order total', workspace: callsDiscountTwice() }])],
      [],
      AT
    );

    expect(usage.siteCount).toBe(1);
    expect(crossProjectNodeIds(usage)).toEqual(['n1']);
  });

  it('🔴 a project that could not be read is reported, and NEVER counted as an absence', () => {
    const usage = crossProjectUsage(
      DISCOUNT,
      [snapshot('Alpha', [{ id: 'n1', workspace: callsNothing() }])],
      [{ name: 'Beta', path: '/projects/Beta', reason: 'the folder is no longer there' }],
      AT
    );

    expect(usage.siteCount).toBe(0);
    expect(usage.scanned.map((project) => project.name)).toEqual(['Alpha']);
    expect(usage.unreadable.map((project) => project.name)).toEqual(['Beta']);

    // 🔴 CONTROL — the unreadable project is not silently folded into `scanned`, which is the
    // shape that turns a sample into a census. One list grew, the other did not.
    expect(usage.scanned.map((project) => project.name)).not.toContain('Beta');
  });

  it('🔴 "checked and found nothing" is not "never checked"', () => {
    const never = noCrossProjectCheck(DISCOUNT);
    expect(wasChecked(never)).toBe(false);
    expect(never.siteCount).toBe(0);

    const checked = crossProjectUsage(DISCOUNT, [snapshot('Alpha', [{ id: 'n1', workspace: callsNothing() }])], [], AT);
    expect(wasChecked(checked)).toBe(true);
    expect(checked.siteCount).toBe(0);

    // 🔴 CONTROL — the two are indistinguishable by count alone. That is the whole point: a
    // surface that branched on `siteCount === 0` would say "not used anywhere" about a check that
    // never ran, which is a licence to delete.
    expect(never.siteCount).toBe(checked.siteCount);
    expect(wasChecked(never)).not.toBe(wasChecked(checked));

    // A scan that read nothing but reported an unreadable project is still an answer.
    const allUnreadable = crossProjectUsage(DISCOUNT, [], [{ name: 'Beta', path: '/b', reason: 'gone' }], AT);
    expect(wasChecked(allUnreadable)).toBe(true);
  });

  it('supplies criterion 5 with the node ids `remove` refuses on, grouped by project for the names', () => {
    const usage = crossProjectUsage(
      DISCOUNT,
      [
        snapshot('Alpha', [{ id: 'n1', label: 'Order total', workspace: callsDiscount() }]),
        snapshot('Beta', [{ id: 'n2', label: 'Basket line', workspace: callsDiscount() }])
      ],
      [],
      AT
    );

    // The store counts these and throws; it can never name them, because it has no project.
    expect(crossProjectNodeIds(usage)).toEqual(['n1', 'n2']);
    // The names come from here instead, and they are grouped so the sentence can say *which*
    // project — a node id in another project is not something a builder can go and look at.
    expect(usage.projects[0]).toMatchObject({ projectName: 'Alpha', projectPath: '/projects/Alpha' });
    expect(usage.projects[1].sites[0].nodeName).toBe('Basket line');

    // 🔴 CONTROL — the same instrument returns an EMPTY list for a block nothing calls, so a
    // refusal built on it would not refuse. Both directions of the gate are watched.
    expect(crossProjectNodeIds(crossProjectUsage(TAX, usage.projects.length ? [snapshot('Alpha', [{ id: 'n1', workspace: callsDiscount() }])] : [], [], AT))).toEqual([]);
  });
});
