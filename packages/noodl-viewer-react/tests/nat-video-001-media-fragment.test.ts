/**
 * §2 of `NOTES-UNOWNED-NODE-WORK.md` — Start Time and End Time for the mp4 path.
 *
 * 🔴 **The collision is the subject, not the composition.** `Video.tsx` already appended `#t=0.01`
 * to every source to force Android to render a first frame, guarded on `indexOf('#t=') === -1`.
 * The ports need that same mechanism, so the assertions that matter are the ones about the two
 * meeting: an unset pair must produce byte-identically what shipped before, an author-set start
 * must not be overwritten by the workaround, and the workaround must survive an end-only setting.
 */
import { ANDROID_FIRST_FRAME_SECONDS, withMediaFragment } from '../src/media-fragment';

const SRC = 'https://cdn.test/clip.mp4';

describe('NAT-VIDEO-001 §1 — the Android hack is preserved exactly', () => {
  it('🔴 appends the same fragment it always did when neither port is set', () => {
    expect(withMediaFragment(SRC)).toBe(`${SRC}#t=0.01`);
    expect(ANDROID_FIRST_FRAME_SECONDS).toBe(0.01);
  });

  it('treats every empty value a port can deliver as unset', () => {
    // The Empty-Value Contract: a wire can deliver undefined, a cleared field delivers ''.
    for (const empty of [undefined, null, '']) {
      expect(withMediaFragment(SRC, empty, empty)).toBe(`${SRC}#t=0.01`);
    }
  });

  it('leaves a hand-written fragment alone while the ports are unset', () => {
    // This was the only way to do it before the ports existed, and it keeps working.
    expect(withMediaFragment(`${SRC}#t=12`)).toBe(`${SRC}#t=12`);
  });

  it('passes an absent or empty source straight through', () => {
    expect(withMediaFragment(undefined)).toBeUndefined();
    expect(withMediaFragment('')).toBe('');
  });
});

describe('NAT-VIDEO-001 §2 — the ports compose into the same fragment', () => {
  it('🔴 an author-set start REPLACES the hack rather than being appended after it', () => {
    // `#t=30` seeks, so it does the hack's job. Two fragments, or `#t=0.01` winning, would both
    // be the defect this row exists for.
    expect(withMediaFragment(SRC, 30)).toBe(`${SRC}#t=30`);
  });

  it('🔴 an end-only setting KEEPS the Android start', () => {
    // The workaround must not be lost just because the author only cared about the end.
    expect(withMediaFragment(SRC, undefined, 10)).toBe(`${SRC}#t=0.01,10`);
  });

  it('writes both when both are set', () => {
    expect(withMediaFragment(SRC, 5, 10)).toBe(`${SRC}#t=5,10`);
  });

  it('🔴 the ports beat a hand-written fragment, and replace it rather than doubling it', () => {
    const out = withMediaFragment(`${SRC}#t=99`, 5, 10);
    expect(out).toBe(`${SRC}#t=5,10`);
    expect(out.match(/#t=/g)).toHaveLength(1);
  });

  it('accepts a numeric string, which is what a text-ish port delivers', () => {
    expect(withMediaFragment(SRC, '5', '10')).toBe(`${SRC}#t=5,10`);
  });
});

describe('NAT-VIDEO-001 §3 — values that would render nothing', () => {
  it('🔴 drops an end that is not later than the start', () => {
    // A reversed or empty range plays nothing at all, which reads as a broken node rather than as
    // a bad value. The start still applies.
    expect(withMediaFragment(SRC, 10, 5)).toBe(`${SRC}#t=10`);
    expect(withMediaFragment(SRC, 10, 10)).toBe(`${SRC}#t=10`);
  });

  it('drops an end that is not later than the DEFAULT start', () => {
    // Start unset means 0.01, so an end of 0 is still an empty range.
    expect(withMediaFragment(SRC, undefined, 0)).toBe(`${SRC}#t=0.01`);
  });

  it('clamps a negative start to zero rather than emitting it', () => {
    expect(withMediaFragment(SRC, -5)).toBe(`${SRC}#t=0`);
  });

  it('ignores a value that is not a number at all', () => {
    expect(withMediaFragment(SRC, 'soon')).toBe(`${SRC}#t=0.01`);
    expect(withMediaFragment(SRC, NaN, Infinity)).toBe(`${SRC}#t=0.01`);
  });
});
