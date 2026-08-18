/**
 * s29 — the picker's per-kit index is pruned with the node types, not left behind.
 *
 * ## The defect, measured live before this was written
 *
 * A kit in `cn029-drive` was given a syntax error. `NodeLibrary.getNodeTypes()`
 * dropped to 185 with **no** `nodegx.broken.*` in it — correct — while
 * `NodeLibrary.instance.library.nodeIndex.moduleNodes` still carried
 * `{ name: 'Broken Kit', items: ['nodegx.broken.Intact'] }`. The control: a
 * second kit broken a different way (D20's registration rollback) behaved the
 * same, so this is not specific to either failure mode — the group is simply
 * never removed. `updateIndex` filtered `nodetypes` against
 * `clients.getNodeNames()` and nothing filtered `moduleNodes`, and
 * `mergeInByName` only ever replaces-by-name or pushes.
 *
 * ## 🔴 Why it is worse than a stale list
 *
 * `KitsSection` passes these names to `kitDiagnostics` as *"what this kit
 * registered"*. So `registeredSomething` was true for a kit that had registered
 * nothing, and **Settings → Kits told the author the kit was "only PARTIALLY
 * registered — nodes defined before the failure are available"**. With ✅ D20 in
 * place the same row contradicted itself inside one sentence:
 *
 * > … without one NONE of this kit's nodes register … It is only PARTIALLY
 * > registered — nodes defined before the failure are available …
 *
 * Two fields made to contradict each other, on the one surface D20 requires the
 * truth to reach. ⚠️ The `partial` branch is **kept**: a script that throws
 * after some `defineModule` calls really is half-registered, and that is the
 * alarming case CN-015 named. What these rows pin is that its input is true.
 */

const reload = jest.fn();
jest.mock('@noodl-models/nodelibrary/nodelibrary', () => ({
  NodeLibrary: {
    instance: {
      get reload() {
        return reload;
      }
    }
  }
}));

import { NodeLibraryData, NodeLibraryDataNodeType, RuntimeType } from '../../src/editor/src/models/nodelibrary/NodeLibraryData';
import { NodeLibraryImporter } from '../../src/editor/src/models/nodelibrary/NodeLibraryImporter';

beforeAll(() => {
  (global as unknown as { window: Record<string, unknown> }).window = {};
});

beforeEach(() => {
  reload.mockClear();
});

function kitNode(name: string, module: string): NodeLibraryDataNodeType {
  return {
    name,
    displayName: name.split('.').pop(),
    category: 'Visuals',
    color: 'visual',
    docs: '',
    ports: [],
    metadata: { module }
  } as unknown as NodeLibraryDataNodeType;
}

/** A viewer's report, with the picker groups the runtime builds from the register. */
function library(
  nodetypes: NodeLibraryDataNodeType[],
  moduleNodes: { name: string; items: string[] }[]
): NodeLibraryData {
  return {
    nodetypes,
    nodeIndex: { coreNodes: [], moduleNodes },
    projectsettings: { ports: [], dynamicports: [] }
  } as unknown as NodeLibraryData;
}

function fresh<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The groups as `KitsSection` would read them, after an import. */
function groupsAfter(reports: NodeLibraryData[]): { name: string; items: string[] }[] {
  const importer = new NodeLibraryImporter();
  for (const report of reports) importer.onClientImport('viewer-1', 'browser' as RuntimeType, fresh(report));
  const published = (global as unknown as { window: { NodeLibraryData?: NodeLibraryData } }).window.NodeLibraryData;
  return ((published && published.nodeIndex && published.nodeIndex.moduleNodes) || []) as {
    name: string;
    items: string[];
  }[];
}

const HEALTHY = library(
  [kitNode('nodegx.broken.Intact', 'Broken Kit'), kitNode('nodegx.grow.Alpha', 'Grow Kit')],
  [
    { name: 'Broken Kit', items: ['nodegx.broken.Intact'] },
    { name: 'Grow Kit', items: ['nodegx.grow.Alpha'] }
  ]
);

/** The same viewer after the kit broke: it registers nothing, so it reports no group. */
const BROKEN = library([kitNode('nodegx.grow.Alpha', 'Grow Kit')], [{ name: 'Grow Kit', items: ['nodegx.grow.Alpha'] }]);

