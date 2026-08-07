/**
 * The access-rule vocabulary as a SELECTION, not as text (SPR-001 §3 / F85).
 *
 * A collection permission rule is `'public' | 'authenticated' | 'nobody' |
 * 'role:<name>'`, or an array of those with OR semantics — the vocabulary is
 * closed and is declared once, in `nodegx-backend/src/security/model.ts`. The
 * panel used to collect it as free text, so `nobdy` was a policy and `nobody`
 * was a different one, and neither the panel nor the author could tell them
 * apart until a user was let in.
 *
 * This module is the pure half of the fix: it turns a stored rule into a set of
 * booleans a control can render, turns that set back into the exact rule shape
 * the backend validates, and enforces the two exclusions that the OR semantics
 * make real. It is deliberately free of React, Electron and editor singletons
 * so it can be tested in `tests-unit/` by a plain Node runner.
 *
 * **The semantics being encoded**, read off `ruleAllows` in the backend model:
 *
 * - `public` grants everyone, so a set containing it means exactly `public`.
 * - `nobody` grants no one and is skipped inside a set — `['nobody','role:a']`
 *   is `role:a`. So "nobody" is not a member of a set; it is the EMPTY set,
 *   which is why it has no checkbox of its own in the stored form.
 * - `authenticated` grants any signed-in caller, and every role holder is
 *   signed in — so a role beside `authenticated` can never change an answer.
 *   That is a redundancy worth SAYING (`redundantRoles`) rather than silently
 *   deleting, because a config written elsewhere may legitimately contain it.
 *
 * @module panels/permissions/ruleVocabulary
 */

/** A rule as `security.json` stores it: one atom, or an array of them (OR). */
export type RuleValue = string | string[];

export const CLP_OPS = ['find', 'get', 'create', 'update', 'delete'] as const;
export type ClpOp = (typeof CLP_OPS)[number];

export const ROLE_PREFIX = 'role:';

/** `role:<name>` for a role name, the one place the prefix is spelled. */
export function roleAtom(name: string): string {
  return `${ROLE_PREFIX}${name}`;
}

/** The role name inside a `role:<name>` atom, or null if it is not one. */
export function roleName(atom: string): string | null {
  if (!atom.startsWith(ROLE_PREFIX)) return null;
  const name = atom.slice(ROLE_PREFIX.length);
  return name.length > 0 ? name : null;
}

/**
 * One rule, as a control can hold it.
 *
 * `inherit` is not an atom — it is the ABSENCE of a rule, which for a
 * collection means the default decides. It is a separate field rather than a
 * fourth audience because "nobody" and "whatever the default says" are
 * different answers that a single tri-state would eventually conflate, and the
 * conflation is only visible after the default changes.
 */
export interface RuleSelection {
  /** No rule of its own; something upstream decides. */
  inherit: boolean;
  /** `public` — every caller, signed in or not. */
  anyone: boolean;
  /** `authenticated` — any signed-in caller. */
  signedIn: boolean;
  /** Role names, without the `role:` prefix, in the order they were stored. */
  roles: string[];
  /**
   * Atoms this model does not understand, preserved verbatim.
   *
   * The backend validates every write (`validateSecurityConfig`), so a stored
   * rule cannot contain a typo — but it CAN contain a `role:` atom for a role
   * that no longer exists, or one created outside this panel. Keeping them
   * here means a round trip through the control never silently deletes a rule
   * it could not draw.
   */
  unknown: string[];
}

export const NOBODY: RuleSelection = { inherit: false, anyone: false, signedIn: false, roles: [], unknown: [] };
export const INHERIT: RuleSelection = { ...NOBODY, inherit: true };

/** Every atom of a rule, whichever shape it was stored in. */
export function atomsOf(rule: RuleValue | undefined): string[] {
  if (rule === undefined || rule === null) return [];
  return Array.isArray(rule) ? rule : [rule];
}

/**
 * Read a stored rule into a selection. `undefined` is inheritance; anything
 * that grants no one — `'nobody'`, `[]`, `['nobody']` — is the empty set.
 *
 * Nothing is normalised away here except the `nobody` atom, whose only possible
 * effect inside a set is none. In particular `['public','role:a']` keeps both,
 * so a control shows what is stored rather than what is meant; `describe`
 * answers the second question separately.
 */
export function parseRule(rule: RuleValue | undefined): RuleSelection {
  if (rule === undefined || rule === null) return { ...INHERIT };
  const selection: RuleSelection = { inherit: false, anyone: false, signedIn: false, roles: [], unknown: [] };
  for (const atom of atomsOf(rule)) {
    if (typeof atom !== 'string') {
      selection.unknown.push(String(atom));
      continue;
    }
    if (atom === 'public') selection.anyone = true;
    else if (atom === 'authenticated') selection.signedIn = true;
    else if (atom === 'nobody') continue;
    else {
      const name = roleName(atom);
      if (name !== null) {
        if (!selection.roles.includes(name)) selection.roles.push(name);
      } else selection.unknown.push(atom);
    }
  }
  return selection;
}

