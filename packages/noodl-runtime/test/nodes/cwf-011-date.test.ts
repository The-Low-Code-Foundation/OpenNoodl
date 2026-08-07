/**
 * Date maths, in the shared runtime (CWF-011).
 *
 * These nodes are registered in `@noodl/runtime`'s own list, so this suite is exercising exactly
 * the code the browser viewer runs — same module, same registration path. The cloud half is
 * driven end to end in `nodegx-backend/tests/cloud-date-family.test.ts`.
 *
 * ⚠️ **The month-arithmetic answer is in the test names**, per the task: 31 January plus one month
 * **clamps to 28/29 February**. It does not overflow to 2/3 March. Getting this silently wrong is
 * the classic date bug, so the decision is asserted here, written on the node page, and explained
 * in `datemath.ts`.
 */

import { createNode } from '../helpers/node-harness';

import DateToStringModule = require('../../src/nodes/std-library/datetostring');
import NowModule = require('../../src/nodes/std-library/date/now');
import DateAddModule = require('../../src/nodes/std-library/date/dateadd');
import DateDifferenceModule = require('../../src/nodes/std-library/date/datedifference');
import DateCompareModule = require('../../src/nodes/std-library/date/datecompare');
import DatePartsModule = require('../../src/nodes/std-library/date/dateparts');

