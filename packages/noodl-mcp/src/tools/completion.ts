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

import type { RenderState, RenderVerdict } from '../renderVerdict';

/** How many blocking findings are worth spelling out before the list is noise. */
const MAX_LISTED = 12;

/**
 * The completion block, as it appears at the top level of a write response.
 *
 * 🔴 `done` is always present, on both arms. A field that appears only when
 * something is wrong is a field whose absence has to be interpreted, and the
 * absence of a warning is exactly what a model reads as success — which is the
 * defect this mechanism exists to close, one level up.
 */
export function completionPayload(state: RenderState | (RenderVerdict & { looked?: boolean })): Record<string, unknown> {
  if (state.done) return { done: true, doneBecause: state.reason };
  return {
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
