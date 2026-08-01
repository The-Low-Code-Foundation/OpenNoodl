/**
 * NDA-012 (Visual) — DB-ii run over the category, and what survived it.
 *
 * `FINDINGS` DB-ii: `registerInput` writes a declared `default` straight into
 * `_inputValues` ([`node.ts:116-118`]) and `NodeScope` queues for update only the keys the
 * *model* carries ([`nodescope.ts:148-157`]), so **a port that has a default and no authored
 * parameter never runs its setter**. It found three dead nodes in Data and had never been
 * run outside it.
 *
 * It has now been run over Visual, differentially: build the same node twice — once with no
 * authored parameters, once with exactly one port authored at *its own declared default* —
 * and diff the resulting instance state. 687 ports in the category declare a default and
 * carry a custom `set`; **242 of them differ**. Almost all of that is noise, and the noise is
 * the interesting part: this file pins the two that are real, the one adjacent defect the
 * sweep turned up, and — deliberately — the four mechanisms that absorb the rest. Without
 * those last rows the next person to run the predicate reads 242 and files 242 defects.
 *
 * ⚠️ Visual nodes are `react-component-node` nodes, which have a *second* route for a
 * default: `initialize()` copies `inputProps`/`inputCss` defaults into `props`/`startStyle`
 * ([`react-component-node.ts:753-766`, `:827-846`]). That route is why Visual is not full of
 * dead nodes the way Data was — and why V-i, where **both** routes are blocked, is the
 * shape worth looking for rather than DB-ii on its own.
 */

/* eslint-env jest */

import Layout from '../../src/layout';
import NavigationHandler from '../../src/nodes/navigation/navigation-handler';

import { createCorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the first `require` below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const ButtonModule = require('../../src/nodes/controls/button').default;
const IconModule = require('../../src/nodes/visual/icon').default;
const TextModule = require('../../src/nodes/visual/text').default;
const ComponentStackModule = require('../../src/nodes/navigation/navigation-stack').default;
const PageRouterModule = require('../../src/nodes/navigation/router').default;
/* eslint-enable @typescript-eslint/no-var-requires */

interface Probed {
  style: Record<string, unknown>;
  props: Record<string, unknown>;
}

/**
 * The same node with and without the port authored, after one frame.
 *
 * `bare` is what an author gets by dropping the node on a canvas and touching nothing;
 * `authored` is what they get by opening the port and typing in the value the property
 * panel was *already showing them*. Those two should be the same node.
 */
async function bareVsAuthored(module: any, port: string, value: unknown): Promise<[Probed, Probed]> {
  const graph = await createCorpusGraph({
    modules: [module],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'bare', type: module.node.name, parameters: {} },
            { id: 'authored', type: module.node.name, parameters: { [port]: value } }
          ]
        }
      ]
    } as never
  });
  // The text-style ports resolve through the project's style sheet; without it their
  // setters throw, and the throw rather than the default becomes what the diff measures.
  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();
  return [graph.node('bare') as unknown as Probed, graph.node('authored') as unknown as Probed];
}

describe('V-i — Button and Icon declare a padding default that reaches nothing', () => {
  // Padding is registered through `addPaddingInputs`, and every one of its four ports carries
  // `applyDefault: false` (node-shared-port-definitions.ts:277, 291, 310, 327). That switch
  // blocks the `startStyle` route at react-component-node.ts:753. DB-ii blocks the setter
  // route. So for a node that passes a NON-ZERO default, the value is applied by neither —
  // and `Button` (20/5) and `Icon` (5) are the only two of the fourteen callers that do.
  //
  // No node's `defaultCss` sets padding, so the `applyDefault: false` guard is not protecting
  // anything; it only costs these two nodes their declared padding.
  it.each([
    ['Button', 'paddingLeft', 20, '20px'],
    ['Button', 'paddingTop', 5, '5px'],
    ['Icon', 'paddingLeft', 5, '5px'],
    ['Icon', 'paddingTop', 5, '5px']
  ])('%s declares %s = %s and renders none of it', async (label, port, declared, expected) => {
    const module = label === 'Button' ? ButtonModule : IconModule;
    const [bare, authored] = await bareVsAuthored(module, port as string, declared);

    // What an author who never touched the port gets: no padding at all.
    expect(bare.style[port as string]).toBeUndefined();
    // What the property panel has been showing them all along.
    expect(authored.style[port as string]).toBe(expected);
  }, 30000);
});

