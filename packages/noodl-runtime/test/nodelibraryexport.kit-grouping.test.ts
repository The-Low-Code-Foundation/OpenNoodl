/**
 * CN-018 — the node picker names the kit a node came from.
 *
 * ## Why this suite exists
 *
 * `generateNodeLibrary` builds `nodeIndex.moduleNodes`, which
 * `createnodeindex.ts` renders as the subcategories of the picker's "External
 * libraries" section. It used to emit **one** group named `''` holding every
 * module-registered node in the project, discarding `metadata.module` after
 * using it as a boolean.
 *
 * 🔴 **The consequence was measured in a running editor (CN-006 s11), not
 * inferred.** Two kits each shipping a `Stat Tile` drew two cards in the picker
 * that were identical on every visible axis — name, category, `title` tooltip —
 * separable only by a `data-test` attribute. An author with two kits installed
 * could not tell which node they were about to place.
 *
 * ⚠️ **Nothing could have caught it, and the reason is worth keeping.** Every
 * fixture in the repo that exercises kits installs exactly *one* kit, and with
 * one kit an unnamed group is indistinguishable from a correctly-named one that
 * happens to be collapsed. The defect only becomes visible at two, so the
 * central case here registers two kits — a one-kit assertion would pass against
 * the old code.
 *
 * The name itself was never missing: `NoodlRuntime.registerModule` stamps
 * `module.name || 'Unknown Module'` onto each definition, and CN-003 made that
 * name the manifest's. This suite grades the last hop, exporter → editor.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import generateNodeLibrary = require('../src/nodelibraryexport');

interface ModuleGroup {
  name: string;
  items: string[];
}

/**
 * A minimal registerable node. `module` is the field
 * `NoodlRuntime.registerModule` stamps in production; setting it directly is
 * what that function does, so this is the real shape rather than a stand-in.
 */
function kitNode(name: string, moduleName?: string) {
  return {
    name,
    displayNodeName: name,
    category: 'Logic',
    module: moduleName,
    inputs: {
      value: {
        type: 'string',
        set: function () {
          /* nothing: this suite only reads exported metadata */
        }
      }
    },
    outputs: {}
  };
}

function moduleGroups(...definitions: unknown[]): ModuleGroup[] {
  const context = new NodeContext();
  for (const def of definitions) {
    context.nodeRegister.register(NodeDefinition.defineNode(def as never));
  }
  const library = generateNodeLibrary(context.nodeRegister) as {
    nodeIndex: { moduleNodes?: ModuleGroup[] };
  };
  return library.nodeIndex.moduleNodes || [];
}

describe('node library export — the picker names each kit', () => {
  it('gives two kits two separately-named groups', () => {
    // 🔴 The whole finding. Before the fix this was a single `{ name: '', items:
    // [both] }`, so two kits' nodes were indistinguishable in the picker.
    const groups = moduleGroups(kitNode('alpha.StatTile', 'Alpha Kit'), kitNode('beta.StatTile', 'Beta Kit'));

    expect(groups.map((g) => g.name)).toEqual(['Alpha Kit', 'Beta Kit']);
    expect(groups.map((g) => g.items)).toEqual([['alpha.StatTile'], ['beta.StatTile']]);
  });

  it('keeps a kit’s several nodes together under its one name', () => {
    // The other half of grouping: not just "split by kit" but "do not split
    // *within* a kit". A per-node group would also make the test above pass.
    const groups = moduleGroups(
      kitNode('alpha.StatTile', 'Alpha Kit'),
      kitNode('alpha.Sparkline', 'Alpha Kit'),
      kitNode('beta.StatTile', 'Beta Kit')
    );

    expect(groups.length).toBe(2);
    const alpha = groups.find((g) => g.name === 'Alpha Kit');
    expect(alpha?.items).toEqual(['alpha.StatTile', 'alpha.Sparkline']);
  });

  it('orders groups by name, not by registration order', () => {
    // Module load order is an implementation detail no author can predict, so
    // registration order would shuffle the picker between sessions. Registered
    // deliberately backwards.
    const groups = moduleGroups(
      kitNode('z.Node', 'Zebra Kit'),
      kitNode('a.Node', 'Aardvark Kit'),
      kitNode('m.Node', 'Marmot Kit')
    );

    expect(groups.map((g) => g.name)).toEqual(['Aardvark Kit', 'Marmot Kit', 'Zebra Kit']);
  });

  it('keeps an unattributable kit as its own named group', () => {
    // `'Unknown Module'` is `registerModule`'s fallback for a kit whose manifest
    // names it nothing. It is a real answer, not a sentinel to filter: merging it
    // into a neighbour's section would attribute one author's node to another.
    const groups = moduleGroups(kitNode('alpha.StatTile', 'Alpha Kit'), kitNode('mystery.Node', 'Unknown Module'));

    expect(groups.map((g) => g.name)).toEqual(['Alpha Kit', 'Unknown Module']);
    expect(groups.find((g) => g.name === 'Unknown Module')?.items).toEqual(['mystery.Node']);
  });

  it('omits moduleNodes entirely when a project has no kits', () => {
    // The control. A built-in node declares no `module`, and the picker must not
    // grow an empty "External libraries" section — `createnodeindex.ts` guards on
    // `moduleNodes?.length`, so an empty array would be tolerated, but a group
    // named `undefined` would not.
    const groups = moduleGroups(kitNode('std.Plain', undefined));

    expect(groups).toEqual([]);
  });

  it('does not sweep built-ins into a kit’s group', () => {
    // The second control, and the one that would catch a fix that grouped by
    // something other than `module` — e.g. by the node name's prefix, which would
    // read the same on every fixture above.
    const groups = moduleGroups(kitNode('alpha.StatTile', 'Alpha Kit'), kitNode('alpha.Builtin', undefined));

    expect(groups.length).toBe(1);
    expect(groups[0].items).toEqual(['alpha.StatTile']);
  });
});
