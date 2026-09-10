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

/** How much of the node picker exports — the headline number the alpha warning prints. */
export interface ExportCoverage {
  /** Placeable picker nodes with a translation (`pickerCoverageFloor`, held by `export-ledger:picker --check`). */
  exportable: number;
  /** Placeable picker nodes in all (`pickerCoverageTotal`, held by the same check). */
  placeable: number;
  /** Whole percent, rounded down — 117 of 127 reads "92%", never "93%". */
  percent: number;
}

/**
 * The picker-coverage reading, as the ledger records it.
 *
 * 🔴 Both numbers are the gate's own: `export-ledger:picker --check` fails when either drifts
 * from what `picker-coverage.js` counts off the catalog, so the sentence the editor prints beside
 * its alpha warning is the phase's headline number and not a second copy of it. Rounded DOWN so
 * the product never claims a percent it has not reached.
 *
 * ⚠️ **Do not quote the numbers here.** This docstring read *"97 of the 127"* for long enough that
 * FLD-013 found it stale against a ledger that says **117 of 127 (92%)** — a prose copy of a
 * computed number, in the file whose whole argument is that there is only one list. Call the
 * function.
 */
export function exportCoverage(): ExportCoverage {
  const { pickerCoverageFloor, pickerCoverageTotal } = ledgerJson as { pickerCoverageFloor: number; pickerCoverageTotal: number };
  return {
    exportable: pickerCoverageFloor,
    placeable: pickerCoverageTotal,
    percent: pickerCoverageTotal > 0 ? Math.floor((100 * pickerCoverageFloor) / pickerCoverageTotal) : 0
  };
}

/**
 * The alpha sentence, shared by the pre-flight modal, the settings section and the emitted README —
 * one wording, three readers, so it cannot say three different things.
 */
export function alphaNotice(): string {
  const c = exportCoverage();
  return (
    `Code export is in alpha. ${c.exportable} of the ${c.placeable} nodes you can place export today (${c.percent}%); ` +
    'the rest are left out by name. Explore the code and build on it, but do not ship a production app from it yet.'
  );
}
