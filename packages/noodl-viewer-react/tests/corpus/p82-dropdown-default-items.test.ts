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

/**
 * ⚠️ Value mirrors Label since 2026-09-06 — Richard: *"the default value when placing a dropdown
 * node is 'option-1' even though the label is 'Option 1' which will further confuse the user."*
 * The rows below grade the seeding, not the spelling, but the literals have to agree with
 * `options.ts` or they would grade a stale one.
 */
const DEFAULT_ITEMS = [
  { Label: 'Option 1', Value: 'Option 1' },
  { Label: 'Option 2', Value: 'Option 2' }
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

/**
 * Richard, 2026-09-04, after the two default items landed: *"The value input port should be by
 * default set to the first item in the default list when the node is placed … so the user
 * immediately sees a dropdown in the preview with a real option, not just a horizontally collapsed
 * input."*
 *
 * 🔴 **The items alone did not make the Dropdown visible, and these rows say why.** `Select.tsx`
 * draws the selected label into a `<span>`; the native `<select>` is `opacity: 0` and overlaid for
 * interaction only. That span is fed `items[selectedIndex].Label`, and `selectedIndex` is `-1`
 * while `value` is `undefined` — so the options existed and the node still measured no content at
 * its `contentSize` default. These rows therefore grade **what the span would draw**, computed the
 * way `Select.tsx` computes it, rather than the port's declaration.
 */
describe('the first default item is selected when the node is placed', () => {
  it('a never-authored Dropdown hands Select a value that matches an option', async () => {
    const [dropdown] = await makeDropdowns(['dropdown']);

    expect(dropdown.props.value).toBe(DEFAULT_ITEMS[0].Value);
  });

  it("so Select's own selectedIndex resolves a Label, which is what the visible span draws", async () => {
    const [dropdown] = await makeDropdowns(['dropdown']);

    // `Select.tsx`'s line, not a paraphrase of it: an index of -1 is what left the span empty.
    const items = dropdown.props.items as { Value: string; Label: string }[];
    const value = dropdown.props.value as string | undefined;
    const selectedIndex = !items || value === undefined ? -1 : items.findIndex((i) => i.Value === value);

    expect(selectedIndex).toBe(0);
    expect(items[selectedIndex].Label).toBe('Option 1');
  });

  /**
   * ⚠️ The trap this row exists for. `Select`'s mount effect calls `valueChanged(props.value)`
   * unconditionally, and `valueChanged` fires **Changed** whenever the value it receives differs
   * from `_internal.value`. Seeding `props.value` without `_internal.value` would make every
   * placed Dropdown emit a signal it promises not to emit — and the node would look correct on
   * screen the whole time, so only this row would notice.
   */
  it('and the mount does not fire Changed, because _internal agrees with props', async () => {
    const [dropdown] = await makeDropdowns(['dropdown']);

    const node = dropdown as unknown as {
      _internal: { value?: string };
      props: { valueChanged: (v: string) => void };
      sendSignalOnOutput: (name: string) => void;
    };

    expect(node._internal.value).toBe(DEFAULT_ITEMS[0].Value);

    const signals: string[] = [];
    node.sendSignalOnOutput = (name: string) => signals.push(name);

    // Exactly what `Select`'s `useEffect` does on first render.
    node.props.valueChanged(dropdown.props.value as string);

    expect(signals).toEqual([]);
  });

  it('the value output reads the same selection the screen shows', async () => {
    const [dropdown] = await makeDropdowns(['dropdown']);

    // ⚠️ Asserted against the LITERAL, not against `props.value`. Comparing the two fields to each
    // other passes in the reverted arm too, where both are `undefined` — a row that agrees with
    // both arms grades nothing. The output's getter reads `_internal.value`, so a seed that set
    // only `props` would leave the graph reading `undefined` while the span drew "Option 1".
    const internal = (dropdown as unknown as { _internal: { value?: string } })._internal;

    expect(internal.value).toBe(DEFAULT_ITEMS[0].Value);
    expect(internal.value).toBe(dropdown.props.value);
  });

  it('an authored value still wins over the default', async () => {
    const graph = await createCorpusGraph({
      modules: [OptionsModule as never],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'dropdown', type: OptionsModule.node.name, parameters: { value: 'Option 2' } }]
          }
        ]
      } as never
    });
    (graph.context as unknown as { styles: unknown }).styles = {
      getTextStyle: () => ({}),
      resolveColor: (c: unknown) => c
    };
    graph.update();

    const dropdown = graph.node('dropdown') as unknown as DrivableNode;

    expect(dropdown.props.value).toBe('Option 2');
  });
});
