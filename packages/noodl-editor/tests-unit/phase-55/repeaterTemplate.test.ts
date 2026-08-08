/**
 * LAS-012 — the repeater template contract.
 *
 * Written before the implementation and watched fail against the shipped code,
 * which reported **0 diagnostics** for every case below.
 *
 * The defect, measured: haiku's session-6 cold replay of the storefront brief
 * came out architecturally correct on every axis phase 55 measures — 10
 * components, 7 declaring `Component Inputs`, 32 connections, 3 `Columns`, zero
 * instance parameters with nowhere to land — and its page draws a header, a
 * hero, an info strip, and then nothing. `validate:project` said `0 error(s)`,
 * `render_report` said `0 errors`, and a node census said `For Each: 3`.
 * `npm run render:report` on that project counts **0 images** across desktop and
 * phone, on a page whose three repeaters all carry product photography.
 *
 * ⚠️ **A premise correction, found by reading the project off disk.** The task
 * file (and session 6's handover) records haiku as omitting `template` and qwen
 * as nesting the item component as a child — the same joint failed from
 * opposite sides. Off disk, haiku did **both**: all three of its repeaters nest
 * their item content as a child as well (`/Components/ProductCard`,
 * `/Components/CategoryCard`, and a bare `Group`). The two models made the
 * *same* mistake; qwen's was caught only because its child id dangled, which is
 * a shape error on a path that carries no recipe.
 *
 * So the fixture produces three **`repeater-with-visual-children`** errors
 * rather than the three `repeater-without-template` the task predicted. That is
 * deliberate and not a weakening: a repeater with no template *and* a nested
 * child has one cause, and one message naming the child it should promote is a
 * repair instruction where two diagnostics is a repair round spent choosing
 * between them. `repeater-without-template` covers the case the task described,
 * and is exercised below on its own.
 */
import {
  authoredNodes,
  checkRepeaterTemplate,
  connectedInputs,
  DiagnosticCode,
  isBlockingForAuthoredOutput
} from '../../src/editor/src/validation';
import type { AuthoredNode } from '../../src/editor/src/validation';

import HAIKU_REPEATERS from './fixtures/haiku-s6-repeaters.json';

// ── fixtures ──────────────────────────────────────────────────────────────────

/**
 * The three repeater subtrees of `NodeGX test projects/phase55-s6-haiku`,
 * vendored verbatim from its `nodes.json` files (canvas coordinates dropped and
 * each `items` array cut to one entry — the defect is the template, not the
 * data). Extracted 2026-08-08 at commit 72b02323.
 */
const HAIKU: Record<string, AuthoredNode[]> = HAIKU_REPEATERS as unknown as Record<string, AuthoredNode[]>;

const PROJECT_COMPONENTS = [
  '/Pages/Home',
  '/Components/ProductCard',
  '/Components/CategoryCard',
  '/Components/FeaturedProducts',
  '/Components/BrowseCategories',
  '/Components/Footer'
];

/** The shape sonnet — the only model that got this right — actually wrote. */
const SONNET_CORRECT: AuthoredNode[] = [
  { id: 'data', type: 'Static Data', parameters: { items: [{ name: 'a' }] } },
  {
    id: 'list',
    type: 'For Each',
    label: 'Product list',
    parameters: { template: '/Components/ProductCard' }
  }
];

function codes(diagnostics: { code: DiagnosticCode }[]): DiagnosticCode[] {
  return diagnostics.map((d) => d.code);
}

// ── the fixture, pinned ───────────────────────────────────────────────────────

