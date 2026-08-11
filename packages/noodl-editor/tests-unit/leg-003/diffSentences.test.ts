/**
 * LEG-003 §1 — the four change kinds, at the seam that renders them.
 *
 * The spec asks for rename, rewire, reparent and multi-parameter to be driven
 * in the running editor and their sentences recorded. This file is **not that**
 * and does not claim to be: it runs the same two functions the GraphDiffPanel
 * runs — `diffGraphs` and `formatChange` with the real catalog name provider —
 * over a fixture shaped like a real page, so the rendering logic is exercised
 * and the wording is pinned. The live drive stays outstanding and is written up
 * in NOTES-LEG-003-DRIVE.md.
 *
 * Three of these assertions exist because the spec named them as failures that
 * read as successes:
 *
 *  - the *old* label is the one on the node reference in a rename;
 *  - a node labelled exactly its type name renders as if unlabelled;
 *  - `catalogDisplayNames()` swallows a failed `require` and silently degrades
 *    to raw type names, so a test that only asserts "contains 'Button'" passes
 *    on a fixture provider. The provider under test here is the real one, and
 *    the last case in this file fails loudly if it degrades.
 */

import { catalogDisplayNames, diffGraphs, formatChange, formatComponentDiff, fromLegacyComponent } from '../../src/editor/src/versioning';
import type { GraphSnapshot } from '../../src/editor/src/versioning';

type Raw = Record<string, unknown>;

/**
 * A checkout page as one is actually authored: real catalog type names, a
 * labelled visual tree, a signal wire from a button to a navigate node. Every
 * case below is a small edit of this, which is what a review actually sees.
 */
function checkout(overrides: {
  submitLabel?: string;
  totalParent?: 'page' | 'summary';
  wireFrom?: { id: string; port: string };
  columnParameters?: Raw;
} = {}): GraphSnapshot {
  const submitLabel = overrides.submitLabel ?? 'Submit Order';
  const totalParent = overrides.totalParent ?? 'page';
  const wireFrom = overrides.wireFrom ?? { id: 'btn-submit', port: 'onClick' };

  const total: Raw = {
    id: 'txt-total',
    type: 'Text',
    label: 'Order total',
    x: 320,
    y: 420,
    parameters: { text: 'Total: £0.00', fontSize: 18 }
  };

  const summary: Raw = {
    id: 'col-summary',
    type: 'net.noodl.visual.columns',
    label: 'Order summary',
    x: 280,
    y: 160,
    parameters: {
      layoutString: '1,1',
      gutter: 12,
      ...(overrides.columnParameters ?? {})
    },
    ...(totalParent === 'summary' ? { children: [total] } : {})
  };

  const page: Raw = {
    id: 'grp-page',
    type: 'Group',
    label: 'Checkout page',
    x: 240,
    y: 80,
    parameters: { flexDirection: 'column', paddingTop: 24 },
    children: [
      summary,
      {
        id: 'btn-submit',
        type: 'net.noodl.controls.button',
        label: submitLabel,
        x: 320,
        y: 520,
        parameters: { label: 'Submit order', enabled: true }
      },
      ...(totalParent === 'page' ? [total] : [])
    ]
  };

  return fromLegacyComponent({
    name: '/Pages/Checkout',
    graph: {
      roots: [
        page,
        { id: 'nav-confirm', type: 'RouterNavigate', label: 'Checkout', x: 800, y: 520, parameters: { target: '/Pages/Confirmation' } },
        { id: 'input-coupon', type: 'net.noodl.controls.textinput', label: 'Coupon code', x: 320, y: 620, parameters: {} }
      ],
      connections: [{ fromId: wireFrom.id, fromProperty: wireFrom.port, toId: 'nav-confirm', toProperty: 'navigate' }]
    }
  });
}

/** The provider the GraphDiffPanel uses — `graphChangePresentation.ts:114`. */
const displayName = catalogDisplayNames();

function sentences(base: GraphSnapshot, target: GraphSnapshot): string[] {
  return formatComponentDiff(diffGraphs(base, target), { displayName, includeCosmetic: true });
}

