/**
 * P77 SBR-008 §9 — `wireDeclaredPortPrefix` must survive the trip to the editor.
 *
 * ## The defect this covers
 *
 * `recordWiredFieldPorts` (SBR-008 §7) mints `prop-<field>` from a node's own wires, so that
 * a fresh site can name a column nothing has written yet. It could not do that job, and the
 * reason is a loop:
 *
 * ```
 *   editor health  →  exported wires  →  runtime ports  →  editor health
 * ```
 *
 * The runtime reads a node's wires off the component `exportComponent` handed it, and
 * `exportComponent` drops every wire the editor's health pass called unhealthy — which a wire
 * into a not-yet-minted `prop-` port is. So the wire never reached the runtime, the port was
 * never minted, and the verdict stayed true for ever.
 *
 * Measured 2026-09-02 on a wizard-fresh Site Builder project: the panel's create node
 * announced `prop-published`, `prop-showInNav` and `prop-navOrder` — **exactly its three
 * saved parameters** — and neither `prop-title` nor `prop-slug`, which arrive only over a
 * wire. A page created through the New page dialog had no title and no slug, the `Page`
 * class never grew the columns, and the page editor's save wrote nothing at all.
 *
 * The loop is broken by the node type *telling the editor* that ports under a prefix are
 * declared by wires, so the editor stops calling such a wire broken before the runtime can
 * mint the port. That declaration has to cross runtime → editor to be worth anything.
 *
 * ## 🔴 Why this file exists rather than a test of the behaviour
 *
 * That hop is the one no fixture covers, and it swallowed this field **twice** while it was
 * being built: `defineNode` copies `opts` into `metadata` through an explicit whitelist, and
 * `generateNodeLibrary` copies `metadata` into the export through a second one. A field
 * missing from either is dropped in silence and looks exactly like a node that never
 * declared it. This is the same hole `nodelibraryexport.port-descriptions.test.ts` was
 * written for — 1656 input descriptions crossing and 0 output descriptions crossing, with
 * every catalog gate green over a library the editor could not see.
 *
 * ⚠️ **What this file deliberately does not claim.** It grades the declaration, not the
 * repair. Whether a wire-declared port actually bootstraps is a property of the editor's
 * health pass and was measured by driving the product (SBR-008 §9); a spec here that
 * asserted it would be asserting something this package cannot see.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import generateNodeLibrary = require('../src/nodelibraryexport');

interface ExportedNodeType {
  name: string;
  wireDeclaredPortPrefix?: string;
  haveComponentPorts?: boolean;
}

/** A node that declares the prefix, standing in for the Record family. */
const DECLARING_NODE = {
  name: 'test.WireDeclared',
  category: 'Data',
  wireDeclaredPortPrefix: 'prop-',
  inputs: {
    stored: {
      type: 'signal',
      set: function () {
        /* no-op */
      }
    }
  },
  outputs: {}
};

/**
 * The control: same shape, same category, no declaration. Without it, "the field is present"
 * is also what an export that stamps the prefix onto everything would produce.
 */
const PLAIN_NODE = {
  name: 'test.PlainNode',
  category: 'Data',
  inputs: {
    stored: {
      type: 'signal',
      set: function () {
        /* no-op */
      }
    }
  },
  outputs: {}
};

function exportedTypes(...definitions: unknown[]): ExportedNodeType[] {
  const context = new NodeContext();
  for (const def of definitions) {
    context.nodeRegister.register(NodeDefinition.defineNode(def as never));
  }
  return (generateNodeLibrary(context.nodeRegister) as { nodetypes: ExportedNodeType[] }).nodetypes;
}

function typeNamed(name: string): ExportedNodeType {
  const found = exportedTypes(DECLARING_NODE, PLAIN_NODE).find((t) => t.name === name);
  if (!found) throw new Error(`"${name}" is not in the exported library`);
  return found;
}

describe('node library export — a wire-declared port prefix reaches the editor', () => {
  it('carries wireDeclaredPortPrefix for a node that declares it', () => {
    // 🔴 The regression. Dropped by `defineNode`'s metadata whitelist first and by
    // `generateNodeLibrary`'s second; each time the editor simply saw a node that had not
    // declared anything, and each time the wire stayed red for ever.
    expect(typeNamed('test.WireDeclared').wireDeclaredPortPrefix).toBe('prop-');
  });

  it('leaves it absent on a node that does not declare it', () => {
    // The negative control, and the reason the assertion above means anything: a `prop-`
    // present on every type would read identically to the field crossing correctly, and it
    // would suppress a real "port doesn't exist" warning on every node in the library.
    expect(typeNamed('test.PlainNode').wireDeclaredPortPrefix).toBeUndefined();
  });

  it('is carried by the three Record-family types that actually rely on it', () => {
    /**
     * The types the drive found broken, graded against the real modules rather than a
     * stand-in — `recordWiredFieldPorts`'s two callers plus the Record node, whose `prop-*`
     * are outputs (`/Pages/PageEditor` fills its form through `prop-title → startValue`).
     *
     * ⚠️ `NewDbModelProperties` and `SetDbModelProperties` receive the declaration from the
     * `dbmodelcrudbase` mixin rather than from their own definition object, so registering
     * the module's `node` is what tells us the mixin ran. Asserting it on the definitions
     * alone would pass with the mixin removed.
     */
    /* eslint-disable @typescript-eslint/no-var-requires */
    const modules: Record<string, { node?: unknown; default?: { node?: unknown } }> = {
      NewDbModelProperties: require('../src/nodes/std-library/data/newdbmodelpropertiesnode'),
      SetDbModelProperties: require('../src/nodes/std-library/data/setdbmodelpropertiesnode'),
      DbModel2: require('../src/nodes/std-library/data/dbmodelnode2')
    };
    /* eslint-enable @typescript-eslint/no-var-requires */

    const definitions = Object.values(modules).map((m) => (m.node ? m.node : (m.default as { node?: unknown }).node));
    const types = exportedTypes(...definitions);

    const seen: Record<string, string | undefined> = {};
    for (const name of Object.keys(modules)) {
      const type = types.find((t) => t.name === name);
      if (!type) throw new Error(`"${name}" is not in the exported library`);
      seen[name] = type.wireDeclaredPortPrefix;
    }

    // Asserted as one object so a failure names which of the three lost it, rather than
    // stopping at the first.
    expect(seen).toEqual({
      NewDbModelProperties: 'prop-',
      SetDbModelProperties: 'prop-',
      DbModel2: 'prop-'
    });
  });
});
