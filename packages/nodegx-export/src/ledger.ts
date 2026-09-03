/**
 * The coverage ledger, read at runtime — EXP-013's one import.
 *
 * `coverage-ledger.json` (EXP-008) classifies every catalog node type for export, and
 * `export-ledger:check` enforces that a non-translated entry starts with one of exactly two
 * phrases: *"scheduled — "* (a commitment with a tier) or *"deliberately out of scope — "* (a
 * decision somebody made). Until EXP-013 nothing in the product read the file: the first a person
 * heard that a node would not export was the pre-flight modal, by component count. The editor
 * reaches this package already (EXP-012's alias), so the badge on a picker card is this function.
 *
 * 🔴 **The ledger is the only list.** The badge text and the reason are derived from the entry's
 * `status` and the exemption sentence's opening phrase — never from a second table of type names
 * kept in the editor, which is the copy that would drift the day a tier shipped a node.
 *
 * @module ledger
 */

import ledgerJson from '../coverage-ledger.json';

export type ExportStatus = 'translated' | 'deferred' | 'backend-only' | 'stubbed';

export interface LedgerEntry {
  typeName: string;
  status: ExportStatus;
  exemption?: string;
}

export interface ExportBadge {
  /** `scheduled` — a tier will translate it; `out-of-scope` — a decision, arguable but made. */
  kind: 'scheduled' | 'out-of-scope';
  /** *"Not exportable yet"* for `scheduled`, *"Not exportable"* for `out-of-scope`. */
  label: string;
  /** The ledger's own reason, with the leading phrase removed — for a hover or an expand. */
  reason: string;
}

const entries = new Map<string, LedgerEntry>((ledgerJson as { entries: LedgerEntry[] }).entries.map((e) => [e.typeName, e]));

/** The ledger's row for a type, or `undefined` for a type the ledger does not classify (a kit node, a component instance). */
export function ledgerEntryOf(typeName: string): LedgerEntry | undefined {
  return entries.get(typeName);
}

const SCHEDULED = /^scheduled\s+—\s+/;
const OUT_OF_SCOPE = /^deliberately out of scope\s+—\s+/;

/**
 * The badge a placed node of this type carries, or `undefined` when it exports.
 *
 * - `translated` → nothing.
 * - `stubbed` → nothing: `Query Records` is emitted (a typed client call with a backend, a typed
 *   stub without), which is an export, not a refusal.
 * - `backend-only` → nothing: a cloud-function node never appears in a frontend picker, and the
 *   picker-coverage population excludes it for the same reason.
 * - `deferred` → the badge, with the kind read off the exemption's opening phrase. An exemption
 *   the checker would refuse (neither phrase) reads as `scheduled` rather than as exported — the
 *   safe side, since the node does not export either way.
 * - unknown type → nothing: a kit node's export is decided by its kit (EXP-010), and a component
 *   instance by its component.
 */
export function exportBadgeOf(typeName: string): ExportBadge | undefined {
  const entry = entries.get(typeName);
  if (entry === undefined || entry.status !== 'deferred') return undefined;
  const exemption = entry.exemption ?? '';
  if (OUT_OF_SCOPE.test(exemption)) {
    return { kind: 'out-of-scope', label: 'Not exportable', reason: exemption.replace(OUT_OF_SCOPE, '') };
  }
  return { kind: 'scheduled', label: 'Not exportable yet', reason: exemption.replace(SCHEDULED, '') };
}