describe('LAS-012 — haiku session 6, the project that passed three instruments', () => {
  it('rejects all three repeaters, one error each', () => {
    const all = Object.entries(HAIKU).flatMap(([component, nodes]) =>
      checkRepeaterTemplate(nodes, { component, components: PROJECT_COMPONENTS })
    );

    expect(all.length).toBe(3);
    expect(codes(all)).toEqual([
      DiagnosticCode.RepeaterWithVisualChildren,
      DiagnosticCode.RepeaterWithVisualChildren,
      DiagnosticCode.RepeaterWithVisualChildren
    ]);
    // Every one of them blocks: they are errors, not advice that gets ignored.
    for (const d of all) {
      expect(d.severity).toBe('error');
      expect(isBlockingForAuthoredOutput(d)).toBe(true);
    }
    expect(all.map((d) => d.location.nodeId).sort()).toEqual(['linkRepeater', 'repeater', 'repeater-8']);
  });

  it('names the component to promote when the nested child is one', () => {
    const featured = checkRepeaterTemplate(HAIKU['/Components/FeaturedProducts'], {
      component: '/Components/FeaturedProducts',
      components: PROJECT_COMPONENTS
    });
    expect(featured).toHaveLength(1);
    expect(featured[0].suggestion).toBe('/Components/ProductCard');
    expect(featured[0].message).toContain('is not a container');
    expect(featured[0].message).toContain('"/Components/ProductCard"');
    expect(featured[0].location.port).toBe('template');
  });

  it('tells the Group case to extract a component instead of naming one', () => {
    const footer = checkRepeaterTemplate(HAIKU['/Components/Footer'], {
      component: '/Components/Footer',
      components: PROJECT_COMPONENTS
    });
    expect(footer).toHaveLength(1);
    // No component to promote — the child is a bare Group, so there is nothing
    // to suggest and the instruction has to be "make one".
    expect(footer[0].suggestion).toBeUndefined();
    expect(footer[0].message).toContain('into its own component');
    expect(footer[0].message).toContain('"Group"');
  });
});

// ── the three codes ───────────────────────────────────────────────────────────

describe('LAS-012 — repeater-without-template', () => {
  const bare: AuthoredNode[] = [
    { id: 'list', type: 'For Each', label: 'Products', parameters: { items: [{ name: 'a' }] } }
  ];

  it('is an error when a For Each names no template and holds nothing', () => {
    const found = checkRepeaterTemplate(bare, { component: '/Pages/Home', components: PROJECT_COMPONENTS });
    expect(codes(found)).toEqual([DiagnosticCode.RepeaterWithoutTemplate]);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('items alone are not enough');
  });

  it('fires on an empty-string template, which is not a template', () => {
    const found = checkRepeaterTemplate([{ id: 'list', type: 'For Each', parameters: { template: '   ' } }], {
      component: '/Pages/Home'
    });
    expect(codes(found)).toEqual([DiagnosticCode.RepeaterWithoutTemplate]);
  });

  it('stays silent when the template is fed by a wire', () => {
    const wired = connectedInputs([{ toId: 'list', toProperty: 'template' }]);
    expect(
      checkRepeaterTemplate(bare, { component: '/Pages/Home', connectedInputs: wired })
    ).toEqual([]);
  });

  it('stays silent on the shape sonnet wrote', () => {
    expect(
      checkRepeaterTemplate(SONNET_CORRECT, { component: '/Pages/Home', components: PROJECT_COMPONENTS })
    ).toEqual([]);
  });

  it('checks the dynamic branch for an empty script, and nothing else', () => {
    const dynamicEmpty: AuthoredNode[] = [
      { id: 'list', type: 'For Each', parameters: { templateType: 'dynamic' } }
    ];
    const dynamicOk: AuthoredNode[] = [
      { id: 'list', type: 'For Each', parameters: { templateType: 'dynamic', templateScript: 'component = "/Row"' } }
    ];
    expect(codes(checkRepeaterTemplate(dynamicEmpty, { component: '/Pages/Home' }))).toEqual([
      DiagnosticCode.RepeaterWithoutTemplate
    ]);
    // A dynamic repeater picks a component per item; no static reading can
    // resolve that, so a missing `template` is not a finding here.
    expect(checkRepeaterTemplate(dynamicOk, { component: '/Pages/Home' })).toEqual([]);
  });

  it('treats templateType "explicit" exactly as unset', () => {
    const explicit: AuthoredNode[] = [
      { id: 'list', type: 'For Each', parameters: { templateType: 'explicit', items: [] } }
    ];
    expect(codes(checkRepeaterTemplate(explicit, { component: '/Pages/Home' }))).toEqual([
      DiagnosticCode.RepeaterWithoutTemplate
    ]);
  });
});

