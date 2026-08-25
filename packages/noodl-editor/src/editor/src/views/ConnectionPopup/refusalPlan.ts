/**
 * SIG-001 — what to do with a port the editor has just refused.
 *
 * ## Why this is not in the component
 *
 * `ConnectionBar` deleted refused ports with `if (p.disabled) return;` for years,
 * so none of this has ever run. The two decisions it makes — *which category was
 * ruled out* and *which wire the builder actually meant* — are the whole task,
 * and both are answerable from plain data: a list of ports, their type names,
 * and the group priority the node declares. Neither needs React, the node
 * library singleton, or a drag in progress.
 *
 * Import-free, so `tests-unit/connection-popup/refusalPlan.test.ts` grades the
 * ranking against a Text Input-shaped port list rather than by dragging a wire
 * at the right node and squinting.
 *
 * ## The rule being modelled
 *
 * Two rules, not one, and they disagree. `canCastPortTypes`
 * (`nodelibraryexport.ts:207`) allows `signal -> boolean` and `signal -> number`;
 * `ConnectionBar` then layers a stricter rule on top — a signal output reaches
 * only a signal input — and the editor wins. `rankAlternatives` therefore takes
 * the ports the *popup* left enabled, not a cast-table answer, which keeps this
 * module on the right side of that disagreement by construction.
 */

import type { RefusalReason } from './portCopy';

export type { RefusalReason };

/** A port row as `ConnectionBar._getPorts` builds it, narrowed to what matters here. */
export interface PlannablePort {
  name: string;
  displayName: string;
  /** `NodeLibrary.nameForPortType(p.type)` — resolved by the caller, which owns the library. */
  typeName: string;
  group?: string;
  disabled?: boolean;
  reason?: RefusalReason;
}

/** The ungrouped bucket. Named here because two modules and a component all say it. */
export const OTHER_GROUP = 'Other';

/**
 * The order a node gets when it declares no `connectionPanel.groupPriority`.
 *
 * SIG-003 §3. Was `['General', 'Events', 'Actions', 'States']`, which put the
 * things that *happened* above the things you can *cause* and named neither of
 * the two headings the library actually leans on — a node's values and its
 * errors. The order below reads as a sentence about the node: what it is, what
 * it has, what you do to it, what it tells you, how it is doing, what went
 * wrong.
 *
 * ⚠️ Entries are matched against `group` strings by literal equality, here and
 * in every per-node `groupPriority`. `scripts/node-audit/port-groups.js` fails
 * on a rename that moves one side and not the other.
 */
export const DEFAULT_GROUP_PRIORITY: readonly string[] = [
  'General',
  'Values',
  'Actions',
  'Events',
  'Status',
  'Error',
  'States',
  'Advanced'
];

/**
 * Order group headings for display.
 *
 * Three tiers, because before SIG-003 there were only two and the second was not
 * an order at all:
 *
 * 1. groups named in `priority`, in that order;
 * 2. everything else, **alphabetically** — this is the new part. The old sort
 *    floated each priority entry to the top one pass at a time and left every
 *    unlisted group in whatever order it happened to be built in, which is
 *    recorded in source at `text-input.ts:45` about `Run On Value Change`. A
 *    heading's position was therefore a property of the declaration order in the
 *    node file, and nothing said so;
 * 3. `Other` last — and after §1 it should be empty, because a port with no
 *    `group` is now a gate failure rather than a silent demotion.
 */
export function orderGroups<T extends { name: string }>(groups: readonly T[], priority: readonly string[]): T[] {
  const rankOf = (name: string): number => {
    if (name === OTHER_GROUP) return Number.MAX_SAFE_INTEGER;
    const index = priority.indexOf(name);
    return index === -1 ? priority.length : index;
  };

  return groups.slice().sort((a, b) => {
    const rankA = rankOf(a.name);
    const rankB = rankOf(b.name);
    if (rankA !== rankB) return rankA - rankB;
    // Same tier. Listed groups cannot collide (an index is unique), so this only
    // ever runs for the unlisted tier — and there it is the whole point.
    return a.name.localeCompare(b.name);
  });
}

const KNOWN_REASONS: readonly string[] = ['signal-rule', 'type-mismatch', 'duplicate', 'other'];

