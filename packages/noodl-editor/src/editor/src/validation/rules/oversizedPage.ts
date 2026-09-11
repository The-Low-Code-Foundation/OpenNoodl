/**
 * Rule: a page that wanted to be several components.
 *
 * LAS-004 §2, and the backstop for the defect phase 55 exists to fix. Phase 54's
 * reference build reached a **66-node `Pages/Home`** with its sections inlined
 * and its repeated rows hand-duplicated — pretty, and architecturally wrong.
 * `repeated-sibling-subtree` catches the duplication; nothing catches a page
 * that is simply too big to be one component, which is the more common shape of
 * the same mistake and the one a model produces by working top-to-bottom.
 *
 * ## Info, deliberately, and it must never block
 *
 * The audit's own measurement is that cold models *already* decompose once the
 * doctrine reaches them: both replay Homes came in at 7 and 8 nodes. So this is
 * a backstop against a regression, not pressure toward factoring — and
 * best-practices 01 is explicit that over-factoring is its own mess. An info
 * that is occasionally read costs nothing; a warning that nags a legitimately
 * dense page teaches an agent to distrust the whole diagnostic set.
 *
 * ## The threshold is the corpus's, not the doctrine's
 *
 * The doctrine's prose says ~25. The census
 * (`dev-docs/tasks/phase-55-llm-authoring-support/measurements/scan-page-size.js`,
 * 2026-08-08) found **51 page components** across both corpora:
 *
 *     min 2 · median 6 · p75 19 · p90 36 · p95 66 · max 83
 *     83, 71, 66, 66, 60, │ 36, 32, 31, 31, 26, 25, 21, 19, 16, 13, …
 *
 * The only real gap in the distribution is **36 → 60**, so the knee is there and
 * the threshold sits inside it. At the doctrine's 25 the rule would fire on 10
 * pages (19.6%) including a Supabase login form (31 nodes) and an admin page
 * (31) — both legitimately dense, mostly with logic nodes, and neither wanting
 * to be three components. At 40 it fires on 5 (9.8%): the two copies of the
 * 66-node reference Home, and three `agent-chat` pages of 60–83. Every one of
 * those is a page a reader would agree is too big.
 *
 * The doctrine keeps its number as a target to aim at. This is the line at which
 * it is worth saying something out loud.
 *
 * ## What counts
 *
 * The page's **own** nodes, flat, with a component instance counting as one —
 * the whole point is that a page of six instances is the ideal, so the rule must
 * reward exactly what it is asking for. A page is a component containing a
 * `Page` node, the runtime's own definition: `exporter/router.ts::_getPageInfo`
 * builds the page index exclusively from them, which is why a `/Pages/…` name
 * alone is not enough (`PageWithoutPageNode`).
 *
 * @module noodl-editor/validation/rules/oversizedPage
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { PAGE_NODE_TYPE } from '../navigation';
import { Rule, RuleContext } from './types';

/** Above this, a page is worth one sentence. See the census in the header. */
export const OVERSIZED_PAGE_NODES = 40;

export const oversizedPage: Rule = {
  code: DiagnosticCode.OversizedPage,
  description: 'A page component whose own graph is large enough to have wanted sections of its own.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const { component } of ctx.components) {
      const count = component.nodes.length;
      if (count <= OVERSIZED_PAGE_NODES) continue;
      const page = component.nodes.find((n) => n.type === PAGE_NODE_TYPE);
      if (!page) continue;

      out.push({
        code: DiagnosticCode.OversizedPage,
        severity: 'info',
        message:
          `This page's own graph is ${count} nodes. Above about ${OVERSIZED_PAGE_NODES} a page has usually ` +
          'inlined sections that wanted to be components of their own — a page reads best as a handful of ' +
          'section instances. A component instance counts as one node here, so factoring a section out is a ' +
          'real reduction, not a rename.',
        location: {
          component: component.name,
          nodeId: page.id,
          nodeType: page.type,
          nodeLabel: page.label
        }
      });
    }

    return out;
  }
};
