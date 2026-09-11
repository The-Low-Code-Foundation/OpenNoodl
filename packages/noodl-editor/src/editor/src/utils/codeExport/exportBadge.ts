/**
 * EXP-013 AC1 — "Not exportable yet", decided where the node is placed.
 *
 * The decision is `@nodegx/export`'s (`exportBadgeOf`, reading `coverage-ledger.json`); this
 * module is the editor's one seam onto it, and exists for two reasons:
 *
 * 1. **A type name the ledger does not classify must read as nothing.** A project component's
 *    instance type is its path (`/Pages/Home`), a kit node's is the kit's — neither is in the
 *    ledger, and neither is refused by the export on that ground (EXP-010 decides a kit node,
 *    the component's own plan decides an instance). The ledger reader already returns
 *    `undefined` for both; the guard here is the `try`, because the picker must open and the
 *    property panel must render whatever the ledger file looks like.
 * 2. **Import-free apart from the ledger reader**, so `tests-unit/` can grade the decision over the
 *    real ledger without Electron — the same shape as `capability-gating/pickerReason.ts`, which
 *    is the precedent for a per-row verdict the picker card carries (BCN-010).
 *
 * ⚠️ Deliberately a badge and not a filter. Richard's ruling (EXP-011 §50) is *warn*, not *hide*:
 * the node is placeable and it works in the running app; what it does not do is export.
 */

import { exportBadgeOf, type ExportBadge } from '@nodegx/export/ledger';

export type { ExportBadge };

/** The badge for a node type, or `undefined` when the type exports or is not the ledger's to say. */
export function exportBadgeFor(typeName: string | undefined): ExportBadge | undefined {
  if (!typeName) return undefined;
  try {
    return exportBadgeOf(typeName);
  } catch (e) {
    return undefined;
  }
}

/** The hover sentence: the label, then the ledger's own reason. */
export function exportBadgeTitle(badge: ExportBadge): string {
  return `${badge.label} — ${badge.reason}`;
}
