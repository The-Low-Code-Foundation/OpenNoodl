/**
 * FB-015 AC4 — a port's `placeholder` survives the trip to the editor.
 *
 * The shape hint is metadata written on the node definition and read by the property panel, so it
 * crosses the runtime → editor hop that ERG-004 found silently deleting `description` on every
 * output port in the library. That hop still has exactly one fixture-free failure mode: a field the
 * node declares, the catalog gates see (they build their ports from their own capture of the node
 * definitions), and `formatPort` does not copy. This suite covers the hop directly.
 *
 * @see nodelibraryexport.port-descriptions.test.ts — the same seam, the same reason.
 */
import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import generateNodeLibrary = require('../src/nodelibraryexport');

interface ExportedPort {
  name: string;
  plug: string;
  placeholder?: unknown;
  description?: unknown;
  displayName?: unknown;
}

interface ExportedNodeType {
  name: string;
  ports?: ExportedPort[];
  dynamicports?: { ports?: ExportedPort[] }[];
}

/**
 * One input with a placeholder, one without, a dynamic input with one, and an output that carries
 * one on the definition and must not on the way out — the dynamic case because
 * dynamic ports reach the editor through `formatDynamicPorts`, which is a *second* call site of
 * `formatPort`. ERG-004's fix made that a delegation rather than a copy; this pins that it stayed
 * one, since a re-divergence is what dropped every output description last time.
 */
const NODE_WITH_PLACEHOLDERS = {
  name: 'test.PortPlaceholders',
  displayNodeName: 'Port Placeholders',
  category: 'Logic',
  inputs: {
    withHint: {
      type: 'string',
      displayName: 'With Hint',
      placeholder: 'small.png 480w, large.png 1080w',
      set: function () {
        /* nothing: this suite only reads the exported metadata */
      }
    },
    withoutHint: {
      type: 'string',
      displayName: 'Without Hint',
      set: function () {
        /* nothing */
      }
    },
    gated: {
      type: 'string',
      displayName: 'Gated',
      placeholder: 'DYNAMIC-PLACEHOLDER',
      set: function () {
        /* nothing */
      }
    }
  },
  outputs: {
    out: {
      type: 'string',
      displayName: 'Out',
      placeholder: 'OUTPUT-PLACEHOLDER',
      getter: function () {
        return '';
      }
    }
  },
  dynamicports: [{ condition: 'mode = advanced', inputs: ['gated'] }]
};

function exported(): ExportedNodeType {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(NODE_WITH_PLACEHOLDERS as never));
  const library = generateNodeLibrary(context.nodeRegister) as { nodetypes: ExportedNodeType[] };
  const type = library.nodetypes.find((t) => t.name === 'test.PortPlaceholders');
  if (!type) throw new Error('the node is not in the exported library');
  return type;
}

function staticPort(name: string): ExportedPort {
  const found = (exported().ports || []).find((p) => p.name === name);
  if (!found) throw new Error(`no exported static port named "${name}"`);
  return found;
}

describe('node library export — port placeholders reach the editor', () => {
  it('carries an input port placeholder', () => {
    expect(staticPort('withHint').placeholder).toBe('small.png 480w, large.png 1080w');
  });

  /**
   * 🔴 The control. Without it, a `formatPort` that stamped every port with the same string —
   * or one that copied a stray value off the node — would pass the assertion above.
   */
  it('leaves a port that declares none without one', () => {
    expect(staticPort('withoutHint').placeholder).toBeUndefined();
    // …and the port is genuinely exported, so this is not "the port is missing".
    expect(staticPort('withoutHint').displayName).toBe('Without Hint');
  });

  /**
   * Input-only, on purpose. An output port renders no editable field, so a placeholder on one has
   * nowhere to show; `default`, `tab`, `popout` and `allowVisualStates` are already input-only in
   * the same metadata builder. Pinned so the choice is a decision somebody can find and reverse,
   * rather than a gap that reads like the bug ERG-004 fixed on this same path.
   */
  it('deliberately does NOT carry it on an output port', () => {
    expect(staticPort('out').placeholder).toBeUndefined();
    expect(staticPort('out').displayName).toBe('Out');
  });

  it('carries it on a dynamic port, the second call site of formatPort', () => {
    const groups = exported().dynamicports || [];
    const gated = groups.flatMap((g) => g.ports || []).find((p) => p.name === 'gated');
    expect(gated).toBeDefined();
    expect(gated.placeholder).toBe('DYNAMIC-PLACEHOLDER');
  });
});
