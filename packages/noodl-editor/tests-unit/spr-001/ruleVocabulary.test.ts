/**
 * SPR-001 §3 / F85 — the collection-permission rule vocabulary.
 *
 * The panel used to collect a rule as free text over a closed vocabulary, so
 * `nobdy` was a silently different policy from `nobody`. `ruleVocabulary.ts` is
 * the selection model that replaced it, and these specs pin the two things that
 * make it safe:
 *
 * 1. **Everything it can produce, the backend accepts.** Not asserted against a
 *    copy of the vocabulary — asserted against `validateRuleValue` from
 *    `nodegx-backend/src/security/model.ts`, the same function the admin route
 *    validates a write with. A twin of the vocabulary is how the panel and the
 *    gate come to disagree.
 * 2. **Nothing it reads is lost when it is written back.** A rule may name a
 *    role that no longer exists, or one created outside this panel; a control
 *    that cannot draw such an atom must still not delete it.
 *
 * Plain-Node runner (`tests-unit`), which is why the module under test has no
 * React and no Electron in it.
 */

import { validateRuleValue, ruleAllows, Principal } from '../../../nodegx-backend/src/security/model';
import {
  RuleValue,
  atomsOf,
  describeSelection,
  isNobody,
  parseRule,
  redundantRoles,
  roleAtom,
  roleName,
  rolesToOffer,
  selectionToRule,
  withAnyone,
  withInherit,
  withNobody,
  withRole,
  withSignedIn,
  withoutUnknown
} from '../../src/editor/src/views/panels/permissions/ruleVocabulary';

const anonymous: Principal = { kind: 'anonymous' };
const plainUser: Principal = { kind: 'user', userId: 'u1', roles: [] };
const admin: Principal = { kind: 'user', userId: 'u2', roles: ['admin'] };

describe('reading a stored rule', () => {
  it('reads the three atoms and a role', () => {
    expect(parseRule('public')).toEqual({
      inherit: false,
      anyone: true,
      signedIn: false,
      roles: [],
      unknown: []
    });
    expect(parseRule('authenticated').signedIn).toBe(true);
    expect(parseRule('role:admin').roles).toEqual(['admin']);
  });

  it('reads an absent rule as inheritance, not as nobody', () => {
    // The distinction the old text box could not hold: blank meant "the default
    // decides", and the default is not necessarily "nobody".
    expect(parseRule(undefined).inherit).toBe(true);
    expect(isNobody(parseRule(undefined))).toBe(false);
    expect(isNobody(parseRule('nobody'))).toBe(true);
  });

  it('treats `nobody` inside a set as the no-op the backend treats it as', () => {
    // ruleAllows() `continue`s past 'nobody', so ['nobody','role:admin'] IS
    // role:admin. The control must not draw it as a contradiction.
    const selection = parseRule(['nobody', 'role:admin']);
    expect(selection.roles).toEqual(['admin']);
    expect(ruleAllows(['nobody', 'role:admin'], admin)).toBe(true);
  });

  it('keeps a set that a written-elsewhere config may contain', () => {
    const selection = parseRule(['public', 'role:admin']);
    expect(selection.anyone).toBe(true);
    expect(selection.roles).toEqual(['admin']);
    expect(selectionToRule(selection)).toEqual(['public', 'role:admin']);
  });

  it('parks an atom it cannot draw instead of dropping it', () => {
    // 'role:' with no name is the only invalid form reachable here — the
    // backend refuses it on write, so this is defensive, not expected.
    const selection = parseRule(['authenticated', 'role:']);
    expect(selection.unknown).toEqual(['role:']);
    expect(selectionToRule(selection)).toEqual(['authenticated', 'role:']);
    expect(selectionToRule(withoutUnknown(selection, 'role:'))).toBe('authenticated');
  });
});

describe('writing a selection back', () => {
  it('writes inheritance as undefined, so the caller deletes the key', () => {
    expect(selectionToRule(withInherit())).toBeUndefined();
  });

  it('writes the empty set as the literal "nobody", never as []', () => {
    // The backend refuses an empty array by name: "empty rule arrays are not
    // allowed (use \"nobody\")".
    expect(selectionToRule(withNobody())).toBe('nobody');
    expect(validateRuleValue([])).not.toBeNull();
  });

  it('collapses a single atom to a string and keeps a set as an array', () => {
    expect(selectionToRule(withRole(withNobody(), 'admin', true))).toBe('role:admin');
    const two = withRole(withRole(withNobody(), 'admin', true), 'editor', true);
    expect(selectionToRule(two)).toEqual(['role:admin', 'role:editor']);
  });

  it('survives a role name containing a comma, which the text box could not', () => {
    // The replaced control round-tripped through `split(',')`, so a role named
    // "a,b" came back as two rules that grant nothing.
    const selection = withRole(withNobody(), 'a,b', true);
    expect(selectionToRule(selection)).toBe('role:a,b');
    expect(parseRule(selectionToRule(selection)).roles).toEqual(['a,b']);
  });
});

