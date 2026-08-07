/**
 * WF-005 cron parser — the bounded standard-cron grammar and next() semantics.
 */
import { parseCron, validateCron, CronParseError } from '../src/triggers/cron';

describe('parseCron', () => {
  it('parses presets', () => {
    expect(parseCron('@hourly').matches(new Date(2026, 0, 1, 13, 0))).toBe(true);
    expect(parseCron('@hourly').matches(new Date(2026, 0, 1, 13, 5))).toBe(false);
    expect(parseCron('@daily').matches(new Date(2026, 0, 1, 0, 0))).toBe(true);
    expect(parseCron('@daily').matches(new Date(2026, 0, 1, 1, 0))).toBe(false);
  });

  it('rejects malformed expressions loudly', () => {
    expect(() => parseCron('')).toThrow(CronParseError);
    expect(() => parseCron('* * *')).toThrow(/expected 5 fields/);
    expect(() => parseCron('60 * * * *')).toThrow(/out of range/);
    expect(() => parseCron('* * * * 9')).toThrow(/out of range/);
    expect(() => parseCron('@bogus')).toThrow(/unknown cron preset/);
    expect(validateCron('*/0 * * * *')).toMatch(/invalid step/);
    expect(validateCron('0 0 * * *')).toBeNull();
  });

  it('handles steps, ranges, lists, and names', () => {
    const everyFive = parseCron('*/5 * * * *');
    expect(everyFive.matches(new Date(2026, 0, 1, 0, 0))).toBe(true);
    expect(everyFive.matches(new Date(2026, 0, 1, 0, 5))).toBe(true);
    expect(everyFive.matches(new Date(2026, 0, 1, 0, 6))).toBe(false);

    const businessHours = parseCron('0 9-17 * * MON-FRI');
    // 2026-01-05 is a Monday.
    expect(businessHours.matches(new Date(2026, 0, 5, 9, 0))).toBe(true);
    expect(businessHours.matches(new Date(2026, 0, 5, 18, 0))).toBe(false);
    // 2026-01-04 is a Sunday.
    expect(businessHours.matches(new Date(2026, 0, 4, 9, 0))).toBe(false);

    const list = parseCron('0,30 * * JAN *');
    expect(list.matches(new Date(2026, 0, 1, 0, 30))).toBe(true);
    expect(list.matches(new Date(2026, 1, 1, 0, 30))).toBe(false); // February
  });

  it('normalizes day-of-week 7 to Sunday', () => {
    expect(parseCron('0 0 * * 7').matches(new Date(2026, 0, 4, 0, 0))).toBe(true); // Sun
    expect(parseCron('0 0 * * 0').matches(new Date(2026, 0, 4, 0, 0))).toBe(true);
  });

  it('applies the OR rule when both day-of-month and day-of-week are restricted', () => {
    // Fires on the 1st OR on Mondays.
    const cron = parseCron('0 0 1 * MON');
    expect(cron.matches(new Date(2026, 0, 1, 0, 0))).toBe(true); // the 1st (a Thursday)
    expect(cron.matches(new Date(2026, 0, 5, 0, 0))).toBe(true); // a Monday
    expect(cron.matches(new Date(2026, 0, 6, 0, 0))).toBe(false); // Tue, not the 1st
  });

  describe('next()', () => {
    it('returns the next occurrence strictly after the given time', () => {
      const cron = parseCron('0 * * * *'); // top of every hour
      const next = cron.next(new Date(2026, 0, 1, 13, 30, 0));
      expect(next.getHours()).toBe(14);
      expect(next.getMinutes()).toBe(0);
    });

    it('never returns the same minute it was given', () => {
      const cron = parseCron('30 13 * * *');
      const at = new Date(2026, 0, 1, 13, 30, 0);
      const next = cron.next(at);
      expect(next.getTime()).toBeGreaterThan(at.getTime());
      expect(next.getDate()).toBe(2); // next day
    });

    it('throws on an unreachable schedule rather than looping forever', () => {
      // Feb 30 never exists.
      expect(() => parseCron('0 0 30 2 *').next(new Date(2026, 0, 1))).toThrow(/no next fire/);
    });
  });
});
