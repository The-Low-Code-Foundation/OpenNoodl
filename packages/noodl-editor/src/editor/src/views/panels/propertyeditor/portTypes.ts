/**
 * "What can this port connect to" — FH-020 slice 4.
 *
 * ## Why this is its own module, and pure
 *
 * The rule is not one function. `NodeLibrary.canCastPortTypes` answers *may A
 * reach B* for one pair, and the connection popup then layers a second rule on
 * top of it (`ConnectionBar.tsx:144-152`): a **signal output** may only reach a
 * signal input, whatever the cast table says. The cast table really does allow
 * `signal -> boolean` and `signal -> number`, so a tab that read the table alone
 * would tell an author that `Done` can drive a Number input. It cannot.
 *
 * Both halves live here, so the Ports tab and the popup cannot drift into
 * saying different things about the same wire. Nothing in this file imports the
 * editor: it takes the typecast table as an argument, which is what makes it
 * testable in the plain-Node `tests-unit` runner (see
 * `tests-unit/property-editor/portTypes.test.ts`).
 */

/** One row of `NodeLibraryData.typecasts` (see `nodelibraryexport.ts:207`). */
export interface TypecastRule {
  from: string;
  to: string[];
}

/** The wildcard port type: casts to and from everything. */
export const ANY_PORT_TYPE = '*';

/**
 * `NodeLibrary.canCastPortTypes`, over an explicit table.
 *
 * Kept byte-equivalent to `nodelibrary.ts:311-324` on purpose — if that rule
 * changes, this is the twin that has to change with it.
 */
export function canCastPortType(typecasts: readonly TypecastRule[], from: string, to: string): boolean {
  if (!from || !to) return false;
  if (from === ANY_PORT_TYPE || to === ANY_PORT_TYPE) return true;
  if (from === to) return true;

  const cast = typecasts.find((c) => c.from === from);
  if (!cast || !Array.isArray(cast.to)) return false;

  return cast.to.indexOf(to) !== -1;
}

/**
 * The popup's extra rule: a signal output only reaches a signal input.
 *
 * `ConnectionBar.tsx` applies this *after* `getConnectionStatus`, so it is
 * genuinely part of what an author can wire, and it is not in the cast table.
 */
function isBlockedBySignalRule(from: string, to: string): boolean {
  return from === 'signal' && to !== 'signal' && to !== ANY_PORT_TYPE;
}

/** Every port type the cast table mentions, in either column, except `*`. */
export function portTypeUniverse(typecasts: readonly TypecastRule[]): string[] {
  const names = new Set<string>();
  for (const rule of typecasts || []) {
    if (rule.from && rule.from !== ANY_PORT_TYPE) names.add(rule.from);
    for (const to of rule.to || []) {
      if (to && to !== ANY_PORT_TYPE) names.add(to);
    }
  }
  return Array.from(names);
}

/**
 * The port types that can legally sit on the other end of a wire from a port of
 * `typeName`.
 *
 * `undefined` means *unbounded* — a `*` port takes anything, and the tab says
 * "Any" rather than listing the whole table (FH-020 slice 4: "If that set is
 * unbounded (`*`), say `Any` and stop.").
 *
 * `direction` is the direction of the port being described: an **input** is
 * asked what may flow into it, an **output** what it may flow into.
 *
 * The port's own type sorts first — it is the answer an author is looking for
 * — and the rest alphabetically, so the line is stable between renders.
 */
export function connectablePortTypes(
  typecasts: readonly TypecastRule[],
  typeName: string | undefined,
  direction: 'input' | 'output'
): string[] | undefined {
  if (!typeName) return undefined;
  if (typeName === ANY_PORT_TYPE) return undefined;

  const universe = portTypeUniverse(typecasts);

  // A port can carry a type the cast table never names (`domelement` before it
  // was listed, every custom module type). It still connects to itself.
  if (universe.indexOf(typeName) === -1) universe.push(typeName);

  const reaches = universe.filter((other) => {
    const [from, to] = direction === 'input' ? [other, typeName] : [typeName, other];
    return canCastPortType(typecasts, from, to) && !isBlockedBySignalRule(from, to);
  });

  reaches.sort((a, b) => {
    if (a === typeName) return -1;
    if (b === typeName) return 1;
    return a.localeCompare(b);
  });

  return reaches;
}