describe('the exclusions, enforced at the click and not at the write', () => {
  it('makes "Anyone" clear everything else — every other atom is dead text', () => {
    const before = withRole(withSignedIn(withNobody(), true), 'admin', true);
    const after = withAnyone();
    expect(before.roles).toEqual(['admin']);
    expect(after).toEqual({ inherit: false, anyone: true, signedIn: false, roles: [], unknown: [] });
  });

  it('makes "Nobody" clear everything else — it is the empty set', () => {
    expect(isNobody(withNobody())).toBe(true);
  });

  it('narrows away from "Anyone" when a role or signed-in is ticked', () => {
    // Ticking a role on a public rule can only mean narrowing; leaving `public`
    // there would make the click do literally nothing.
    const narrowed = withRole(parseRule('public'), 'admin', true);
    expect(narrowed.anyone).toBe(false);
    expect(selectionToRule(narrowed)).toBe('role:admin');
    expect(withSignedIn(parseRule('public'), true).anyone).toBe(false);
  });

  it('stops inheriting the moment a grant is ticked', () => {
    expect(withSignedIn(withInherit(), true).inherit).toBe(false);
    expect(withRole(withInherit(), 'admin', true).inherit).toBe(false);
  });

  it('reports a role beside "signed-in" as redundant rather than deleting it', () => {
    // Every role holder is signed in, so the role cannot change an answer.
    const both = withRole(withSignedIn(withNobody(), true), 'admin', true);
    expect(redundantRoles(both)).toEqual(['admin']);
    expect(ruleAllows(selectionToRule(both) as RuleValue, plainUser)).toBe(true);
    expect(selectionToRule(both)).toEqual(['authenticated', 'role:admin']);
  });
});

describe('everything the control can produce, the backend accepts', () => {
  const roles = ['admin', 'editor'];
  const every: RuleValue[] = [];
  // Every selection reachable by clicking: each audience, and each subset of
  // two roles, with and without signed-in.
  for (const signedIn of [false, true]) {
    for (const withAdmin of [false, true]) {
      for (const withEditor of [false, true]) {
        let selection = withSignedIn(withNobody(), signedIn);
        if (withAdmin) selection = withRole(selection, 'admin', true);
        if (withEditor) selection = withRole(selection, 'editor', true);
        const rule = selectionToRule(selection);
        if (rule !== undefined) every.push(rule);
      }
    }
  }
  every.push(selectionToRule(withAnyone()) as RuleValue);

  it('validates against the backend model, not against a copy of it', () => {
    for (const rule of every) {
      expect({ rule, error: validateRuleValue(rule) }).toEqual({ rule, error: null });
    }
    expect(every.length).toBeGreaterThan(8);
    expect(roles).toEqual(['admin', 'editor']);
  });

  it('round-trips: parse → write → parse is the same selection', () => {
    for (const rule of every) {
      expect(parseRule(selectionToRule(parseRule(rule)))).toEqual(parseRule(rule));
    }
  });

  it('means what the words on screen say', () => {
    expect(describeSelection(parseRule('public'))).toBe('Anyone');
    expect(describeSelection(parseRule('authenticated'))).toBe('Anyone signed in');
    expect(describeSelection(parseRule('nobody'))).toBe('Nobody');
    expect(describeSelection(parseRule(undefined))).toBe('default');
    expect(describeSelection(parseRule(['role:admin', 'role:editor']))).toBe('admin, editor');
    // And the words are not a story: nobody really is nobody.
    expect(ruleAllows('nobody', admin)).toBe(false);
    expect(ruleAllows('public', anonymous)).toBe(true);
  });
});

describe('the roles a control must offer', () => {
  it('offers every role that exists', () => {
    expect(rolesToOffer(['admin', 'editor'], [])).toEqual(['admin', 'editor']);
  });

  it('also offers a role a rule already names but that no longer exists', () => {
    // The escape hatch that matters: `role:ghost` is a valid, storable rule for
    // a role that is not in _Role. A dropdown that cannot show it deletes it.
    expect(rolesToOffer(['admin'], ['role:ghost', ['authenticated', 'role:admin']])).toEqual(['admin', 'ghost']);
    expect(validateRuleValue('role:ghost')).toBeNull();
  });

  it('spells the prefix in exactly one place', () => {
    expect(roleAtom('admin')).toBe('role:admin');
    expect(roleName('role:admin')).toBe('admin');
    expect(roleName('authenticated')).toBeNull();
    expect(roleName('role:')).toBeNull();
    expect(atomsOf(undefined)).toEqual([]);
    expect(atomsOf('public')).toEqual(['public']);
  });
});