describe('LEG-003 §1 — what the diff says about the four change kinds', () => {
  it('renames a node by its OLD label, and names the type by its catalog name', () => {
    const lines = sentences(checkout(), checkout({ submitLabel: 'Place order' }));

    expect(lines).toEqual(["Renamed Button 'Submit Order' to 'Place order'"]);
  });

  it('rewires an input by naming the input, the new source and the old one', () => {
    const lines = sentences(checkout(), checkout({ wireFrom: { id: 'input-coupon', port: 'onEnter' } }));

    expect(lines).toEqual([
      "Rewired Navigate 'Checkout'.navigate to come from Text Input 'Coupon code'.onEnter " +
        "(was Button 'Submit Order'.onClick)"
    ]);
  });

  it('reparents by naming both containers, not their ids', () => {
    const lines = sentences(checkout(), checkout({ totalParent: 'summary' }));

    expect(lines).toEqual([
      "Moved Text 'Order total' from Group 'Checkout page' into Columns 'Order summary'"
    ]);
  });

  it('folds several parameter changes into one sentence with a counted tail', () => {
    const lines = sentences(
      checkout(),
      checkout({
        columnParameters: {
          layoutString: '1,2',
          gutter: 24,
          alignY: 'center',
          paddingLeft: 16
        }
      })
    );

    // Three deltas are spelled out and the rest are counted rather than
    // dropped. The three are the first three *alphabetically*, not the three
    // the author changed first: `paddingLeft` is the one behind "+1 more" here
    // whatever order the edits were made in.
    expect(lines).toEqual([
      "Changed Columns 'Order summary' (alignY: (unset) → 'center', gutter: 12 → 24, " +
        "layoutString: '1,1' → '1,2', +1 more)"
    ]);
  });
});

describe('LEG-003 §1 — the three failures that read as successes', () => {
  it('renders a node labelled exactly its type name as if it were unlabelled', () => {
    // Register L30. Harmless, and a reviewer should not discover it mid-review.
    const base = fromLegacyComponent({
      name: '/Pages/Checkout',
      graph: {
        roots: [{ id: 'b', type: 'net.noodl.controls.button', label: 'Button', parameters: { label: 'Go' } }],
        connections: []
      }
    });
    const target = fromLegacyComponent({
      name: '/Pages/Checkout',
      graph: {
        roots: [{ id: 'b', type: 'net.noodl.controls.button', label: 'Button', parameters: { label: 'Stop' } }],
        connections: []
      }
    });

    expect(sentences(base, target)).toEqual(["Changed Button (label: 'Go' → 'Stop')"]);
  });

  it('resolves the real catalog rather than degrading to raw type names', () => {
    // Register L29: `catalogDisplayNames()` swallows a failed require and
    // returns undefined for everything, which looks like a working panel full
    // of `net.noodl.*`. Asserted directly, so the degradation cannot hide
    // behind a fixture provider.
    expect(displayName('net.noodl.controls.button')).toBe('Button');
    expect(displayName('net.noodl.controls.textinput')).toBe('Text Input');
    expect(displayName('net.noodl.visual.columns')).toBe('Columns');
    expect(displayName('RouterNavigate')).toBe('Navigate');
  });

  it('leaves no raw dotted type name in any sentence of a realistic change set', () => {
    const lines = [
      ...sentences(checkout(), checkout({ submitLabel: 'Place order' })),
      ...sentences(checkout(), checkout({ wireFrom: { id: 'input-coupon', port: 'onEnter' } })),
      ...sentences(checkout(), checkout({ totalParent: 'summary' })),
      ...sentences(checkout(), checkout({ columnParameters: { gutter: 24 } }))
    ];

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).not.toMatch(/net\.noodl\./);
  });

  it('still says something usable when the catalog cannot be reached at all', () => {
    // The degraded path, made visible rather than assumed: no provider means
    // the raw type carries the sentence, which is the shape a packaged build
    // with a missing catalog would show on every row.
    const lines = formatComponentDiff(diffGraphs(checkout(), checkout({ submitLabel: 'Place order' })), {});

    expect(lines).toEqual(["Renamed net.noodl.controls.button 'Submit Order' to 'Place order'"]);
  });
});

describe('LEG-003 §1 — one change at a time is not what a review sees', () => {
  it('renders a mixed change set as one sentence per change', () => {
    const target = checkout({
      submitLabel: 'Place order',
      totalParent: 'summary',
      wireFrom: { id: 'input-coupon', port: 'onEnter' },
      columnParameters: { gutter: 24 }
    });
    const lines = sentences(checkout(), target);

    // Recorded verbatim in NOTES-LEG-003.md; pinned here so a reword is a
    // deliberate act rather than a silent one.
    expect(lines.sort()).toEqual(
      [
        "Changed Columns 'Order summary' (gutter: 12 → 24)",
        "Moved Text 'Order total' from Group 'Checkout page' into Columns 'Order summary'",
        "Renamed Button 'Submit Order' to 'Place order'",
        "Rewired Navigate 'Checkout'.navigate to come from Text Input 'Coupon code'.onEnter " +
          "(was Button 'Submit Order'.onClick)"
      ].sort()
    );
  });

  it('formats a single change through the same entry point the panel calls', () => {
    const diff = diffGraphs(checkout(), checkout({ submitLabel: 'Place order' }));
    expect(formatChange(diff.changes[0], { displayName })).toBe("Renamed Button 'Submit Order' to 'Place order'");
  });
});
