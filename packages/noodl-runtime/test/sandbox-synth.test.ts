/**
 * AIX-008 — value synthesis. The contract is: shaped like the thing it is,
 * different between records, identical between runs, and never overriding what
 * the authoring model supplied.
 */

import { completeRecord, humanizeField, sandboxUser, synthesizeRecords, synthesizeValue } from '../src/sandbox/synth';

describe('AIX-008 value synthesis', () => {
  it('shapes values by what the field name says it is', () => {
    expect(String(synthesizeValue('email', 0))).toContain('@example.com');
    expect(String(synthesizeValue('coverImageUrl', 0)).startsWith('data:image/svg+xml')).toBe(true);
    expect(typeof synthesizeValue('price', 0)).toBe('number');
    expect(typeof synthesizeValue('isPublished', 0)).toBe('boolean');
    expect(String(synthesizeValue('createdAt', 0))).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(String(synthesizeValue('websiteUrl', 0)).startsWith('https://')).toBe(true);
  });

  it('does not read "last" as a surname outside a name', () => {
    expect(String(synthesizeValue('lastName', 0))).not.toContain('Last name');
    expect(String(synthesizeValue('lastLogin', 0))).toContain('Last login');
  });

  it('is deterministic, so a preview does not shuffle on every render', () => {
    expect(synthesizeValue('title', 3)).toBe(synthesizeValue('title', 3));
    expect(synthesizeRecords(['title'], 3)).toEqual(synthesizeRecords(['title'], 3));
  });

  it('gives each record a different value for the same field', () => {
    const records = synthesizeRecords(['title'], 3);
    expect(new Set(records.map((r) => r.title)).size).toBe(3);
  });

  it('falls back to the field name when nothing is recognised', () => {
    expect(synthesizeValue('sprocketWidgetiness', 0)).toBe('Sprocket widgetiness 1');
    expect(humanizeField('first_name')).toBe('First name');
  });

  it('never overrides an agent-supplied value, and fills what it left out', () => {
    const record = completeRecord({ title: 'The Left Hand of Darkness' }, ['title', 'author'], 0);
    expect(record.title).toBe('The Left Hand of Darkness');
    expect(typeof record.author).toBe('string');
    expect(record.objectId).toBe('sandbox-1');
    expect(record.id).toBe(record.objectId);
  });

  it('produces a user that is obviously not a real account', () => {
    const user = sandboxUser();
    expect(user.email).toContain('@example.com');
    expect(user.sessionToken).toBeTruthy();
  });
});