describe('s29 — a kit that stops registering loses its picker group', () => {
  it('🔴 drops the group entirely when the kit registers nothing', () => {
    const groups = groupsAfter([HEALTHY, BROKEN]);
    expect(groups.map((g) => g.name)).toEqual(['Grow Kit']);
  });

  it('🔴 CONTROL — the healthy kit in the same report is untouched', () => {
    // Without this row, "prune everything" would pass the row above. The bug was
    // a stale survivor; the obvious overcorrection is a vanished neighbour.
    const groups = groupsAfter([HEALTHY, BROKEN]);
    expect(groups.find((g) => g.name === 'Grow Kit')!.items).toEqual(['nodegx.grow.Alpha']);
  });

  it('CONTROL — nothing is pruned while every kit is healthy', () => {
    const groups = groupsAfter([HEALTHY]);
    expect(groups.map((g) => g.name).sort()).toEqual(['Broken Kit', 'Grow Kit']);
  });

  it('prunes the dead node out of a kit that is only PARTLY gone, and keeps the group', () => {
    /*
     * ⚠️ This is the case that keeps `kitDiagnostics`' `partial` branch honest and
     * populated. A kit whose script throws part-way really does leave the nodes
     * before the throw registered, so the group must survive with fewer items —
     * "drop the group whenever anything is missing" would empty this population
     * and quietly retire a diagnostic that describes a real state.
     */
    const twoNodes = library(
      [kitNode('nodegx.half.One', 'Half Kit'), kitNode('nodegx.half.Two', 'Half Kit')],
      [{ name: 'Half Kit', items: ['nodegx.half.One', 'nodegx.half.Two'] }]
    );
    const onlyFirst = library(
      [kitNode('nodegx.half.One', 'Half Kit')],
      [{ name: 'Half Kit', items: ['nodegx.half.One'] }]
    );

    const groups = groupsAfter([twoNodes, onlyFirst]);
    expect(groups).toEqual([{ name: 'Half Kit', items: ['nodegx.half.One'] }]);
  });

  it('keeps an item it cannot identify rather than guessing it away', () => {
    /*
     * ⚠️ `NodeLibraryData` declares `items` as `TSFixme[]`, so its shape is not guaranteed by the
     * type — only by the one producer that fills it (`nodelibraryexport.ts`, which emits type-name
     * strings). The prune therefore only judges a plain string, and this row makes that branch
     * reachable and graded rather than a defensive line nothing exercises: dropping a node because
     * this pass did not recognise its shape would be worse than leaving a stale one.
     */
    const odd = library(
      [kitNode('nodegx.odd.Real', 'Odd Kit')],
      [{ name: 'Odd Kit', items: ['nodegx.odd.Real', { name: 'nodegx.odd.Shaped' }] as unknown as string[] }]
    );
    const gone = library([], []);

    const groups = groupsAfter([odd, gone]);
    expect(groups).toEqual([{ name: 'Odd Kit', items: [{ name: 'nodegx.odd.Shaped' }] }]);
  });

  it('🔴 passes through a group whose shape it does not recognise', () => {
    /*
     * `tests-unit/cn-014` builds `moduleNodes` as
     * `[{ name, subCategories: [{ name, items }] }]` — no top-level `items` at all. That is the
     * **`coreNodes`** shape; `generateNodeLibrary` emits `moduleNodes` as flat `{ name, items }`
     * (its `moduleNodesByKit` map), so the producer cannot emit what that fixture contains.
     *
     * 🔴 A first draft of this prune crashed on it (`Cannot read properties of undefined (reading
     * 'length')`) and took two of cn-014's rows down with it — caught by `test:main`, not by the
     * new suite, because the new suite only ever built the real shape. Unrecognised goes through
     * untouched: dropping a kit's group because this pass did not understand it would be worse than
     * the stale group it exists to remove.
     */
    const nested = {
      nodetypes: [kitNode('nested.kit.Panel', 'Nested Kit')],
      nodeIndex: {
        coreNodes: [],
        moduleNodes: [{ name: 'Nested Kit', subCategories: [{ name: 'Visuals', items: ['nested.kit.Panel'] }] }]
      },
      projectsettings: { ports: [], dynamicports: [] }
    } as unknown as NodeLibraryData;
    const emptied = library([], []);

    const groups = groupsAfter([nested, emptied]);
    expect(groups).toEqual([{ name: 'Nested Kit', subCategories: [{ name: 'Visuals', items: ['nested.kit.Panel'] }] }]);
  });

  it('republishes when it prunes, so the panel is not left rendering the stale list', () => {
    /*
     * 🔴 The half that is easy to miss: `updateIndex` only writes `window.NodeLibraryData` and
     * calls `reload()` when something changed, so a prune that did not reach a republish would
     * leave the panel showing the old group until something unrelated forced one — precisely the
     * shape of the CN-014 bug this file sits next to.
     *
     * ⚠️ **It rides the existing trigger rather than adding one, and that is asserted here rather
     * than assumed.** A group item can only be pruned once its name has left `nodeNames`, and
     * `nodetypes` is filtered against the same set — so the removal that prunes the group also
     * removes the node type. A first draft added `|| removedModuleNodes.length > 0`; no test could
     * reach it, so it was removed instead of kept green.
     */
    const importer = new NodeLibraryImporter();
    importer.onClientImport('viewer-1', 'browser' as RuntimeType, fresh(HEALTHY));
    reload.mockClear();
    importer.onClientImport('viewer-1', 'browser' as RuntimeType, fresh(BROKEN));

    expect(reload).toHaveBeenCalled();
    const published = (global as unknown as { window: { NodeLibraryData: NodeLibraryData } }).window.NodeLibraryData;
    expect(published.nodeIndex.moduleNodes.map((g) => g.name)).toEqual(['Grow Kit']);
    // ⚠️ Not an exact list: constructing an importer merges the shipped cloud node library (84
    // built-ins) on top of the browser report, so `nodetypes` is 85 here. The property is that the
    // kit's type left with its group, not that the payload is only this kit.
    const names = published.nodetypes.map((n) => n.name);
    expect(names).toContain('nodegx.grow.Alpha');
    expect(names).not.toContain('nodegx.broken.Intact');
  });
});
