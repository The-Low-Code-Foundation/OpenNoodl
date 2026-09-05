/**
 * P82 — the testing pass's §2.3 row, owner `NONE`, closed here.
 *
 * > *"**Button `outline`/`ghost` icons** were invisible before §1's fix and are now correct **by
 * > inheritance** — but no gate pins the variants themselves | a render-level gate over all five
 * > variants | `NONE`"*
 * > — [TESTING-PASS-2026-09-04.md](../../../../dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/TESTING-PASS-2026-09-04.md) §2.3
 *
 * ## What was already gated, and what was not
 *
 * Two gates stand either side of this one and neither can see the thing that broke:
 *
 * - **`tests/icon-colour-defaults.test.ts`** grades the *declaration* — Button ships no
 *   `iconColor` default, and `_renderIcon` emits no `color` when the author set none. It renders
 *   a Button carrying **no variant at all**, so it says nothing about the six grounds a real
 *   Button actually lands on.
 * - **`noodl-editor/tests-unit/def-001/design-token-contrast.test.ts`** grades the *tokens* —
 *   every variant's `color` against every ground it can sit on, in every shipped palette. It
 *   reads `ButtonConfig` and never renders anything.
 *
 * DEF-001 therefore proves the variant's foreground is visible on its ground, and
 * `icon-colour-defaults` proves the glyph takes the button's colour in one implicit case. **The
 * link between them — that a Button stamped with variant V really does hand its glyph V's
 * colour — is what nothing held**, and it is the whole of why the fix is "correct by
 * inheritance". Break the inheritance and both existing gates stay green while `outline` and
 * `ghost` go back to an invisible icon, which is the defect Richard reported on 2026-09-04.
 *
 * ## This is the product's own chain, not a restatement of it
 *
 * Every link is exercised rather than modelled:
 *
 * ```
 *   ButtonConfig.variants[v]                       the config the editor ships
 *     → ElementConfigRegistry.applyVariant(...)    what a variant click actually stamps
 *       → node.parameters                          camelCase CSS keys on the node model
 *         → the `color` inputCss port              `targetStyleProperty: 'color'` → setStyle
 *           → noodlNode.style → props.style        react-component-node's props assembly
 *             → <button style="color:…">           Button.tsx
 *               → <span class="fa …">              IconGlyph, with NO colour of its own
 * ```
 *
 * The last step is the fix: `iconStyle.color = props.iconColor` is `undefined` for an author who
 * set no Icon Color, React omits an `undefined` style property, and the glyph inherits.
 *
 * ## 🔴 The row said five variants. There are six.
 *
 * `primary`, `secondary`, `outline`, `ghost`, `destructive` and `link`. The population below is
 * read from the registry rather than listed, so a seventh cannot ship ungraded — §1 reddens until
 * somebody states what ground its icon sits on.
 *
 * ## ⚠️ What this does NOT establish
 *
 * - **Hover and disabled are not rendered.** `outline`/`ghost` swap to `--accent-foreground` on
 *   hover, and the runtime applies visual states through CSS classes rather than inline style, so
 *   a static render cannot reach them. DEF-001 *does* grade those pairs' contrast (`…/outline:hover`),
 *   so what is unheld is only the inheritance at hover, not the colours.
 * - **No contrast is computed here.** That is DEF-001's job and duplicating it would give two
 *   readings that can disagree. This grades identity: the glyph's colour *is* the button's.
 * - `context.styles.resolveColor` is stubbed as identity. The real one resolves a project colour
 *   style *name*; a `var(--token)` reference passes through it unchanged, which is what every
 *   value in `ButtonConfig` is.
 */

/* eslint-env jest */

import { createCorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

/**
 * ⚠️ The node modules read a bare `Noodl.deployed` at import time to decide whether to build
 * editor tooltips, so the global has to exist before the `require`s below. An ES `import` of the
 * node module would hoist above this assignment and the suite would fail *to run*.
 */
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const ButtonModule = require('../../src/nodes/controls/button').default;
const {
  ElementConfigRegistry
} = require('../../../noodl-editor/src/editor/src/models/ElementConfigs/ElementConfigRegistry');
const { ButtonConfig } = require('../../../noodl-editor/src/editor/src/models/ElementConfigs/configs/ButtonConfig');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
/* eslint-enable @typescript-eslint/no-var-requires */

const BUTTON_TYPE = 'net.noodl.controls.button';

/** The glyph `IconGlyph` emits for a class-based icon source — what the assertions look for. */
const GLYPH_CLASS = 'fa-check';

/** The population, read from the registry the VariantSelector reads. Never a literal list. */
const VARIANTS: string[] = ElementConfigRegistry.getVariantNames(BUTTON_TYPE);

/**
 * What a variant click stamps onto a node, through the product's own code path.
 * `applyVariant` takes anything with a plain `parameters` bag — that is its published contract
 * (`NodeModelLike`), and it is what `NodeGraphNode` is.
 */
function stampedParameters(variant: string): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  ElementConfigRegistry.applyVariant({ parameters }, BUTTON_TYPE, variant);
  return parameters;
}

/**
 * A real Button node in a real graph, carrying a real variant stamp, rendered to markup by its
 * own `render()`. `useLabel` is off so the glyph is the only thing in the button — a label would
 * put the same inherited colour on two elements and blur which one the assertion read.
 */
