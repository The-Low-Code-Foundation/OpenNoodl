/**
 * VIB-007 M1 — the one shape every door uses to say whether the work is done.
 *
 * Written once, here, for the same reason `ProjectBinding`'s refusal is written
 * once: three doors answering the same question in three vocabularies is three
 * things to drift, and the caller reading them is a model that has to recognise
 * the answer without being told which tool it came from.
 *
 * @module noodl-mcp/tools/completion
 */

import type { RenderFindingPayload } from '../render';
import type { RenderState, RenderVerdict } from '../renderVerdict';

/** How many blocking findings are worth spelling out before the list is noise. */
const MAX_LISTED = 12;

/**
 * VIB-007 M3 — the half of the answer that is not about breakage.
 *
 * 🔴 **It rides on the `done: true` arm as well**, and that is the point. A page
 * with no imagery, one ground and no display type is *finished* by every check
 * the product has — that is precisely what all nine VIB-001 baseline pages were,
 * and `doneBecause: 'Rendered, and the render is clean'` over one of them is the
 * same sentence AWP-004 was about: a summary out-claiming what was established.
 *
 * ⚠️ It is named `looksLike`, not `warnings`, because a model reading a field
 * called warnings next to `done: true` has been told which of the two to
 * believe. This asks it to look at the picture.
 */
function lookPayload(poverty: RenderFindingPayload[]): Record<string, unknown> {
  if (poverty.length === 0) return {};
  const byCode = new Map<string, RenderFindingPayload>();
  for (const f of poverty) if (!byCode.has(f.code)) byCode.set(f.code, f);
  return {
    looksLike: {
      verdict: 'This page measures as a default template — nothing is broken and nothing shows a decision.',
      tells: [...byCode.values()].map((f) => ({ code: f.code, message: f.message })),
      // Not a refusal, said plainly, so a model does not read a silent field as
      // permission and does not read a loud one as a block.
      blocking: false
    }
  };
}

/**
 * The completion block, as it appears at the top level of a write response.
 *
 * 🔴 `done` is always present, on both arms. A field that appears only when
 * something is wrong is a field whose absence has to be interpreted, and the
 * absence of a warning is exactly what a model reads as success — which is the
 * defect this mechanism exists to close, one level up.
 */
export function completionPayload(state: RenderState | (RenderVerdict & { looked?: boolean })): Record<string, unknown> {
  const look = lookPayload(state.poverty ?? []);
  if (state.done) return { done: true, doneBecause: state.reason, ...look };
  return {
    ...look,
    done: false,
    notDone: state.reason,
    ...(state.blocking.length > 0
      ? {
          mustFix: state.blocking.slice(0, MAX_LISTED).map((f) => ({
            code: f.code,
            viewport: f.viewport,
            message: f.message,
            ...(f.relatedDiagnostic ? { relatedDiagnostic: f.relatedDiagnostic } : {})
          })),
          ...(state.blocking.length > MAX_LISTED ? { mustFixMore: state.blocking.length - MAX_LISTED } : {})
        }
      : {}),
    ...(state.unmeasuredPages.length > 0 ? { pagesNobodyLookedAt: state.unmeasuredPages } : {})
  };
}