describe('LAS-012 — repeater-template-unresolved', () => {
  it('reports a template naming no component, with the real names as alternatives', () => {
    const stale: AuthoredNode[] = [{ id: 'list', type: 'For Each', parameters: { template: '/Components/Card' } }];
    const found = checkRepeaterTemplate(stale, { component: '/Pages/Home', components: PROJECT_COMPONENTS });
    expect(codes(found)).toEqual([DiagnosticCode.RepeaterTemplateUnresolved]);
    expect(found[0].severity).toBe('warning');
    expect(isBlockingForAuthoredOutput(found[0])).toBe(true);
    expect(found[0].alternatives).toContain('/Components/ProductCard');
  });

  it('accepts either name form, as the component index does', () => {
    const pathForm: AuthoredNode[] = [
      { id: 'list', type: 'For Each', parameters: { template: 'Components/ProductCard' } }
    ];
    expect(checkRepeaterTemplate(pathForm, { component: '/Pages/Home', components: PROJECT_COMPONENTS })).toEqual([]);
  });

  it('leaves relative templates alone — the runtime resolves them per component', () => {
    const relative: AuthoredNode[] = [{ id: 'list', type: 'For Each', parameters: { template: './Row' } }];
    expect(checkRepeaterTemplate(relative, { component: '/Pages/Home', components: PROJECT_COMPONENTS })).toEqual([]);
  });

  it('does not guess when the caller cannot enumerate components', () => {
    const stale: AuthoredNode[] = [{ id: 'list', type: 'For Each', parameters: { template: '/Anything' } }];
    expect(checkRepeaterTemplate(stale, { component: '/Pages/Home' })).toEqual([]);
  });
});

describe('LAS-012 — repeater-with-visual-children', () => {
  it('is only a warning when the template is set, because the list does render', () => {
    const both: AuthoredNode[] = [
      { id: 'list', type: 'For Each', parameters: { template: '/Components/ProductCard' }, children: ['stray'] },
      { id: 'stray', type: 'Text', parameters: { text: 'left over' } }
    ];
    const found = checkRepeaterTemplate(both, { component: '/Pages/Home', components: PROJECT_COMPONENTS });
    expect(codes(found)).toEqual([DiagnosticCode.RepeaterWithVisualChildren]);
    expect(found[0].severity).toBe('warning');
    expect(isBlockingForAuthoredOutput(found[0])).toBe(true);
    expect(found[0].message).toContain('"Text"');
  });

  it('does not double-report: no template plus children is one diagnostic', () => {
    const qwenShape: AuthoredNode[] = [
      { id: 'list', type: 'For Each', parameters: { items: [] }, children: ['card'] },
      { id: 'card', type: '/Components/ProductCard', parameters: { name: '' } }
    ];
    const found = checkRepeaterTemplate(qwenShape, { component: '/Pages/Home', components: PROJECT_COMPONENTS });
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.RepeaterWithVisualChildren);
  });
});

// ── the seam ──────────────────────────────────────────────────────────────────

describe('LAS-012 — the adapter carries children through', () => {
  it('authoredNodes preserves children, which no precondition check needed before', () => {
    const stored = [{ id: 'list', type: 'For Each', parameters: {}, children: ['card'] }];
    expect(authoredNodes(stored)[0].children).toEqual(['card']);
  });

  it('connectedInputs keys on node and port together', () => {
    const set = connectedInputs([
      { toId: 'a', toProperty: 'template' },
      { toId: 'b', toProperty: 'items' }
    ]);
    expect(set.has('a::template')).toBe(true);
    expect(set.has('b::template')).toBe(false);
  });
});