/** Local-zone construction, so the assertions are about the same calendar the nodes read. */
const local = (y: number, m: number, d: number, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

describe('Now (CWF-011 slice 1)', () => {
  it('reads the wall clock, not the frame clock', () => {
    // ⚠️ CWF-011 said to use `platform.getCurrentTime()`. In the browser that hook is
    // `window.performance.now()` — milliseconds since page load — so a Now node built on it
    // would answer with a date in January 1970. `Date.now()` is the same clock in all three
    // runtimes, and it is the one a test can control.
    const now = createNode(NowModule, 'net.noodl.Now');
    const timestamp = Number(now.out('timestamp'));
    expect(Math.abs(timestamp - Date.now())).toBeLessThan(5000);
    expect(timestamp).toBeGreaterThan(1_600_000_000_000); // comfortably after 2020
  });

  it('re-reads on Read and announces it', () => {
    const now = createNode(NowModule, 'net.noodl.Now');
    const realNow = Date.now;
    Date.now = () => 1_700_000_000_000;
    try {
      // ⚠️ The node reads `new Date(Date.now())` rather than `new Date()` precisely so that this
      // works: the bare constructor reads the clock internally and ignores a substituted
      // `Date.now`, which would make the node untestable.
      now.pulse('read');
      now.context.updateDirtyNodes();
    } finally {
      Date.now = realNow;
    }
    expect(now.out('timestamp')).toBe(1_700_000_000_000);
    expect(now.out('iso')).toBe('2023-11-14T22:13:20.000Z');
    expect(now.signals).toContain('done');
  });
});

describe('Date Add (CWF-011 slice 2)', () => {
  const add = (date: Date | string | number, amount: number, unit?: string) => {
    const node = createNode(DateAddModule, 'net.noodl.DateAdd');
    if (unit) node.node.setInputValue('unit', unit);
    node.node.setInputValue('amount', amount);
    node.node.setInputValue('input', date);
    return node;
  };

  it('adds days by default, with neither default setter having run', () => {
    const node = add(local(2026, 1, 1), 30);
    expect(node.out('result')).toEqual(local(2026, 1, 31));
    expect(node.signals).toContain('changed');
  });

  it('31 January plus 1 month CLAMPS to 28 February, it does not overflow to 3 March', () => {
    expect(add(local(2026, 1, 31), 1, 'months').out('result')).toEqual(local(2026, 2, 28));
  });

  it('31 January plus 1 month CLAMPS to 29 February in a leap year', () => {
    expect(add(local(2024, 1, 31), 1, 'months').out('result')).toEqual(local(2024, 2, 29));
  });

  it('29 February plus 1 year CLAMPS to 28 February', () => {
    expect(add(local(2024, 2, 29), 1, 'years').out('result')).toEqual(local(2025, 2, 28));
  });

  it('subtracts when the amount is negative', () => {
    expect(add(local(2026, 3, 31), -1, 'months').out('result')).toEqual(local(2026, 2, 28));
  });

  it('reads an ISO string and a millisecond timestamp as dates, because a JSON round trip changes both', () => {
    expect(add('2026-01-01T00:00:00.000Z', 1, 'hours').out('result')).toEqual(
      new Date('2026-01-01T01:00:00.000Z')
    );
    expect(add(Date.UTC(2026, 0, 1), 1, 'hours').out('result')).toEqual(new Date('2026-01-01T01:00:00.000Z'));
  });

  it('abstains before a date has arrived, and only reports Invalid Date once an unreadable one has', () => {
    const node = createNode(DateAddModule, 'net.noodl.DateAdd');
    node.node.setInputValue('amount', 1);
    node.node.setInputValue('unit', 'days');
    expect(node.signals).toEqual([]); // an unset input is not a failure

    node.node.setInputValue('input', 'the day before yesterday');
    expect(node.signals).toContain('failure');
    expect(node.out('result')).toBeUndefined();
  });
});

describe('Date Difference (CWF-011 slice 2)', () => {
  const diff = (from: Date, to: Date, unit?: string, absolute?: boolean) => {
    const node = createNode(DateDifferenceModule, 'net.noodl.DateDifference');
    if (unit) node.node.setInputValue('unit', unit);
    if (absolute !== undefined) node.node.setInputValue('absolute', absolute);
    node.node.setInputValue('from', from);
    node.node.setInputValue('to', to);
    return node;
  };

  it('is signed: To earlier than From is negative', () => {
    expect(diff(local(2026, 1, 10), local(2026, 1, 1)).out('difference')).toBe(-9);
  });

  it('does not round a fixed unit — 36 hours is 1.5 days', () => {
    expect(diff(local(2026, 1, 1, 0), local(2026, 1, 2, 12)).out('difference')).toBe(1.5);
  });

  it('counts whole calendar months: 31 January to 28 February is 1 (clamping lands exactly there)', () => {
    expect(diff(local(2026, 1, 31), local(2026, 2, 28), 'months').out('difference')).toBe(1);
    expect(diff(local(2026, 1, 31), local(2026, 3, 31), 'months').out('difference')).toBe(2);
  });

  it('counts whole calendar months: 31 January to 27 February is 0, because one month would overshoot', () => {
    // The invariant: Add(from, Difference(from, to)) never lands past `to`. Add(31 Jan, 1 month)
    // is 28 February, which is after 27 February, so the answer is 0 rather than 1.
    expect(diff(local(2026, 1, 31), local(2026, 2, 27), 'months').out('difference')).toBe(0);
  });

  it('drops the sign when Absolute is on', () => {
    expect(diff(local(2026, 1, 10), local(2026, 1, 1), 'days', true).out('difference')).toBe(9);
  });

  it('abstains until both dates are supplied', () => {
    const node = createNode(DateDifferenceModule, 'net.noodl.DateDifference');
    node.node.setInputValue('from', local(2026, 1, 1));
    expect(node.signals).toEqual([]);
    node.node.setInputValue('to', local(2026, 1, 2));
    expect(node.signals).toContain('changed');
  });
});

describe('Date Compare (CWF-011 slice 3)', () => {
  const compare = (a: Date, b: Date, granularity?: string) => {
    const node = createNode(DateCompareModule, 'net.noodl.DateCompare');
    if (granularity) node.node.setInputValue('granularity', granularity);
    node.node.setInputValue('a', a);
    node.node.setInputValue('b', b);
    return node;
  };

  it('compares to the millisecond by default', () => {
    const node = compare(local(2026, 1, 1, 9, 0, 0), local(2026, 1, 1, 17, 0, 0));
    expect(node.out('before')).toBe(true);
    expect(node.out('same')).toBe(false);
    expect(node.signals).toContain('isBefore');
  });

  it('answers "same day" at day granularity — the question people are actually asking', () => {
    const node = compare(local(2026, 1, 1, 9, 0, 0), local(2026, 1, 1, 17, 0, 0), 'day');
    expect(node.out('same')).toBe(true);
    expect(node.out('before')).toBe(false);
    expect(node.signals).toContain('isSame');
  });

  it('answers "same month" and "same year" too', () => {
    expect(compare(local(2026, 3, 1), local(2026, 3, 31), 'month').out('same')).toBe(true);
    expect(compare(local(2026, 1, 1), local(2026, 12, 31), 'month').out('same')).toBe(false);
    expect(compare(local(2026, 1, 1), local(2026, 12, 31), 'year').out('same')).toBe(true);
  });

  it('fires exactly one of the three signals per comparison', () => {
    const node = compare(local(2026, 2, 1), local(2026, 1, 1));
    const fired = node.signals.filter((s) => s === 'isBefore' || s === 'isAfter' || s === 'isSame');
    expect(fired).toEqual(['isAfter']);
  });
});

describe('Date Parts (CWF-011 slice 3)', () => {
  it('numbers months from 1, because nobody reading "Month" expects January to be 0', () => {
    const node = createNode(DatePartsModule, 'net.noodl.DateParts');
    node.node.setInputValue('input', local(2026, 1, 15, 13, 45, 30));
    expect(node.out('year')).toBe(2026);
    expect(node.out('month')).toBe(1);
    expect(node.out('date')).toBe(15);
    expect(node.out('hours')).toBe(13);
    expect(node.out('minutes')).toBe(45);
    expect(node.out('seconds')).toBe(30);
    expect(node.signals).toContain('changed');
  });

  it('names the weekday and numbers the ISO week', () => {
    const node = createNode(DatePartsModule, 'net.noodl.DateParts');
    // 1 January 2026 is a Thursday, and ISO week 1 is the week holding the first Thursday.
    node.node.setInputValue('input', local(2026, 1, 1));
    expect(node.out('dayName')).toBe('Thursday');
    expect(node.out('dayOfWeek')).toBe(4);
    expect(node.out('isoWeek')).toBe(1);
  });

  it('puts 1 January 2027 (a Friday) in ISO week 53 of 2026, not week 1', () => {
    const node = createNode(DatePartsModule, 'net.noodl.DateParts');
    node.node.setInputValue('input', local(2027, 1, 1));
    expect(node.out('isoWeek')).toBe(53);
  });

  it('reports Invalid Date for something it cannot read', () => {
    const node = createNode(DatePartsModule, 'net.noodl.DateParts');
    node.node.setInputValue('input', 'never');
    expect(node.signals).toContain('failure');
    expect(node.out('year')).toBeUndefined();
  });
});

describe('Date To String keeps its old behaviour and gains a Timezone (CWF-011 slice 4)', () => {
  const render = (date: Date, format?: string, timeZone?: string) => {
    const node = createNode(DateToStringModule, 'Date To String');
    if (format) node.node.setInputValue('formatString', format);
    if (timeZone !== undefined) node.node.setInputValue('timeZone', timeZone);
    node.node.setInputValue('input', date);
    return node;
  };

  /**
   * ⚠️ The task asks for "byte-identical output to today's, proven by a test that predates the
   * change". There was no such test — `Date To String` had none at all, in either package. So the
   * proof is written the only honest way that was available: the expectations below are the
   * ORIGINAL algorithm's output, computed by hand from the same `Date` fields the untouched
   * branch reads, with the Timezone input never touched.
   */
  it('renders exactly as before when Timezone is never touched', () => {
    expect(render(local(2026, 1, 5)).out('currentValue')).toBe('2026-01-05');
    expect(
      render(local(2026, 1, 5, 9, 7, 3), '{yearShort}/{monthShort}/{date} {hours}:{minutes}:{seconds}').out(
        'currentValue'
      )
    ).toBe('26/Jan/05 09:07:03');
  });

  it('still reports Invalid Date and blanks the output for an unreadable date', () => {
    const node = render(new Date('nonsense'));
    expect(node.out('currentValue')).toBe('');
    expect(node.signals).toContain('onError');
  });

  it('renders in a named IANA zone when one is set', () => {
    // 15:30 UTC on a January day: 16:30 in Europe/London (GMT in winter is +00, but Paris is +01),
    // 10:30 in New York.
    const instant = new Date('2026-01-15T15:30:00.000Z');
    expect(render(instant, '{date} {hours}:{minutes}', 'UTC').out('currentValue')).toBe('15 15:30');
    expect(render(instant, '{date} {hours}:{minutes}', 'Europe/Paris').out('currentValue')).toBe('15 16:30');
    expect(render(instant, '{date} {hours}:{minutes}', 'America/New_York').out('currentValue')).toBe('15 10:30');
  });

  it('rolls the DATE as well as the hour when the zone crosses midnight', () => {
    // 23:30 UTC is already the next day in Tokyo. This is the defect the input exists for: a
    // server in one zone rendering a date for a user in another.
    const instant = new Date('2026-01-15T23:30:00.000Z');
    expect(render(instant, '{year}-{month}-{date} {hours}', 'Asia/Tokyo').out('currentValue')).toBe('2026-01-16 08');
    expect(render(instant, '{year}-{month}-{date} {hours}', 'UTC').out('currentValue')).toBe('2026-01-15 23');
  });

  it('renders midnight as 00, not 24', () => {
    expect(render(new Date('2026-01-15T00:15:00.000Z'), '{hours}:{minutes}', 'UTC').out('currentValue')).toBe('00:15');
  });

  it('treats an unknown zone as an Invalid Date rather than silently falling back to local', () => {
    const node = render(local(2026, 1, 5), '{year}', 'Mars/Olympus_Mons');
    expect(node.out('currentValue')).toBe('');
    expect(node.signals).toContain('onError');
  });
});
