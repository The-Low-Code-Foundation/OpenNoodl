/**
 * DSG-004 §2.3 — the gate behind doctrine `§3`, and the static half of `§11`'s
 * second DOM check.
 *
 * ## What it is about
 *
 * *"A page rendering at one font weight is not designed. Aim for three or more
 * distinct weights. Set `fontWeight` explicitly — it is a real port and nothing
 * infers it."* The reason that line matters at all is that before 0.1.4 there
 * was **no `fontWeight` port on any node** in the library, so every word of every
 * authored page rendered at 400 and no amount of instruction could have changed
 * it.
 *
 * ## Info, never blocking — and the corpus is why
 *
 * `measurements/explore-weights.ts`, both corpora, 107 projects, 2026-08-11.
 * 429 components carry text. Every `fontWeight` value ever authored across all
 * of them is a token — `var(--font-semibold)` (88 components),
 * `var(--font-bold)` (43), `var(--font-medium)` (21), `var(--font-normal)` (13) —
 * and the population of components where **no** text node sets one at all:
 *
 *     ≥4 text nodes: 72 of 131 · ≥6: 40 of 79 · ≥8: 22 of 46 · ≥12: 12 of 25
 *
 * At the shipped floor of {@link MIN_TEXT_NODES} restricted to page components,
 * it is **6 hits in the whole corpus** — the Supabase prefab's log-in and
 * sign-up pages, and four `agent-chat` developer pages. **No measured model
 * replay is monotone**: sonnet, haiku and deepseek all set weight tokens, so the
 * doctrine line is currently winning on its own.
 *
 * That is the `oversized-page` shape of finding, and it takes the same severity
 * for the same reason: a backstop against a regression rather than pressure
 * toward a change. An info that is occasionally read costs nothing; a warning
 * that nags a legitimately monotone page — a form, a developer tool — teaches an
 * agent to distrust the whole diagnostic set, which costs more than this rule is
 * worth.
 *
 * ## Why the predicate is "not one weight" but "no weight"
 *
 * Two weights out of three is a hierarchy in progress and none of the corpus's
 * monotone components are that: all 22 have *no* `fontWeight` anywhere. Firing
 * only on the total absence keeps the statement true without judging a page
 * that has started. And it keeps the check honest about what it cannot see: a
 * `var(--font-semibold)` that a project's tokens resolve to 400 is monotone in
 * the DOM and not here. That case belongs to `flat-type-scale` in
 * `@nodegx/render-measure`, which measures the computed weight — the division
 * DSG-004 §3 draws between a validator and a renderer.
 *
 * Pure: the caller supplies the nodes and, optionally, which input ports carry a
 * wire.
 *
 * @module noodl-editor/validation/typographyHierarchy
 */

import { DiagnosticCode, type Diagnostic } from './diagnostics';
import { PAGE_NODE_TYPE } from './navigation';
import type { ParameterizedNode } from './parameterValues';

/**
 * Node types whose `fontWeight` port decides how heavy rendered words are.
 *
 * `Text` plus the two controls that carry their own label typography. Kept to
 * the types that actually declare the port: a false member would count a node
 * that cannot set a weight against a page that set every weight it could.
 */
export const TEXT_WEIGHT_TYPES: ReadonlySet<string> = new Set([
  'Text',
  'net.noodl.controls.button',
  'net.noodl.controls.textinput'
]);

/**
 * How much text a page needs before "it is all one weight" is a statement about
 * the design rather than about a small component.
 *
 * Eight, from the census in the header: at 4 the population is 72 components and
 * most are small parts (a card, a row) where one weight is correct; by 8 it is a
 * page's worth of words. Restricted to page components as well, which is where
 * the doctrine's claim is aimed — a card is *supposed* to be one weight.
 */
export const MIN_TEXT_NODES = 8;

export interface CheckTypographyHierarchyOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /**
   * Input ports carrying a wire, as `` `${nodeId}::${port}` ``. **Omitted means
   * "no connection information"**, and a wired `fontWeight` then reads as unset —
   * the convention `urlPaths`, `backend`, `interfaces` and `template` already
   * follow. A page that drives its weights from a data source is a page this
   * check must stay quiet about.
   */
  connectedInputs?: ReadonlySet<string>;
}

function hasWeight(node: ParameterizedNode, connected: ReadonlySet<string> | undefined): boolean {
  const value = node.parameters?.['fontWeight'];
  if (value !== undefined && value !== null && value !== '') return true;
  return !!connected?.has(`${node.id}::fontWeight`);
}

/**
 * A page whose text is all one weight.
 *
 * Fires once per component, on the `Page` node — the repair is a pass over the
 * page's type ramp, not an edit to any one Text — and only for a component that
 * holds a `Page` node, the runtime's own definition of a page
 * (`exporter/router.ts::_getPageInfo`) and the one `oversizedPage` and
 * `checkPageShape` already use.
 */
export function checkTypographyHierarchy(
  nodes: readonly ParameterizedNode[],
  options: CheckTypographyHierarchyOptions
): Diagnostic[] {
  const { component, connectedInputs } = options;

  const page = nodes.find((n) => n.type === PAGE_NODE_TYPE);
  if (!page) return [];

  const textNodes = nodes.filter((n) => TEXT_WEIGHT_TYPES.has(n.type));
  if (textNodes.length < MIN_TEXT_NODES) return [];
  if (textNodes.some((n) => hasWeight(n, connectedInputs))) return [];

  return [
    {
      code: DiagnosticCode.MonotoneTypography,
      severity: 'info',
      message:
        `None of this page's ${textNodes.length} text nodes sets fontWeight, so every word on it renders at the ` +
        'same weight and nothing is emphasised over anything else — which is what an unstyled page measures ' +
        'like. Set it explicitly where the hierarchy lives: var(--font-bold) on the one display headline, ' +
        'var(--font-semibold) on section headings and card titles, and leave body text alone.',
      // No `port`: the finding is about the page, and `fontWeight` is not a port
      // the `Page` node has. A location naming a port the node does not declare
      // is the kind of small lie that costs a reader a minute.
      location: {
        component,
        nodeId: page.id,
        nodeType: page.type,
        ...(page.label ? { nodeLabel: page.label } : {})
      }
    }
  ];
}
