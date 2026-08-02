/**
 * ERG-004 live QA — the node library's export must not drop what the node documented.
 *
 * ## Why this suite exists
 *
 * `generateNodeLibrary` builds the blob the editor receives over `sendNodeLibrary`. Input
 * ports went through `formatPort`, which copies `description`. **Static output ports went
 * through a hand-copied near-duplicate that did not.**
 *
 * Measured live against the running editor's `NodeLibrary` on 2026-08-02, before the fix:
 * **1656 of 1809 input ports carried a description and 0 of 1144 outputs did.** Not one.
 * Every `description` written on an output port across the library — including all of phase
 * 30's documentation pass — reached the editor stripped.
 *
 * ⚠️ **Nothing caught it, and the reason generalises.** The node definitions had the text.
 * The generated catalog had the text (1045/1144), because `catalog:check` builds its ports
 * from its own capture of the node definitions and only borrows `typecasts` and the picker
 * index from this file — so the catalog gates were green over a library the editor could
 * not see. The defect lived in exactly the one hop that no fixture covered: runtime → editor.
 *
 * This suite covers that hop directly, which is the only reason it can fail.
 */

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import generateNodeLibrary = require('../src/nodelibraryexport');

/** The shape `generateNodeLibrary` emits for one port. */
interface ExportedPort {
  name: string;
  plug: string;
  type?: unknown;
  displayName?: unknown;
  description?: unknown;
  group?: unknown;
}

interface ExportedNodeType {
  name: string;
  ports?: ExportedPort[];
  dynamicports?: { ports?: ExportedPort[] }[];
}

/**
 * A node that documents one port of each plug, so a suite failure names which side
 * regressed rather than just "a description is missing".
 */
const DOCUMENTED_NODE = {
  name: 'test.PortDescriptions',
  displayNodeName: 'Port Descriptions',
  category: 'Logic',
  inputs: {
    watched: {
      type: 'string',
      displayName: 'Watched',
      group: 'General',
      description: 'INPUT-DESCRIPTION',
      set: function () {
        /* nothing: this suite only reads the exported metadata */
      }
    }
  },
  outputs: {
    fired: {
      type: 'signal',
      displayName: 'Fired',
      description: 'SIGNAL-OUTPUT-DESCRIPTION'
    },
    result: {
      type: 'string',
      displayName: 'Result',
      group: 'Change',
      description: 'VALUE-OUTPUT-DESCRIPTION',
      getter: function () {
        return '';
      }
    }
  }
};

function exportLibrary(...definitions: unknown[]) {
  const context = new NodeContext();
  for (const def of definitions) {
    context.nodeRegister.register(NodeDefinition.defineNode(def as never));
  }
  return generateNodeLibrary(context.nodeRegister) as { nodetypes: ExportedNodeType[] };
}

function portsOf(typeName: string, ...definitions: unknown[]): ExportedPort[] {
  const library = exportLibrary(...(definitions.length ? definitions : [DOCUMENTED_NODE]));
  const type = library.nodetypes.find((t) => t.name === typeName);
  if (!type) throw new Error(`"${typeName}" is not in the exported library`);
  return type.ports || [];
}

function port(name: string): ExportedPort {
  const found = portsOf('test.PortDescriptions').find((p) => p.name === name);
  if (!found) throw new Error(`no exported port named "${name}"`);
  return found;
}

describe('node library export — port descriptions survive the trip to the editor', () => {
  it('carries an input port description', () => {
    // The half that always worked. Here so a failure distinguishes "outputs regressed"
    // from "the whole description channel broke".
    expect(port('watched').description).toBe('INPUT-DESCRIPTION');
  });

  it('carries a signal output port description', () => {
    // 🔴 The regression. `Object Changed`'s Key Added / Key Changed / Object Replaced all
    // document what they mean; before the fix the editor received none of it.
    expect(port('fired').description).toBe('SIGNAL-OUTPUT-DESCRIPTION');
  });

  it('carries a value output port description', () => {
    expect(port('result').description).toBe('VALUE-OUTPUT-DESCRIPTION');
  });

  it('still carries the output fields that were never dropped', () => {
    // The fix replaced a hand-copied branch with a delegation, so the fields that branch
    // *did* copy have to keep arriving. `displayName` is what the canvas labels a port
    // with, and `group` is what collapses Key / Value / Previous Value into one section.
    const result = port('result');
    expect(result.displayName).toBe('Result');
    expect(result.group).toBe('Change');
    expect(result.plug).toBe('output');
    expect(result.type).toBe('string');
  });

  it('adds no key an output port did not declare', () => {
    // `formatPort` also knows about `default`, `tooltip`, `tab`, `popout` and
    // `allowVisualStates`. They are copied only when present, and an output port declares
    // none of them — measured across the committed catalog, where 0 of 1144 output ports
    // carry any of these. Pinned because `catalog:check` compares this file's output and
    // an unconditional assignment here would move it.
    //
    // `index` is in the list because `NodeDefinition.defineNode` stamps one onto every
    // port; it is not something the definition above declares.
    expect(Object.keys(port('fired')).sort()).toEqual([
      'description',
      'displayName',
      'index',
      'name',
      'plug',
      'type'
    ]);
  });
});

describe('node library export — the two ERG-004 nodes specifically', () => {
  /**
   * The nodes this was found through. Registered from their real definitions so the
   * assertion is about the shipped text, not a fixture's stand-in — which is precisely
   * the mistake that let NDA-017 ship a broken rule behind a green suite.
   */
  // Reached by relative path, the way the ERG-004 corpus rows already do it: the viewer
  // package is a sibling and is not resolvable as `@noodl/viewer-react` from this one.
  /* eslint-disable @typescript-eslint/no-var-requires */
  const ObjectChanged = require('../../noodl-viewer-react/src/nodes/std-library/objectchanged').default.node;
  const ArrayChanged = require('../../noodl-viewer-react/src/nodes/std-library/arraychanged').default.node;
  /* eslint-enable @typescript-eslint/no-var-requires */

  it('every one of their output ports reaches the editor documented', () => {
    const library = exportLibrary(ObjectChanged, ArrayChanged);
    const undocumented: string[] = [];
    for (const typeName of ['net.noodl.ObjectChanged', 'net.noodl.ArrayChanged']) {
      const type = library.nodetypes.find((t) => t.name === typeName);
      expect(type).toBeDefined();
      for (const p of type!.ports || []) {
        if (p.plug === 'output' && !p.description) undocumented.push(typeName + '.' + p.name);
      }
    }
    expect(undocumented).toEqual([]);
  });
});