/**
 * The rule to store. `undefined` means "write no rule" — the caller deletes the
 * key (collections) or the whole entry (functions), which is what inheritance
 * IS on the wire.
 *
 * An empty selection becomes the literal `'nobody'` rather than an empty array,
 * because the backend refuses `[]` by name: *"empty rule arrays are not allowed
 * (use \"nobody\")"*.
 */
export function selectionToRule(selection: RuleSelection): RuleValue | undefined {
  if (selection.inherit) return undefined;
  const atoms: string[] = [];
  if (selection.anyone) atoms.push('public');
  if (selection.signedIn) atoms.push('authenticated');
  for (const role of selection.roles) atoms.push(roleAtom(role));
  for (const extra of selection.unknown) atoms.push(extra);
  if (atoms.length === 0) return 'nobody';
  return atoms.length === 1 ? atoms[0] : atoms;
}

/** No one at all — the empty set, which stores as `'nobody'`. */
export function isNobody(selection: RuleSelection): boolean {
  return (
    !selection.inherit &&
    !selection.anyone &&
    !selection.signedIn &&
    selection.roles.length === 0 &&
    selection.unknown.length === 0
  );
}

/**
 * Roles that cannot change this rule's answer because `authenticated` already
 * grants everyone who could hold them. Not removed — reported, so the control
 * can say so where an author can see it.
 */
export function redundantRoles(selection: RuleSelection): string[] {
  if (selection.anyone) return selection.roles;
  return selection.signedIn ? selection.roles : [];
}

/** Who this rule actually lets through, in the panel's own words. */
export function describeSelection(selection: RuleSelection): string {
  if (selection.inherit) return 'default';
  if (selection.anyone) return 'Anyone';
  if (selection.signedIn) return 'Anyone signed in';
  const parts = [...selection.roles, ...selection.unknown];
  if (parts.length === 0) return 'Nobody';
  return parts.join(', ');
}

/** The same sentence, straight from a stored rule. */
export function describeRule(rule: RuleValue | undefined): string {
  return describeSelection(parseRule(rule));
}

// ============================================================================
// Transitions — where the exclusions live
// ============================================================================

/**
 * `public` is exclusive because it dominates: any atom beside it is dead text.
 * `nobody` is exclusive because it is the empty set. Both are enforced HERE, at
 * the moment of a click, rather than at write time — a control that lets you
 * tick "Anyone" and "admin" together and then quietly stores one of them is the
 * same class of lie as the text box this replaces.
 */
export function withAnyone(): RuleSelection {
  return { ...NOBODY, anyone: true };
}

export function withNobody(): RuleSelection {
  return { ...NOBODY };
}

export function withInherit(): RuleSelection {
  return { ...INHERIT };
}

export function withSignedIn(selection: RuleSelection, on: boolean): RuleSelection {
  const base = grantable(selection);
  return { ...base, signedIn: on };
}

export function withRole(selection: RuleSelection, role: string, on: boolean): RuleSelection {
  const base = grantable(selection);
  const roles = base.roles.filter((r) => r !== role);
  if (on) roles.push(role);
  return { ...base, roles };
}

/** Drop one atom the control could not draw (the escape hatch's only edit). */
export function withoutUnknown(selection: RuleSelection, atom: string): RuleSelection {
  return { ...selection, inherit: false, unknown: selection.unknown.filter((a) => a !== atom) };
}

/**
 * The starting point for adding a grant: no longer inheriting, and no longer
 * `public` — because ticking a role on a rule that says "Anyone" can only mean
 * the author is narrowing it, and leaving `public` there would make the click
 * do nothing at all.
 */
function grantable(selection: RuleSelection): RuleSelection {
  return { ...selection, inherit: false, anyone: false };
}

/**
 * Every role a control must offer for a set of rules: the roles that exist,
 * plus any a rule already names — a rule may outlive the role it mentions, and
 * a dropdown that cannot show `role:ghost` is a dropdown that deletes it.
 */
export function rolesToOffer(existing: string[], rules: (RuleValue | undefined)[]): string[] {
  const offered = [...existing];
  for (const rule of rules) {
    for (const atom of atomsOf(rule)) {
      const name = typeof atom === 'string' ? roleName(atom) : null;
      if (name !== null && !offered.includes(name)) offered.push(name);
    }
  }
  return offered;
}
