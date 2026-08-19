/**
 * NAT-005 — the meta line a community row draws, graded.
 *
 * These are the only decisions on this surface a headless runner can reach: `jest.config.js` here
 * is `testEnvironment: 'node'` with no jsdom in the tree, so a *string* is gradeable and a pixel
 * is not. The components that place these strings are graded from the editor's runner by walking
 * the React element tree (`noodl-editor/tests-unit/nat-005/`), and by looking at them.
 *
 * 🔴 **The Postgres-text case below is not hypothetical.** NAT-006 found a column declared `Date`
 * arriving as `2026-08-19 18:58:53.754123+00` depending on which pooled connection answered.
 * Both spellings parse in V8, which is what makes it dangerous — the failure mode is `NaN`
 * rendered as words, not a throw.
 */
import {
  absoluteDate,
  kindLabel,
  metaLine,
  relativeTime,
  replyLatency,
} from '@noodl-core-ui/components/community/communityMeta';

/** A fixed instant, so nothing here is a fact about the day CI ran. */
const NOW = new Date('2026-08-19T18:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('the instrument can reject a wrong answer', () => {
  it('🔴 CONTROL: refuses garbage rather than scoring it', () => {
    // Without this, every `null` assertion below passes for a function that returns null always.
    expect(relativeTime('not a date', NOW)).toBeNull();
    expect(relativeTime('', NOW)).toBeNull();
    expect(relativeTime(null, NOW)).toBeNull();
    expect(absoluteDate('not a date')).toBeNull();
    expect(kindLabel('   ')).toBeNull();
  });

  it('🔴 CONTROL: and answers a known-good input, so a null is a refusal and not a stuck function', () => {
    expect(relativeTime(ago(3 * HOUR), NOW)).toBe('3 hours ago');
    expect(absoluteDate('2026-03-14T09:00:00.000Z')).toBe('14 Mar 2026');
    expect(kindLabel('tutorial')).toBe('Tutorial');
  });
});

describe('a timestamp is read whichever spelling the pool sent (NAT-006)', () => {
  // Microsecond precision and a space instead of the `T` — Postgres's own text, verbatim.
  const POSTGRES_TEXT = '2026-08-19 15:00:00.754123+00';
  const SAME_INSTANT_ISO = '2026-08-19T15:00:00.754Z';

  it('reads Postgres text as the same instant as its ISO spelling', () => {
    expect(relativeTime(POSTGRES_TEXT, NOW)).toBe(relativeTime(SAME_INSTANT_ISO, NOW));
    expect(relativeTime(POSTGRES_TEXT, NOW)).toBe('2 hours ago');
  });

  it('🔴 never lets NaN reach a reader as words', () => {
    for (const bad of ['NaN', 'undefined', '0000-00-00 00:00:00+00', ' ']) {
      const drawn = relativeTime(bad, NOW);
      expect(drawn === null || !drawn.includes('NaN')).toBe(true);
    }
  });
});

describe('relativeTime says what a person would say', () => {
  it.each([
    [30_000, 'just now'],
    [MINUTE, '1 minute ago'],
    [9 * MINUTE, '9 minutes ago'],
    [HOUR, '1 hour ago'],
    [5 * HOUR, '5 hours ago'],
    [26 * HOUR, 'yesterday'],
    [3 * DAY, '3 days ago'],
    [9 * DAY, '1 week ago'],
    [20 * DAY, '2 weeks ago'],
  ])('%i ms ago reads as %s', (delta, expected) => {
    expect(relativeTime(ago(delta as number), NOW)).toBe(expected);
  });

  it('stops counting weeks and states the date, because "9 weeks ago" is a sum a reader has to do', () => {
    expect(relativeTime('2026-03-14T09:00:00.000Z', NOW)).toBe('14 Mar 2026');
  });

  it('⚠️ a future timestamp reads as "just now", never as a negative', () => {
    // Clock skew between a laptop and the platform is ordinary; "in -3 minutes" makes a reader
    // distrust the whole surface for a fault that is nobody's.
    const drawn = relativeTime(new Date(NOW + 5 * MINUTE).toISOString(), NOW);
    expect(drawn).toBe('just now');
    expect(drawn).not.toContain('-');
  });
});

describe('replyLatency — the half of a thread row a reader scans for', () => {
  it('🔴 says nobody answered, which is the row worth drawing loudest', () => {
    expect(replyLatency(null)).toBe('no reply yet');
    expect(replyLatency(undefined)).toBe('no reply yet');
  });

  it('scales its unit with the wait', () => {
    expect(replyLatency(12)).toBe('answered in 12 min');
    expect(replyLatency(90)).toBe('answered in 2h');
    expect(replyLatency(60 * 24 * 5)).toBe('answered in 5 days');
  });

  it('refuses a nonsense number rather than drawing it', () => {
    expect(replyLatency(-4)).toBeNull();
    expect(replyLatency(Number.NaN)).toBeNull();
    expect(replyLatency(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('🔴 "no reply yet" and a refusal are DIFFERENT answers', () => {
    // They render differently and mean opposite things: one is a fact about the community, the
    // other is a fact about the payload. Collapsing them would make a broken field look quiet.
    expect(replyLatency(null)).not.toBe(replyLatency(-1));
  });
});

describe('kindLabel keeps an open vocabulary open', () => {
  it('capitalises whatever the column holds, including a kind nobody has added yet', () => {
    expect(kindLabel('tutorial')).toBe('Tutorial');
    expect(kindLabel('tip')).toBe('Tip');
    // ⚠️ A closed map here would render a new kind as nothing at all the day somebody adds one.
    expect(kindLabel('postmortem')).toBe('Postmortem');
  });
});

describe('metaLine drops what could not be read rather than drawing a lone bullet', () => {
  it('joins what survived', () => {
    expect(metaLine(['Tutorial', '3 days ago'])).toBe('Tutorial · 3 days ago');
  });

  it('drops nulls, and returns null when nothing survived', () => {
    expect(metaLine([null, '3 days ago'])).toBe('3 days ago');
    expect(metaLine([null, undefined, ''])).toBeNull();
  });

  it('🔴 never returns a string that starts or ends with the separator', () => {
    const drawn = metaLine([null, 'Tip', null]);
    expect(drawn).toBe('Tip');
    expect(drawn?.startsWith('·')).toBe(false);
    expect(drawn?.endsWith('·')).toBe(false);
  });
});