async function renderButtonWithVariant(
  variant: string,
  extraParameters: Record<string, unknown> = {}
): Promise<string> {
  const graph = await createCorpusGraph({
    modules: [ButtonModule as never],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'button',
              type: BUTTON_TYPE,
              parameters: {
                ...stampedParameters(variant),
                useLabel: false,
                useIcon: true,
                iconSourceType: 'icon',
                iconIconSource: { codeAsClass: true, class: 'fa', code: GLYPH_CLASS },
                iconSize: '16px',
                ...extraParameters
              }
            }
          ]
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

  const node = graph.node('button') as unknown as { render(): unknown };
  return renderToStaticMarkup(node.render() as never);
}

/** The `style="…"` of the element carrying `GLYPH_CLASS`, or `null` when it carries none. */
function glyphStyle(html: string): string | null {
  const glyph = html.match(new RegExp(`<[a-z]+[^>]*\\b${GLYPH_CLASS}\\b[^>]*>`));
  if (!glyph) return null;
  const style = glyph[0].match(/style="([^"]*)"/);
  return style ? style[1] : '';
}

/** The `style="…"` of the `<button>` itself — the colour the glyph is supposed to inherit. */
function buttonStyle(html: string): string {
  const button = html.match(/<button[^>]*>/);
  return button?.[0].match(/style="([^"]*)"/)?.[1] ?? '';
}

describe('§1 — the population is the registry, not a list in this file', () => {
  it('finds every variant the config declares, and at least one', () => {
    // The known-firing half. Without it, a registry that returned nothing would make every
    // `it.each` below run zero times and the suite would pass having measured nothing —
    // `all([])` is the answer you wanted.
    expect(VARIANTS.length).toBeGreaterThan(0);
    expect(VARIANTS).toEqual(Object.keys(ButtonConfig.variants));
  });

  it('🔴 grades SIX variants — the register row that asked for this said five', () => {
    expect(VARIANTS).toEqual(['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link']);
  });
});

describe('§2 — every variant declares the colour its icon will inherit', () => {
  it.each(VARIANTS)('%s stamps a `color`', (variant) => {
    /**
     * A variant with no `color` is the quiet version of this defect: the glyph would inherit
     * whatever the previous variant left behind, or the page's, on a ground chosen for a colour
     * nobody stated. The stamp is read back out of `applyVariant` rather than off the config, so
     * this also holds `resolveVariant`'s `states`-stripping.
     */
    expect(stampedParameters(variant).color).toEqual(expect.any(String));
  });

  it.each(VARIANTS)('%s stamps the ground that colour lands on', (variant) => {
    expect(stampedParameters(variant).backgroundColor).toEqual(expect.any(String));
  });
});

describe('§3 — rendered: the glyph takes the button’s colour on every variant', () => {
  it.each(VARIANTS)('%s — the icon renders at all', async (variant) => {
    /**
     * 🔴 The vacuity control, and it has to come first. "The glyph carries no colour of its own"
     * is true of a glyph that was never drawn, so every row below would pass on a Button that
     * rendered nothing — which is precisely the state `outline` and `ghost` were reported in.
     */
    expect(await renderButtonWithVariant(variant)).toContain(GLYPH_CLASS);
  });

  it.each(VARIANTS)('%s — the button carries the variant’s own colour', async (variant) => {
    const expected = stampedParameters(variant).color as string;

    // React writes camelCase style keys as CSS property names, so `color` is `color:`, and the
    // leading `;` or `"` boundary keeps it from matching `background-color:`.
    expect(buttonStyle(await renderButtonWithVariant(variant))).toMatch(
      new RegExp(`(^|;)color:${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(;|$)`)
    );
  });

  it.each(VARIANTS)('🔴 %s — the glyph declares NO colour, so it inherits that one', async (variant) => {
    /**
     * The fix itself, on every ground. `button.ts` ships no `iconColor` default and
     * `_renderIcon` assigns `props.iconColor` straight through, so React omits the property and
     * the glyph inherits. Put a constant back — the `#FFFFFF` that shipped before 2026-09-04, or
     * the `#000000` every other icon-bearing node correctly uses — and this reddens on the
     * variants that constant is wrong for, which is what neither existing gate can see.
     */
    const style = glyphStyle(await renderButtonWithVariant(variant));

    expect(style).not.toBeNull();
    expect(style).not.toMatch(/(^|;)color:/);
  });
});

describe('§4 — and an author who sets Icon Color still wins', () => {
  it.each(VARIANTS)('%s honours an explicit Icon Color', async (variant) => {
    /**
     * The discrimination control for §3's last row. Without it, "no colour on the glyph" would
     * read exactly the same if `_renderIcon` had stopped emitting colour altogether — an
     * author's own choice silently dropped, and a gate that called that a pass.
     */
    const style = glyphStyle(await renderButtonWithVariant(variant, { iconColor: '#123456' }));

    expect(style).toMatch(/(^|;)color:#123456(;|$)/);
  });
});

describe('§5 — coverage', () => {
  it('reports what it graded', () => {
    const grounds = VARIANTS.map((v) => `${v} on ${stampedParameters(v).backgroundColor}`);

    console.log(
      `P82 §2.3 — rendered ${VARIANTS.length} Button variants end to end ` +
        `(config → applyVariant → node parameters → props.style → markup): ${grounds.join(', ')}.`
    );

    expect(grounds).toHaveLength(VARIANTS.length);
  });
});
