/**
 * SIG-002 §2 — the search that is the complaint, and the searches that are not.
 *
 * Both halves are acceptance criteria. "Searching `set` returns copy that
 * answers the question" is the feature; "searching a nonsense term returns the
 * ordinary empty state, with no advice" is the guard that keeps it from being
 * noise.
 */

import { answersTimingIntent, isTimingIntentSearch } from '../../src/editor/src/views/ConnectionPopup/searchIntent';

describe('SIG-002 — searches that mean "where is the Set?"', () => {
  it.each(['set', 'trigger', 'update', 'apply', 'assign', 'fire', 'run', 'send'])('fires on %s', (term) => {
    expect(isTimingIntentSearch(term)).toBe(true);
  });

  it('fires mid-type, from three characters', () => {
    // The answer has to arrive while they are still typing. Waiting for the
    // finished word means arriving after they have given up.
    expect(isTimingIntentSearch('trig')).toBe(true);
    expect(isTimingIntentSearch('updat')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(isTimingIntentSearch('  SET ')).toBe(true);
  });
});

describe('SIG-002 — searches that mean nothing of the kind', () => {
  it('says nothing clever about a nonsense term', () => {
    expect(isTimingIntentSearch('xyzzy')).toBe(false);
  });

  it('does not fire on a two-character prefix', () => {
    // `se` is a prefix of half the library; answering it would attach the
    // explanation to a keystroke on the way somewhere else.
    expect(isTimingIntentSearch('se')).toBe(false);
    expect(isTimingIntentSearch('s')).toBe(false);
  });

  it('does not fire on a longer word that merely starts with an intent term', () => {
    // "settings" is not the question, and the answer would be wrong for it.
    expect(isTimingIntentSearch('settings')).toBe(false);
    expect(isTimingIntentSearch('runtime')).toBe(false);
  });

  it('does not fire on an empty or absent term', () => {
    expect(isTimingIntentSearch('')).toBe(false);
    expect(isTimingIntentSearch('   ')).toBe(false);
    expect(isTimingIntentSearch(undefined)).toBe(false);
  });
});

describe('SIG-002 — ⚠️ an incidental substring match is not an answer', () => {
  const BUTTON_PORTS = [
    { displayName: 'Box Shadow Offset X', typeName: 'number' },
    { displayName: 'Box Shadow Offset Y', typeName: 'number' },
    { displayName: 'Label', typeName: 'string' }
  ];

  /*
   * Measured live on a real Button: searching `set` returned three ports, all of
   * them shadow *offsets*, and the answer never appeared because the first build
   * only spoke when the result list was empty. The builder from the complaint is
   * then further from the answer than an empty list would have left them — the
   * list looks like it worked.
   */
  it('answers on a Button, whose ports merely contain the letters', () => {
    expect(answersTimingIntent('set', BUTTON_PORTS)).toBe(true);
  });

  it('stays quiet when the node really does have a Set', () => {
    const textInput = BUTTON_PORTS.concat([{ displayName: 'Set', typeName: 'signal' }]);
    expect(answersTimingIntent('set', textInput)).toBe(false);
  });

  it('is not fooled by a *value* port literally called Set', () => {
    // A value input named `Set` is not the trigger they are looking for, and
    // pointing at it would teach the wrong thing.
    const odd = BUTTON_PORTS.concat([{ displayName: 'Set', typeName: 'string' }]);
    expect(answersTimingIntent('set', odd)).toBe(true);
  });

  it('still says nothing clever about nonsense', () => {
    expect(answersTimingIntent('xyzzy', BUTTON_PORTS)).toBe(false);
  });
});