/**
 * `getConnectionStatus().reason`, narrowed at the boundary.
 *
 * The model types that field as a plain `string` so a subclass can refuse a wire
 * for a reason this popup has never heard of — `WorkflowGraphModel` already
 * refuses three ways of its own. Anything unrecognised becomes `'other'`, which
 * the copy renders as *refused, and I am not going to guess why*. ⚠️ The failure
 * this prevents is not a crash: it is a summary row confidently naming a
 * category the refusal was not about, which a builder would then act on.
 */
export function asRefusalReason(value: string | undefined): RefusalReason {
  return KNOWN_REASONS.indexOf(value) === -1 ? 'other' : (value as RefusalReason);
}

/**
 * The single reason to attribute a set of refused ports to.
 *
 * A group is usually homogeneous — the signal ports of a node are refused
 * together, for the same reason — so the common case is the only reason present.
 * When it is not, `'other'` is returned rather than the first one found: a
 * summary row that confidently names one of two reasons is worse than one that
 * names neither.
 */
export function dominantReason(ports: readonly PlannablePort[]): RefusalReason {
  const reasons = new Set<RefusalReason>();
  for (const p of ports) reasons.add(p.reason || 'other');
  if (reasons.size === 1) return ports[0]?.reason || 'other';
  return 'other';
}

/**
 * Split a refused set into the ports that are **switched off** and the rest.
 *
 * ## Why this exists, and it was a drive that found it
 *
 * FB-021 scope 2 was built, unit-specced and committed before this: a gated port
 * is marked inert with its own reason, `refusedGroupSummary` says *"N ports
 * switched off by a setting"* for it, and that branch even sits above the signal
 * test so the more specific fact wins. Every one of those parts is correct on its
 * own, and the composition was still wrong.
 *
 * 🔴 Driven on a `Group` in `contentSize` with a string output in flight, the
 * folded block held **8 gated ports and one type-mismatched `Focus`**. Mixed, so
 * {@link dominantReason} answers `'other'` — deliberately, and rightly for two
 * kinds of *refusal* — and the summary rendered **"9 ports this wire can't
 * reach"** over eight ports the wire reaches perfectly well.
 *
 * That is the precise sentence FB-021 exists to prevent. `gated` is not a vaguer
 * refusal, it is the opposite claim: every other reason means *the wire will not
 * be made*, and this one means it **will be made and then ignored**. Melting the
 * two together sends an author hunting a type error that is not there — Jordan's
 * reading, four times.
 *
 * So the two never share a summary. They are different statements about different
 * things, and one line cannot be true of both.
 *
 * ⚠️ Deliberately **not** solved by making `gated` win in `dominantReason`: that
 * would put *"switched off by a setting"* over the type-mismatched row instead,
 * which is the same defect pointing the other way.
 *
 * Order is `refused` first, then `gated`: it leaves a set with no gated ports
 * rendering exactly as it did, and the wire-refusals are what a builder mid-drag
 * asked about.
 */
export function partitionGated(ports: readonly PlannablePort[]): {
  refused: PlannablePort[];
  gated: PlannablePort[];
} {
  const refused: PlannablePort[] = [];
  const gated: PlannablePort[] = [];
  for (const p of ports) (p.reason === 'gated' ? gated : refused).push(p);
  return { refused, gated };
}

/**
 * The type name to describe a set of refused ports by, or `undefined` when they
 * do not share one.
 *
 * This is what decides whether the summary row says "4 signal inputs · a moment,
 * not a value" or the generic line: the signal wording is only honest when every
 * port under it is in fact a signal.
 */
export function dominantTypeName(ports: readonly PlannablePort[]): string | undefined {
  const types = new Set<string>();
  for (const p of ports) types.add(p.typeName);
  return types.size === 1 ? ports[0]?.typeName : undefined;
}

