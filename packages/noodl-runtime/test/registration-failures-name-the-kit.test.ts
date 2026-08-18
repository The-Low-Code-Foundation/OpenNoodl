/**
 * CN-015 (s28) — a rejected definition says which node, in which kit.
 *
 * ## The failure this pins, as it was actually hit
 *
 * s27 gave a kit's logic node no `category`. The preview rendered **nothing** —
 * `reactMounted: false`, `rootChildren: 0` — and the only signal anywhere was:
 *
 * ```
 * EXCEPTION Uncaught: Error: Node must have a category
 *     at Object.defineNode … at NoodlRuntime.registerNode / registerModule
 * ```
 *
 * No kit, no node, no file. 🔴 **That reads exactly like a dead renderer**, and
 * it costs an afternoon: the editor's node library then reads *empty* too,
 * because the editor's library comes from the viewer and the viewer had died —
 * a second symptom that looks like a second fault.
 *
 * The names were never missing from the data. `registerModule` stamps
 * `node.module` **before** calling `registerNode`, and in the `category` case
 * `opts.name` is the very next check in `defineNode`.
 *
 * ⚠️ **Blast radius is deliberately unchanged and is asserted as such below.**
 * One bad definition still aborts the module and still takes the viewer down.
 * Whether it should instead cost only its own node is a trade with an owner —
 * a quietly missing node against a loud dead app — and it is queued as a
 * ruling, not decided inside a naming fix.
 */
import NodeDefinition = require('../src/nodedefinition');
import NoodlRuntime = require('../noodl-runtime');

import type { NodeDefinitionOptions } from '@noodl/types';

function runtime() {
  return new NoodlRuntime({
    type: 'browser',
    platform: {
      requestUpdate: () => undefined,
      getCurrentTime: () => 0,
      objectToString: (o: unknown) => JSON.stringify(o)
    }
  });
}

/** What a kit hands `Noodl.defineModule`. */
function kit(nodes: unknown[], name = 'Rename Kit') {
  return { name, nodes } as { name: string; nodes: NodeDefinitionOptions[] };
}

describe('CN-015 — a rejected definition names the node and the kit', () => {
  describe('defineNode, called directly', () => {
    it('names the node when it has one and the category is missing', () => {
      expect(() =>
        NodeDefinition.defineNode({ name: 'nodegx.rename.Badge' } as NodeDefinitionOptions)
      ).toThrow(/node "nodegx\.rename\.Badge"/);
    });

    it('names the kit when the definition carries one', () => {
      expect(() =>
        NodeDefinition.defineNode({ name: 'nodegx.rename.Badge', module: 'Rename Kit' } as NodeDefinitionOptions)
      ).toThrow(/in kit "Rename Kit"/);
    });

    it('keeps the original sentence, which callers match on', () => {
      // `health.js` passes a failure message straight through and the editor's
      // kits panel renders it verbatim, so the phrase is part of the contract.
      expect(() => NodeDefinition.defineNode({ name: 'X' } as NodeDefinitionOptions)).toThrow(
        'Node must have a category'
      );
    });

    it('states the consequence for a kit, so the blank preview is explained', () => {
      // 🔴 The whole reason this cost an afternoon: nothing connected "one
      // missing field" to "the entire app renders nothing".
      expect(() =>
        NodeDefinition.defineNode({ name: 'B', module: 'Rename Kit' } as NodeDefinitionOptions)
      ).toThrow(/preview renders nothing/);
    });

    it('gives a built-in no kit and no kit-only advice', () => {
      // ⚠️ A built-in is defined with no `module`. Naming a kit here, or telling
      // this repository's own maintainer to "add a category to your kit", would
      // be a confident wrong answer — the failure mode this task exists to end.
      let message = '';
      try {
        NodeDefinition.defineNode({ name: 'Group' } as NodeDefinitionOptions);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('node "Group"');
      expect(message).not.toContain('in kit');
      expect(message).not.toContain('preview renders nothing');
    });

    it('names the kit for a definition with no name at all', () => {
      // The one case where the node cannot be named — so the kit must be.
      let message = '';
      try {
        NodeDefinition.defineNode({ category: 'Visual', module: 'Rename Kit' } as NodeDefinitionOptions);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('Node must have a name');
      expect(message).toContain('in kit "Rename Kit"');
    });
  });

  describe('registerModule, on the path a kit actually takes', () => {
    it('names the kit and the node for the category throw', () => {
      const rt = runtime();
      expect(() =>
        rt.registerModule(kit([{ name: 'nodegx.rename.Badge', getReactComponent: () => null }]))
      ).toThrow(/node "nodegx\.rename\.Badge".*in kit "Rename Kit"/s);
    });

    it('does not say the kit twice', () => {
      // Two layers now know the kit's name; only one of them may say it.
      const rt = runtime();
      let message = '';
      try {
        rt.registerModule(kit([{ name: 'B', getReactComponent: () => null }]));
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message.match(/in kit "Rename Kit"/g)).toHaveLength(1);
    });

    it('names the kit for a throw that does not come from defineNode', () => {
      // 🔴 `defineNode` is not the only thing that can throw under this loop —
      // `setup` runs here too, and was unattributed in exactly the same way.
      const rt = runtime();
      const exploding = {
        node: { name: 'nodegx.rename.Fine', category: 'Visual', getReactComponent: () => null },
        setup() {
          throw new Error('setup blew up');
        }
      };

      let message = '';
      try {
        rt.registerModule({ name: 'Rename Kit', nodes: [exploding] } as never);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('Rename Kit');
      expect(message).toContain('setup blew up');
    });

    it('locates a nameless definition by its position in the module', () => {
      const rt = runtime();
      let message = '';
      try {
        rt.registerModule(
          kit([
            { name: 'nodegx.rename.First', category: 'Visual', getReactComponent: () => null },
            { category: 'Visual', getReactComponent: () => null }
          ])
        );
      } catch (e) {
        message = (e as Error).message;
      }
      // The failing definition is precisely the one whose name may be missing,
      // so the index is what the author scrolls to in their index.js.
      expect(message).toContain('index 1');
      expect(message).toContain('Rename Kit');
    });

    it('still aborts the module — the blast radius did not move', () => {
      // ⚠️ A control on the change itself. If a later session decides a bad node
      // should cost only itself, this is the test that must be changed on
      // purpose rather than the behaviour drifting under a "naming" commit.
      const rt = runtime();
      expect(() =>
        rt.registerModule(
          kit([
            { name: 'nodegx.rename.Good', category: 'Visual', getReactComponent: () => null },
            { name: 'nodegx.rename.Bad', getReactComponent: () => null },
            { name: 'nodegx.rename.Later', category: 'Visual', getReactComponent: () => null }
          ])
        )
      ).toThrow();

      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Good')).toBe(true);
      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Later')).toBe(false);
    });

    it('registers a healthy kit in silence', () => {
      // 🔴 CN-015 AC5. A check that only ever passes on good input has not been
      // shown to work; one that fires on good input is worse than nothing.
      const rt = runtime();
      expect(() =>
        rt.registerModule(
          kit([
            { name: 'nodegx.rename.Badge', category: 'Visual', getReactComponent: () => null },
            { node: { name: 'nodegx.rename.Chip', category: 'Visual', getReactComponent: () => null } }
          ])
        )
      ).not.toThrow();

      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Badge')).toBe(true);
      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Chip')).toBe(true);
    });
  });
});
