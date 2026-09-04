/**
 * P82 §A4 — Richard, 2026-09-04: *"We need to go back to the two default 'Option 1' 'Option 2'
 * items."* A freshly dragged Dropdown showed an empty select with nothing in the list; see
 * `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md` §3.
 *
 * ⚠️ **A `default` on the `items` port alone does not reach the render.** `items` has a custom
 * `set` (`options.ts`), and the runtime only seeds a port's `default` into `_inputValues` for an
 * unauthored input (`nodedefinition.ts`'s `initializeDefaultValues`) — it never calls the port's
 * own `set`, so `props.items` (what `Select.tsx` reads) stays `undefined` from that path alone.
 * `options.ts`'s `initialize` seeds `props.items` directly for that reason. This suite grades the
 * consequence — what a freshly placed, never-authored Dropdown actually hands its React
 * component — not the port declaration, which a static read cannot tell apart from a dead one.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the `require` below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const OptionsModule = require('../../src/nodes/controls/options').default;
/* eslint-enable @typescript-eslint/no-var-requires */

interface DrivableNode {
  props: Record<string, unknown>;
}

const DEFAULT_ITEMS = [
  { Label: 'Option 1', Value: 'option-1' },
  { Label: 'Option 2', Value: 'option-2' }
];

async function makeDropdowns(ids: string[]) {
  const graph = await createCorpusGraph({
    modules: [OptionsModule as never],
    data: {
      components: [
        {
          name: '/root',
          nodes: ids.map((id) => ({ id, type: OptionsModule.node.name, parameters: {} }))
        }
      ]
    } as never
  });

  // The text-style ports resolve through the project's style sheet; without it their setters
  // throw, and the throw rather than the behaviour becomes what the row measures.
  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();

  return ids.map((id) => graph.node(id) as unknown as DrivableNode);
}

it('a never-authored Dropdown renders the two default options', async () => {
  const [dropdown] = await makeDropdowns(['dropdown']);

  expect(dropdown.props.items).toEqual(DEFAULT_ITEMS);
});

it('the default is not a Collection — nothing binds a change listener to it', async () => {
  const [dropdown] = await makeDropdowns(['dropdown']);

  // `on`/`off` are installed on `Array.prototype` by `collection.ts`, so this only tells apart
  // "a plain default array, never sent through `set`" from "the port's own `default` object,
  // bound as if it were an authored Collection" — the leak this fix would cause if `initialize`
  // seeded `props.items` by reference from the port declaration instead of a fresh clone.
  expect(typeof (dropdown.props.items as { on?: unknown }).on).toBe('undefined');
});

it('two Dropdowns on the same page do not share one items array', async () => {
  const [a, b] = await makeDropdowns(['a', 'b']);

  expect(a.props.items).not.toBe(b.props.items);
});
