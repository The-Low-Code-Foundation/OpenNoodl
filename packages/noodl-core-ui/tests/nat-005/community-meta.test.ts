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
    expect(replyLatency(null, 0)).toBe('no reply yet');
    expect(replyLatency(undefined, 0)).toBe('no reply yet');
  });

  it('scales its unit with the wait', () => {
    expect(replyLatency(12, 1)).toBe('answered in 12 min');
    expect(replyLatency(90, 1)).toBe('answered in 2h');
    expect(replyLatency(60 * 24 * 5, 1)).toBe('answered in 5 days');
  });

  it('refuses a nonsense number rather than drawing it', () => {
    expect(replyLatency(-4, 0)).toBeNull();
    expect(replyLatency(Number.NaN, 0)).toBeNull();
    expect(replyLatency(Number.POSITIVE_INFINITY, 0)).toBeNull();
  });

  it('🔴 "no reply yet" and a refusal are DIFFERENT answers', () => {
    // They render differently and mean opposite things: one is a fact about the community, the
    // other is a fact about the payload. Collapsing them would make a broken field look quiet.
    expect(replyLatency(null, 0)).not.toBe(replyLatency(-1, 0));
  });
});

/**
 * FIX-025 bug 7 — *"Answered question still says 'no reply yet'"*.
 *
 * 🔴 **THE TWO ROWS BELOW ARE PRODUCTION, COPIED FROM THE WIRE ON 2026-08-27**, not invented:
 * `curl https://community.nodegx.io/api/v1/community/threads` returns exactly these two threads,
 * with the same title and the same author, differing in `replyCount` alone. Before this change
 * they rendered the **identical** sentence, which is why the bug survived a fix and two drives.
 *
 * ⚠️ **The unanswered row is the negative control and it matters more than the positive one.**
 * Every assertion here except that one is satisfied by a function that simply stopped saying
 * "no reply yet" — and that function would be wrong, because a genuinely unanswered question is
 * the row the Bench exists to surface.
 */
describe('FIX-025 bug 7 — null minutes means nobody ELSE has answered', () => {
  /** `de14371e…` — the asker answered their own question, and accepted it. */
  const ANSWERED_BY_THE_ASKER = { firstReplyMinutes: null, replyCount: 1 };
  /** `2abd111a…` — same title, same author, nobody has said anything. */
  const NOBODY_HAS_ANSWERED = { firstReplyMinutes: null, replyCount: 0 };

  it('🔴 does not call a thread with a reply on it unanswered', () => {
    const drawn = replyLatency(ANSWERED_BY_THE_ASKER.firstReplyMinutes, ANSWERED_BY_THE_ASKER.replyCount);
    expect(drawn).toBe('no reply from anyone else yet');
    // The reported sentence, stated as the thing that must NOT come back.
    expect(drawn).not.toBe('no reply yet');
  });

  it('🔴 NEGATIVE CONTROL — a question nobody has answered still says so', () => {
    expect(replyLatency(NOBODY_HAS_ANSWERED.firstReplyMinutes, NOBODY_HAS_ANSWERED.replyCount)).toBe(
      'no reply yet'
    );
  });

  it('🔴 the two production rows no longer render the same sentence', () => {
    // The whole defect in one line: `firstReplyMinutes` is null on both, so a function reading
    // only that field cannot tell them apart however it is worded.
    expect(replyLatency(ANSWERED_BY_THE_ASKER.firstReplyMinutes, ANSWERED_BY_THE_ASKER.replyCount)).not.toBe(
      replyLatency(NOBODY_HAS_ANSWERED.firstReplyMinutes, NOBODY_HAS_ANSWERED.replyCount)
    );
  });

  it('🔴 both null branches still SPEAK, because the tab counts them as unreplied', () => {
    // `Launcher/views/Community.tsx` draws "N unreplied" from this same null. A row that went
    // quiet would leave that number accounted for by nothing on the page.
    for (const replies of [0, 1, 5]) {
      expect(replyLatency(null, replies)).not.toBeNull();
      expect(replyLatency(null, replies)).not.toBe('');
    }
  });

  it('a real answer still beats both, however many follow-ups the asker wrote', () => {
    expect(replyLatency(41, 9)).toBe('answered in 41 min');
    expect(replyLatency(41, 0)).toBe('answered in 41 min');
  });

  it('⚠️ an unusable count degrades to the old sentence rather than throwing', () => {
    // This field crosses the wire, and this file's siblings have twice been burned by a declared
    // field arriving `undefined`. Degrading to "no reply yet" is the pre-existing behaviour.
    expect(replyLatency(null, undefined)).toBe('no reply yet');
    expect(replyLatency(null, null)).toBe('no reply yet');
    expect(replyLatency(null, Number.NaN)).toBe('no reply yet');
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
