/**
 * DSG-004 §2.3 — doctrine `§3`: *"A page rendering at one font weight is not
 * designed."*
 *
 * Info, never blocking, and the corpus is the reason: at the shipped floor the
 * whole 107-project corpus yields 6 hits, all of them legacy prefab or developer
 * pages, and **no measured model replay is monotone**. This is the
 * `oversized-page` shape of rule — a backstop against a regression — so the
 * severity assertion below is part of the contract, not incidental.
 */

import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import {
  checkTypographyHierarchy,
  MIN_TEXT_NODES
} from '../../src/editor/src/validation/typographyHierarchy';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

function page(textCount: number, weights: (string | undefined)[] = []): ParameterizedNode[] {
  return [
    { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Home' } },
    ...Array.from({ length: textCount }, (_, i) => ({
      id: `t${i}`,
      type: 'Text',
      parameters: { text: `line ${i}`, ...(weights[i] ? { fontWeight: weights[i] } : {}) }
    }))
  ];
}

const run = (nodes: ParameterizedNode[], connected?: Set<string>) =>
  checkTypographyHierarchy(nodes, { component: '/Pages/Home', connectedInputs: connected });

describe('monotone-typography (DSG-004 §2.3)', () => {
  it('reports a page whose text nodes set no weight at all', () => {
    const found = run(page(MIN_TEXT_NODES));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.MonotoneTypography);
    // Info, and it must stay info: a deliberately monotone page exists.
    expect(found[0].severity).toBe('info');
    expect(found[0].location.nodeId).toBe('page');
    expect(found[0].message).toContain(`${MIN_TEXT_NODES} text nodes`);
    // The exit, in the doctrine's own vocabulary.
    expect(found[0].message).toContain('var(--font-bold)');
    expect(found[0].message).toContain('var(--font-semibold)');
  });

  it('says nothing once any weight is authored, because a hierarchy has started', () => {
    expect(run(page(MIN_TEXT_NODES, ['var(--font-bold)']))).toEqual([]);
  });

  it('says nothing about a component that is not a page', () => {
    // A card is *supposed* to be one weight; the doctrine's claim is about pages.
    const nodes = page(MIN_TEXT_NODES).filter((n) => n.type !== 'Page');
    expect(run(nodes)).toEqual([]);
  });

  it('says nothing below the floor, where one weight is a small component', () => {
    expect(run(page(MIN_TEXT_NODES - 1))).toEqual([]);
  });

  it('treats a wired fontWeight as set, so a data-driven page is not reported', () => {
    expect(run(page(MIN_TEXT_NODES), new Set(['t0::fontWeight']))).toEqual([]);
  });

  it('counts the controls that carry their own label typography', () => {
    const nodes: ParameterizedNode[] = [
      { id: 'page', type: 'Page', parameters: {} },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, type: 'Text', parameters: { text: 'x' } })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `i${i}`,
        type: 'net.noodl.controls.textinput',
        parameters: { label: 'x' }
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `b${i}`,
        type: 'net.noodl.controls.button',
        parameters: { label: 'x' }
      }))
    ];
    expect(run(nodes)).toHaveLength(1);
  });
});