/**
 * The wires the builder might have meant, best first.
 *
 * "Best matching" per SIG-001 §5: the target's still-connectable ports, ranked
 * by exact type match, then by the node's declared group priority, then by
 * declaration order so the answer is stable between renders.
 *
 * ## ⚠️ Why `primaryPortName` had to be added
 *
 * Specced as *type, then group priority*, and driven on the flagship case —
 * a TextInput's `Text` output dragged at a Button — that ranking answers
 * **Variant**. It is not a bug in the implementation: `Variant` is `string`
 * (exact match) in group `General` (priority 0), while `Label` is `string` in
 * group `Label` (priority 6), so `Variant` wins on the stated rule and the offer
 * reads *"connect it to a value input like Variant"*.
 *
 * Nobody has ever wanted that. **`groupPriority` is a display order, not a
 * ranking of likelihood** — Button lists `General` first because that is where
 * `Variant` and `Enabled` live, not because it is the likeliest target — and
 * SIG-001's acceptance is that the resulting wire is *the one a builder would
 * have drawn by hand*.
 *
 * The library already records which port a node is *about*: `usePortAsLabel`,
 * the port the canvas paints as the node's label (`label` on Button, `text` on
 * Text, `collectionName` on a collection, `url`, `expression`, `functionName` —
 * 35-odd node types). That is the missing rank key, and it is a declaration
 * rather than a heuristic.
 *
 * ⚠️ It ranks *below* exact type match on purpose. A node's primary port is only
 * the right answer when the wire can actually carry — offering `Label` to a
 * `color` output because Button is "about" its label would be the same mistake
 * with better manners.
 *
 * ⚠️ Returns `[]` when nothing on the node can take this source. The caller must
 * say so plainly and offer nothing — an arbitrary redirect is worse than the
 * current silence.
 */
export function rankAlternatives(
  sourceTypeName: string,
  ports: readonly PlannablePort[],
  groupPriority: readonly string[] = [],
  primaryPortName?: string
): PlannablePort[] {
  const candidates = ports.filter((p) => !p.disabled);

  // `Number.MAX_SAFE_INTEGER` rather than `groupPriority.length`: an ungrouped
  // port and a port in an unlisted group both sort after every named group, and
  // must not accidentally tie with the last named one.
  const priorityOf = (p: PlannablePort) => {
    const index = groupPriority.indexOf(p.group || OTHER_GROUP);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  return candidates
    .map((port, index) => ({ port, index }))
    .sort((a, b) => {
      const exactA = a.port.typeName === sourceTypeName ? 0 : 1;
      const exactB = b.port.typeName === sourceTypeName ? 0 : 1;
      if (exactA !== exactB) return exactA - exactB;

      const primaryA = primaryPortName && a.port.name === primaryPortName ? 0 : 1;
      const primaryB = primaryPortName && b.port.name === primaryPortName ? 0 : 1;
      if (primaryA !== primaryB) return primaryA - primaryB;

      const priorityA = priorityOf(a.port);
      const priorityB = priorityOf(b.port);
      if (priorityA !== priorityB) return priorityA - priorityB;

      return a.index - b.index;
    })
    .map((entry) => entry.port);
}

/**
 * Whether the top-ranked alternative is good enough to *connect* on a click,
 * rather than merely to point at.
 *
 * ## The defect this exists for
 *
 * SIG-001 §5 asks for both behaviours — "if there is exactly one, offer it by
 * name; if there are several, scroll the list to them rather than guessing" —
 * and the first build shipped the copy of the first with the behaviour of the
 * second. Driven on a TextInput (90-odd connectable inputs), the offer read
 * *"connect it to **Label** instead, and it updates by itself"*, and clicking it
 * scrolled the list and drew **no wire at all**. A sentence that describes a
 * connection, on a control that does not make one, is worse than the silence
 * this whole task is replacing: it teaches the builder that the editor ignores
 * them.
 *
 * ## The rule
 *
 * A redirect is confident when the top candidate is *distinguished*, not merely
 * first:
 *
 *  - it is the port the node declares itself to be about (`usePortAsLabel`), or
 *  - it is the only port on the node whose type matches the source exactly.
 *
 * Anything else is a tie broken by display order, which is precisely the guess
 * the spec forbids — so the offer says so and stays inert.
 */
export function isConfidentRedirect(
  sourceTypeName: string,
  alternatives: readonly PlannablePort[],
  primaryPortName?: string
): boolean {
  const best = alternatives[0];
  if (!best) return false;
  if (primaryPortName && best.name === primaryPortName) return true;

  const exactMatches = alternatives.filter((p) => p.typeName === sourceTypeName);
  return exactMatches.length === 1 && exactMatches[0].name === best.name;
}
