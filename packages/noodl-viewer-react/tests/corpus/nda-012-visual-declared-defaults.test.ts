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
const load = (path: string): ReactModule => require(path).default as ReactModule;

const ButtonModule = load('../../src/nodes/controls/button');
const IconModule = load('../../src/nodes/visual/icon');
const TextModule = load('../../src/nodes/visual/text');
const ComponentStackModule = load('../../src/nodes/navigation/navigation-stack');
const PageRouterModule = load('../../src/nodes/navigation/router');
/* eslint-enable @typescript-eslint/no-var-requires */

/** `NavigationHandler`'s private registry, which is the observable for the row below. */
const pageStacks = () =>
  (NavigationHandler.instance as unknown as { _pageStacks: Record<string, unknown[]> })._pageStacks;

/** What `createNodeFromReactComponent` returns, as far as these rows need it. */
interface ReactModule {
  node: { name: string; inputs: Record<string, { default?: unknown }> };
}

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
async function bareVsAuthored(module: ReactModule, port: string, value: unknown): Promise<[Probed, Probed]> {
  const graph = await createCorpusGraph({
    // `ReactModule` names only the two fields these rows read; the harness wants the full
    // definition, which `createNodeFromReactComponent` has already produced.
    modules: [module as never],
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

describe('V-i — Button and Icon used to declare a padding default that reached no style', () => {
  // Padding is registered through `addPaddingInputs`, and every one of its four ports carries
  // `applyDefault: false` (node-shared-port-definitions.ts:277, 291, 310, 327). That switch
  // blocks the `startStyle` route at react-component-node.ts:753. DB-ii blocks the setter
  // route. So for a node that passes a NON-ZERO default, the value is applied by neither —
  // and `Button` (20/5) and `Icon` (5) are the only two of the fourteen callers that do.
  //
  // No node's `defaultCss` sets padding, so the `applyDefault: false` guard is not protecting
  // anything.
  //
  // ⚠️ **The consequence differed between the two, and only live QA showed it** — see the
  // `renders` block below. These rows measure the mechanism; they never claimed the padding was
  // missing on screen.
  //
  // ✅ **Fixed 2026-08-01 by deleting both declarations.** Neither node passes `defaults` to
  // `addPaddingInputs` any more, so all eight ports default to 0 — which is what Icon has always
  // rendered, and what Button's ports have always contributed on top of its stylesheet rule. No
  // pixels move; the panel stops showing numbers that reach nothing.
  //
  // The mechanism rows below are kept as they were, because the mechanism is unchanged and still
  // applies to any future caller that passes a non-zero default: the point of the fix is that
  // there are now no such callers, and the row underneath measures exactly that.
  it.each([
    ['Button', 'paddingLeft', 20, '20px'],
    ['Button', 'paddingTop', 5, '5px'],
    ['Icon', 'paddingLeft', 5, '5px'],
    ['Icon', 'paddingTop', 5, '5px']
  ])(
    '%s: an authored %s = %s still reaches the style, and an untouched one still does not',
    async (label, port, declared, expected) => {
      const module = label === 'Button' ? ButtonModule : IconModule;
      const [bare, authored] = await bareVsAuthored(module, port as string, declared);

      // What an author who never touched the port gets: nothing on the node's own style. Before
      // the fix the panel showed them a number here; now it shows 0, which is the truth.
      expect(bare.style[port as string]).toBeUndefined();
      // The override route still works, which is the half that has to keep working.
      expect(authored.style[port as string]).toBe(expected);
    },
    30000
  );

  // The ratchet, and the actual fix: no padding port anywhere declares a non-zero default, so
  // the mechanism above has nothing left to swallow. `addPaddingInputs` has fourteen callers and
  // Button and Icon were the only two that passed defaults.
  it('no node declares a non-zero padding default any more', () => {
    for (const module of [ButtonModule, IconModule]) {
      for (const port of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
        expect(module.node.inputs[port].default).toBe(0);
      }
    }
  });
});

describe('V-i, what it actually costs — measured in the running editor, not inferred', () => {
  // ⚠️ This block exists because the first version of this finding was WRONG about Button, and
  // reading the source could not have shown it. Driven live (NodeGX 0.1.0, a real project, an
  // author-created Button whose only model parameter was `label`):
  //
  //   Button  parameters.paddingLeft = absent   getParameter('paddingLeft') = 20
  //           rendered <button class="ndl-controls-button">  computed padding: 5px 20px
  //   Icon    parameters.paddingLeft = absent   getParameter('paddingLeft') = 5
  //           rendered <div class="ndl-visual-icon">         computed padding: 0px
  //
  // So the mechanism holds for both — `NodeGraphNode.getParameter` falls back to `port.default`
  // for the PANEL (NodeGraphNode.ts:817) while `this.parameters` stays empty, and NodeScope
  // queues only what the model carries. But **Button looks correct anyway**, because a static
  // stylesheet rule happens to carry the same two numbers, and **Icon does not**, because no
  // such rule exists for it.
  //
  // The real defect is therefore not "Button has no padding". It is that Button's padding was
  // specified twice, in two files, in two mechanisms, and only one of them was load-bearing.
  //
  // ✅ **Fixed by deleting the duplicate, so the stylesheet is now the single source.** These two
  // rows are what keeps that true: Button's numbers must stay in the CSS, and Icon must stay
  // free of a rule it never had.

  it('Button: the stylesheet is now the only place its base padding is written', () => {
    // Read from source rather than from a DOM, so this row fails if the surviving copy is edited.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const css = fs.readFileSync(__dirname + '/../../src/assets/style.css', 'utf8');

    const rule = css.slice(css.indexOf('.ndl-controls-button {'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('padding: 5px 20px 5px 20px');

    // …and the second copy is gone: the ports are overrides now, unset by default.
    const inputs = ButtonModule.node.inputs;
    expect(inputs.paddingTop.default).toBe(0);
    expect(inputs.paddingRight.default).toBe(0);
    expect(inputs.paddingBottom.default).toBe(0);
    expect(inputs.paddingLeft.default).toBe(0);
  });

  it('Icon: no stylesheet padding, and no declaration pretending otherwise', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const css = fs.readFileSync(__dirname + '/../../src/assets/style.css', 'utf8');

    // There is no `.ndl-visual-icon` padding rule — confirmed live as `padding: 0px` on the
    // node's own element. Icon's declared 5px was the one that genuinely did not render, so the
    // declaration went rather than a rule arriving: 0 is what Icon has always looked like, and
    // adding 5px now would move every existing Icon on every canvas.
    const iconRules = css
      .split('}')
      .filter((block) => /\.ndl-visual-icon\b/.test(block) || /\.ndl-icon-glyph\b/.test(block));
    for (const block of iconRules) expect(block).not.toContain('padding');

    expect(IconModule.node.inputs.paddingLeft.default).toBe(0);
  });
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
    expect(pageStacks()['Main']).toContain(stack);

    NavigationHandler.instance.deregisterPageStack(undefined as unknown as string, stack);
    expect(pageStacks()['Main']).toBeUndefined();
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
