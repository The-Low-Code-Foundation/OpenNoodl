/**
 * NAT-008 — reading a paged directory to the end, and admitting it when you did not.
 *
 * ## 🔴 Why this file exists at all
 *
 * `GET /api/v1/community/people` pages — 50 rows by default, 100 at most, measured 2026-08-20
 * against the route handler on a real database. A client that filtered *the page it was given*
 * would be searching part of the directory and drawing the answer as though it were the whole,
 * which is this task's named failure mode wearing a different coat.
 *
 * So `readDirectory` follows `nextOffset` to the end and reports whether it got there. Every
 * assertion below is about one of the four ways that can go: it finishes, it runs out of pages, a
 * page fails, or the platform hands back a `nextOffset` that does not advance.
 *
 * @module noodl-editor/tests-unit/nat-008/directory-read
 */
import {
  readDirectory,
  readPersonSummary,
  type PageInfo,
  type Paged,
  type PersonSummary,
  type Read
} from '@noodl-models/community/communityapi';

function row(handle: string): PersonSummary {
  return {
    handle,
    displayName: handle,
    bio: null,
    availableForWork: false,
    offersCoaching: false,
    points: 0,
    rateBand: null,
    skills: [],
    badgeCount: 0,
    lastActiveAt: null
  };
}

/** A fake platform holding `count` people and serving them `pageSize` at a time. */
function fakePlatform(count: number, pageSize: number) {
  const all = Array.from({ length: count }, (_, i) => row(`p${i}`));
  const asked: number[] = [];

  return {
    asked,
    people: async (window: { limit?: number; offset?: number } = {}): Promise<Read<Paged<PersonSummary>>> => {
      const offset = window.offset ?? 0;
      asked.push(offset);
      const items = all.slice(offset, offset + pageSize);
      const end = offset + items.length;
      const page: PageInfo = { limit: pageSize, offset, total: count, nextOffset: end < count ? end : null };
      return { outcome: 'ok', value: { items, page } };
    }
  };
}

describe('NAT-008 — readDirectory', () => {
  it('follows nextOffset to the end and reports complete', async () => {
    const platform = fakePlatform(7, 3);
    const read = await readDirectory(platform);
    if (read.outcome !== 'ok') throw new Error('expected ok');

    expect(read.value.people.map((p) => p.handle)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(read.value.total).toBe(7);
    expect(read.value.complete).toBe(true);
    expect(platform.asked).toEqual([0, 3, 6]);
  });

  it('a single page that says nextOffset:null is complete after ONE request', async () => {
    // ⚠️ The control for the loop: without it, "complete" could be true because the loop always
    // says so, and the paging assertion above would still pass.
    const platform = fakePlatform(2, 50);
    const read = await readDirectory(platform);
    if (read.outcome !== 'ok') throw new Error('expected ok');
    expect(platform.asked).toEqual([0]);
    expect(read.value.complete).toBe(true);
  });

  it('stops at the stated cap and says the read is INCOMPLETE', async () => {
    // 🔴 The whole reason `complete` exists. Two pages of three out of nine.
    const platform = fakePlatform(9, 3);
    const read = await readDirectory(platform, { maxPages: 2 });
    if (read.outcome !== 'ok') throw new Error('expected ok');

    expect(read.value.people).toHaveLength(6);
    expect(read.value.total).toBe(9);
    expect(read.value.complete).toBe(false);
  });

  it('a failure on page two is a FAILURE, not a short directory', async () => {
    // 🔴 Returning what we had would hand the surface a list it draws as complete — and the
    // reader would be told the platform has fewer people rather than that we could not finish.
    let call = 0;
    const read = await readDirectory({
      people: async (): Promise<Read<Paged<PersonSummary>>> => {
        call += 1;
        if (call === 1) {
          return {
            outcome: 'ok',
            value: { items: [row('p0')], page: { limit: 1, offset: 0, total: 5, nextOffset: 1 } }
          };
        }
        return { outcome: 'unreachable', status: 500, detail: 'HTTP 500' };
      }
    });

    expect(read.outcome).toBe('unreachable');
  });

  it('a nextOffset that does not advance ends the loop instead of hanging', async () => {
    // 🔴 A platform bug must not turn this client into a hammer. Ended AND reported incomplete,
    // which is the pair of statements that is true.
    let calls = 0;
    const read = await readDirectory({
      people: async (): Promise<Read<Paged<PersonSummary>>> => {
        calls += 1;
        return {
          outcome: 'ok',
          value: { items: [row('p0')], page: { limit: 1, offset: 0, total: 9, nextOffset: 0 } }
        };
      }
    });

    if (read.outcome !== 'ok') throw new Error('expected ok');
    expect(calls).toBe(1);
    expect(read.value.complete).toBe(false);
  });

  it('a 404 on the list is passed through as `absent`, never as an empty directory', async () => {
    const read = await readDirectory({ people: async (): Promise<Read<Paged<PersonSummary>>> => ({ outcome: 'absent' }) });
    expect(read.outcome).toBe('absent');
  });
});

describe('NAT-008 — reading one row off the wire', () => {
  it('drops a row with no handle rather than drawing an entry point that cannot open', () => {
    expect(readPersonSummary({ displayName: 'Nameless', points: 5 })).toBeNull();
  });

  it('keeps the timestamp exactly as it arrived, including Postgres\'s own spelling', () => {
    // ⚠️ NAT-007 measured `2026-08-19 11:19:27.206885+00` on the live wire — the pooled-connection
    // finding. `communityMeta`'s formatters take both spellings, and normalising here would put a
    // second decision beside the one that already exists.
    const parsed = readPersonSummary({ handle: 'ada', lastActiveAt: '2026-08-19 11:19:27.206885+00' });
    expect(parsed?.lastActiveAt).toBe('2026-08-19 11:19:27.206885+00');
  });

  it('does not invent an account id, because the platform deliberately does not send one', () => {
    // NAT-006 dropped the internal account UUID from every surface. A field here would be this
    // client asking for it back.
    const parsed = readPersonSummary({ handle: 'ada', accountId: '11111111-1111-1111-1111-111111111111' });
    expect(JSON.stringify(parsed)).not.toContain('11111111');
  });

  it('coerces the numbers rather than propagating NaN into a sentence', () => {
    const parsed = readPersonSummary({ handle: 'ada', points: 'lots', badgeCount: null });
    expect(parsed?.points).toBe(0);
    expect(parsed?.badgeCount).toBe(0);
  });
});
