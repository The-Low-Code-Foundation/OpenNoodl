/**
 * BEN-006 §2 — the data editor's rules about values.
 *
 * The panel is React and the panel is not what these check. What they check is
 * the three rules that decide whether the editor is trustworthy, each of which
 * is a rule about a value and therefore checkable without driving anything:
 *
 *  - the table and the JSON view edit the *same* records, or the escape hatch
 *    is a second dialect (the BCN-003 mistake, in miniature);
 *  - a number typed into a text cell does not silently become a string —
 *    a `price` of `"12"` is a whole class of "why does my component render
 *    nothing", which the bench exists to end rather than to introduce;
 *  - text that will not parse is kept, not discarded.
 */

import {
  cellText,
  draftFrom,
  editableRecords,
  parseCell,
  visibleFields,
  withJson,
  withRecords,
  withRowCount
} from '../../src/editor/src/views/documents/AuthoringPreviewDocument/sandboxDataDraft';
import { SANDBOX_RECORD_FLAG, type SandboxRecord } from '@noodl/runtime/src/sandbox/types';

function served(): SandboxRecord[] {
  return [
    { objectId: 'sandbox-1', id: 'sandbox-1', [SANDBOX_RECORD_FLAG]: true, name: 'Enamel mug', price: 12 },
    { objectId: 'sandbox-2', id: 'sandbox-2', [SANDBOX_RECORD_FLAG]: true, name: 'Cast iron pan', price: 48 }
  ] as SandboxRecord[];
}

describe('BEN-006 the draft the data editor holds', () => {
  it('prefills with what is being served, minus the sandbox’s own bookkeeping', () => {
    // The user edits what they are looking at — that is what makes the round
    // trip obvious. `objectId`/`id`/the sandbox flag are not theirs to edit:
    // `completeRecord` reassigns them whatever anyone types, and showing them
    // buries the two fields they actually came here for.
    const draft = draftFrom(served());

    expect(draft.records).toEqual([
      { name: 'Enamel mug', price: 12 },
      { name: 'Cast iron pan', price: 48 }
    ]);
    expect(JSON.parse(draft.json)).toEqual(draft.records);
    expect(draft.edited).toBe(false);
    expect(draft.error).toBe('');
  });

  it('keeps the table and the JSON view on one value', () => {
    // If these two ever drift, the escape hatch has become a second dialect.
    const draft = withRecords(draftFrom(served()), [{ name: 'Something else' }]);

    expect(JSON.parse(draft.json)).toEqual([{ name: 'Something else' }]);
    expect(draft.edited).toBe(true);

    const back = withJson(draft, '[{"name":"Typed as JSON"}]');
    expect(back.records).toEqual([{ name: 'Typed as JSON' }]);
    expect(back.error).toBe('');
  });

  it('keeps unparseable text instead of throwing it away', () => {
    // Discarding what someone typed because they are mid-keystroke is how an
    // editor teaches you not to type in it. The records stay where they were —
    // stale, deliberately — and `error` is what stops Apply.
    const draft = withJson(draftFrom(served()), '[{"name": "half typ');

    expect(draft.json).toBe('[{"name": "half typ');
    expect(draft.error).toBeTruthy();
    expect(draft.records).toEqual([
      { name: 'Enamel mug', price: 12 },
      { name: 'Cast iron pan', price: 48 }
    ]);
  });

  it('says what is wrong in terms of records, not of JSON grammar', () => {
    expect(withJson(draftFrom(served()), '{"name":"not a list"}').error).toContain('JSON array');
    expect(withJson(draftFrom(served()), '[{"a":1}, 7]').error).toContain('Row 2');
  });

  it('trims and pads to a row count, padding with blanks rather than copies', () => {
    // "What does this look like with one result" is the question that finds
    // every layout that quietly assumed three. A padded row is `{}` so
    // `completeRecord` synthesizes a *distinct* record for it — otherwise
    // twenty rows would be the same row twenty times.
    const one = withRowCount(draftFrom(served()), 1);
    expect(one.records).toEqual([{ name: 'Enamel mug', price: 12 }]);

    const four = withRowCount(draftFrom(served()), 4);
    expect(four.records.length).toBe(4);
    expect(four.records[2]).toEqual({});
    expect(four.records[3]).toEqual({});
  });

  it('can be emptied, which is a state and not a mistake', () => {
    const none = withRowCount(draftFrom(served()), 0);
    expect(none.records).toEqual([]);
    expect(JSON.parse(none.json)).toEqual([]);
  });

  it('keeps a number a number when it is typed into a text cell', () => {
    // A cell is text. Without this a `price` of 12 comes back as "12", the port
    // coerces or refuses it, and the component renders nothing for a reason
    // nobody can see. Typed against the previous value because a sandbox record
    // carries no declared types — that is the only evidence there is.
    expect(parseCell('48', 12)).toBe(48);
    expect(parseCell('0', 12)).toBe(0);
    expect(parseCell('true', false)).toBe(true);
    expect(parseCell('false', true)).toBe(false);
    expect(parseCell('Enamel mug', 'Something')).toBe('Enamel mug');
  });

  it('does not force a number when what was typed is not one', () => {
    // Better a string the user can see than a NaN they cannot. Phase-55 already
    // paid for a coerced value becoming "NaNpx" and the property being deleted.
    expect(parseCell('twelve', 12)).toBe('twelve');
    expect(parseCell('', 12)).toBe('');
    expect(parseCell('maybe', true)).toBe('maybe');
  });

  it('shows a value the way a cell can hold it', () => {
    expect(cellText(undefined)).toBe('');
    expect(cellText(null)).toBe('');
    expect(cellText(0)).toBe('0');
    expect(cellText(false)).toBe('false');
    expect(cellText({ nested: 1 })).toBe('{"nested":1}');
  });

  it('columns are what the graph reads, then whatever else the records carry', () => {
    // The field list is worth showing on its own: it is what the component will
    // actually look at, which nothing else in the editor tells you.
    expect(visibleFields(['name', 'price'], [{ name: 'a', extra: 1 }])).toEqual(['name', 'price', 'extra']);
    // …and never the bookkeeping, from either side.
    expect(visibleFields(['objectId', 'name'], [{ id: 'x', name: 'a' }])).toEqual(['name']);
  });

  it('strips the bookkeeping without mutating what the preview is serving', () => {
    const records = served();
    editableRecords(records);
    expect(records[0].objectId).toBe('sandbox-1');
  });
});