describe('V-ii — Component Stack says it clips and does not', () => {
  // `navigation-stack.tsx:258-266` is the only thing that writes `overflow: hidden`, and its
  // port declares `default: true`. The node's `defaultCss` (:211-217) has no `overflow`, so a
  // stack whose panel reads "Clip Content ✓" lets a taller pushed component spill out of it.
  it('Clip Content defaults to true and never applies', async () => {
    const [bare, authored] = await bareVsAuthored(ComponentStackModule, 'clip', true);

    expect(bare.style.overflow).toBeUndefined();
    expect(authored.style.overflow).toBe('hidden');
  }, 30000);

  // The control, and the reason V-ii is Component Stack's alone: Page Router has the same
  // port shape, but its default enum value takes the `removeStyle` branch (router.tsx:180),
  // which is a no-op on a node that never had the style. Not running the setter costs it
  // nothing.
  it('Page Router has the same shape and is unaffected', async () => {
    const [bare, authored] = await bareVsAuthored(PageRouterModule, 'clip', 'contentHeight');

    expect(bare.style.overflow).toBeUndefined();
    expect(authored.style.overflow).toBeUndefined();
  }, 30000);
});

describe('V-iii — the `Auto` sentinel is unit-suffixed on one port and not the other', () => {
  // `letterSpacing` and `lineHeight` both default to the sentinel string `'Auto'`, and only
  // `letterSpacing` is declared with `units: ['px']`. So authoring the value the panel
  // already shows produces `letter-spacing: Autopx` — not a CSS value at all.
  //
  // The net effect is benign: a browser drops an invalid declaration, which is roughly what
  // "Auto" is asking for. It is pinned because the two ports spell the same intent two
  // different ways and neither is the CSS keyword, so any future code that reads the style
  // back — an export, an SSR pass, a style inspector — sees one of two junk values.
  it('letterSpacing Auto becomes "Autopx" and lineHeight Auto stays "Auto"', async () => {
    const [, spacing] = await bareVsAuthored(TextModule, 'letterSpacing', 'Auto');
    expect(spacing.style.letterSpacing).toBe('Autopx');

    const [, height] = await bareVsAuthored(TextModule, 'lineHeight', 'Auto');
    expect(height.style.lineHeight).toBe('Auto');
  }, 30000);
});

/**
 * The rest of the 242 — why the predicate firing is not the same as a defect.
 *
 * Each of these is a port where the declared default demonstrably does not run its setter,
 * and where something downstream makes that cost nothing. They are rows rather than a
 * paragraph because the next person to run this sweep will get 242 hits and needs to be able
 * to subtract these without re-deriving them.
 */
describe('the compensations — measured, so the next sweep can subtract them', () => {
  it('Component Stack: an unregistered name still resolves, because the handler normalises', () => {
    // `_internal.name` never leaves `undefined` (the `default: 'Main'` setter does not run),
    // and `Navigate`'s `Stack` port has the identical shape and the identical hole. Both are
    // absorbed here: all four entry points do `name = name || 'Main'`.
    const stack = { navigate() {}, replace() {}, reset() {} };
    NavigationHandler.instance.registerPageStack(undefined as unknown as string, stack);

    // Registered under `undefined`, findable under the name an author would actually type.
    expect((NavigationHandler.instance as any)._pageStacks['Main']).toContain(stack);

    NavigationHandler.instance.deregisterPageStack(undefined as unknown as string, stack);
    expect((NavigationHandler.instance as any)._pageStacks['Main']).toBeUndefined();
  });

  it('Radio Button Group: an unset parent layout is read as column, which is the default', () => {
    // `flexDirection`'s setter calls `setLayout`, so `props.layout` stays undefined and the
    // children see `parentLayout: undefined`. `layout.ts:126` falls back to `'column'` — the
    // same value the port declares.
    const asColumn: Record<string, unknown> = { position: 'relative' };
    Layout.align(asColumn, { parentLayout: undefined, alignX: 'center' });

    const explicit: Record<string, unknown> = { position: 'relative' };
    Layout.align(explicit, { parentLayout: 'column', alignX: 'center' });

    expect(asColumn).toEqual(explicit);
    expect(asColumn.alignSelf).toBe('center');
  });

  it('the inert majority: the authored value is the CSS initial value', async () => {
    // `transform: translateX(0px)`, `mixBlendMode: normal`, `pointerEvents: auto`,
    // `borderStyle: none`, `position: relative`, `opacity: 1`, `flexWrap: nowrap`,
    // `wordBreak: normal`, `textTransform: none`, `backgroundColor: transparent` and the
    // zero-valued paddings and gaps are all of this shape: the setter writes a declaration
    // that changes nothing, so never writing it changes nothing either. One is enough to
    // characterise the class.
    const [bare, authored] = await bareVsAuthored(TextModule, 'transformX', 0);

    expect(bare.style.transform).toBeUndefined();
    expect(authored.style.transform).toBe('translateX(0px) ');
  }, 30000);
});
