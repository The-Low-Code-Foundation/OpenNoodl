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
 * ## ✅ s29 — the blast radius DID move, and this file moved with it (D20)
 *
 * s28 left a row here asserting the radius on purpose — *"if a later session
 * decides a bad node should cost only itself, this is the test that must be
 * changed on purpose rather than the behaviour drifting under a naming commit."*
 * D20 is that decision, so the row is **rewritten to the new contract rather
 * than deleted**, and the guard it provides is inverted with it: what must not
 * drift now is that a kit is **atomic**.
 *
 * 🔴 **Atomic, not silent.** `registerModule` still throws. Two callers depend
 * on that throw to report a broken kit at all — `noodl-viewer-cloud`'s kit
 * loader and `noodl-mcp`'s kit extractor each wrap it in a `try` and push a
 * failure from the `catch` — and a swallowed throw would leave both of those
 * `catch` blocks dead while both surfaces called the kit healthy. What changed
 * is that the kit's already-registered nodes are **rolled back** first, so a
 * caller sees the whole kit or none of it, and `viewer.jsx` catches per module
 * so one bad kit no longer costs the app.
 *
 * ⚠️ Half a kit was the alarming state CN-015 named: the nodes before the bad
 * definition live, the ones after are gone, and the kit looks partly fine.
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

    it('states the consequence for a kit — which is now the KIT, not the app', () => {
      /*
       * 🔴 The whole reason this cost an afternoon: nothing connected "one missing field" to what
       * the author would actually see.
       *
       * ⚠️ **The sentence had to change with D20 and this row is why it is checked.** It used to
       * end *"the preview renders nothing at all"*, which was true while the throw took the viewer
       * down. Shipping D20 made that clause a confident wrong answer — the exact shape of a
       * capability turning its own diagnostic into a lie — so the message now names the kit's own
       * nodes as the loss and says the rest of the app survives.
       */
      let message = '';
      try {
        NodeDefinition.defineNode({ name: 'B', module: 'Rename Kit' } as NodeDefinitionOptions);
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain("NONE of this kit's nodes register");
      expect(message).toContain('The rest of the app still runs');
      expect(message).not.toContain('preview renders nothing');
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
      expect(message).not.toContain("NONE of this kit's nodes register");
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

    it('✅ D20 — the kit is ATOMIC: the nodes BEFORE the bad one go too', () => {
      /*
       * 🔴 **This row asserted the opposite until s29, on purpose, and its replacement is the new
       * guard.** `nodegx.rename.Good` used to survive: the loop aborted where it broke, so the
       * nodes before the bad definition stayed registered and the ones after never did. That
       * half-registered kit is the state CN-015 named as the alarming one — the kit looks partly
       * fine — and D20 rejected fixing it by skipping just the bad node for exactly that reason.
       *
       * ⚠️ If a later session wants a bad node to cost only itself, this is again the test that
       * has to be changed deliberately rather than the behaviour drifting under a refactor.
       */
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

      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Good')).toBe(false);
      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Later')).toBe(false);
    });

    it('🔴 rolls back to the SHADOWED built-in, not to nothing', () => {
      /*
       * 🔴 **The hazard a delete-based rollback would have shipped.** Registration is
       * last-writer-wins and the viewer registers built-ins before kit nodes, so a kit is allowed
       * to shadow a built-in — `nodegx-kit-catalog`'s health check states that to authors as a
       * fact (D9). Undoing a failed kit by *deleting* its names would take the shadowed built-in
       * with it, and one bad node in one kit would silently cost the project its `Group`.
       *
       * ⚠️ The control is the identity of the definition, not `hasNode`: a delete-based rollback
       * that happened to leave *something* there would pass a presence check.
       */
      const rt = runtime();
      rt.registerNode({ node: { name: 'Group', category: 'Visual', getReactComponent: () => null } } as never);
      const builtIn = rt.context.nodeRegister.peek('Group');
      expect(builtIn).toBeDefined();

      expect(() =>
        rt.registerModule(
          kit([
            { name: 'Group', category: 'Visual', getReactComponent: () => null },
            { name: 'nodegx.rename.Bad', getReactComponent: () => null }
          ])
        )
      ).toThrow();

      expect(rt.context.nodeRegister.peek('Group')).toBe(builtIn);
    });

    it('unwinds its OWN overwrites in reverse, back to what preceded the kit', () => {
      /*
       * ⚠️ A kit may register the same type name twice — a copy-pasted definition, or a generated
       * one. Undoing forwards would restore the built-in and then immediately put the kit's first
       * version back on top of it, leaving a failed kit's node registered under a built-in's name.
       * Only the last write survives a forward unwind; only the first survives a reverse one, and
       * the first is what preceded the kit.
       */
      const rt = runtime();
      rt.registerNode({ node: { name: 'Group', category: 'Visual', getReactComponent: () => null } } as never);
      const builtIn = rt.context.nodeRegister.peek('Group');

      expect(() =>
        rt.registerModule(
          kit([
            { name: 'Group', category: 'Visual', getReactComponent: () => null },
            { name: 'Group', category: 'Visual', getReactComponent: () => null },
            { name: 'nodegx.rename.Bad', getReactComponent: () => null }
          ])
        )
      ).toThrow();

      expect(rt.context.nodeRegister.peek('Group')).toBe(builtIn);
    });

    it('rolls back a throw that comes from `setup`, not just from defineNode', () => {
      // The rollback must hang off the loop, not off `defineNode` — `setup` and
      // `setupNumberedInputDynamicPorts` run under the same loop and throw just as well.
      const rt = runtime();
      expect(() =>
        rt.registerModule({
          name: 'Rename Kit',
          nodes: [
            { name: 'nodegx.rename.First', category: 'Visual', getReactComponent: () => null },
            {
              node: { name: 'nodegx.rename.Second', category: 'Visual', getReactComponent: () => null },
              setup() {
                throw new Error('setup blew up');
              }
            }
          ]
        } as never)
      ).toThrow();

      expect(rt.context.nodeRegister.hasNode('nodegx.rename.First')).toBe(false);
      expect(rt.context.nodeRegister.hasNode('nodegx.rename.Second')).toBe(false);
    });

    it('keeps a failed kit out of `noodlModules`, so nothing downstream counts it as loaded', () => {
      // `noodlModules` is what `generateProjectSettings` and the kit-grouping export read. A kit
      // that registered nothing must not be in it, or it reports as installed-and-empty.
      const rt = runtime();
      const before = rt.noodlModules.length;
      expect(() => rt.registerModule(kit([{ name: 'B', getReactComponent: () => null }]))).toThrow();
      expect(rt.noodlModules.length).toBe(before);
    });

    it('CONTROL — a healthy kit is left registered, and the rollback never fires', () => {
      // 🔴 A rollback that ran on the good path would delete a working kit and every row above
      // would still be green: they all assert on the failing path.
      const rt = runtime();
      rt.registerModule(
        kit([
          { name: 'nodegx.rename.A', category: 'Visual', getReactComponent: () => null },
          { name: 'nodegx.rename.B', category: 'Visual', getReactComponent: () => null }
        ])
      );
      expect(rt.context.nodeRegister.hasNode('nodegx.rename.A')).toBe(true);
      expect(rt.context.nodeRegister.hasNode('nodegx.rename.B')).toBe(true);
      expect(rt.noodlModules).toHaveLength(1);
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
