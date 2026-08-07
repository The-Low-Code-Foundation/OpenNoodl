/**
 * CSV, in one place (CWF-012).
 *
 * Two halves:
 *
 *  1. The **module** (`src/csv.ts`) — the tokeniser lifted out of `Static Array`, with the edge
 *     cases the task enumerated: quoted cells, embedded delimiters, embedded newlines, escaped
 *     quotes, CRLF, a trailing newline, an empty file, a header-only file, and a BOM.
 *  2. The **nodes** — `Parse CSV` and `To CSV`, registered in the shared runtime, driven through
 *     the same harness the date family uses. The cloud half is driven end to end in
 *     `nodegx-backend/tests/cloud-csv-nodes.test.ts`.
 *
 * ⚠️ `Static Array` is asserted here too, on the same fixtures, because the whole point of slice 1
 * is that there is now ONE parser. A test that only covers the new nodes would let the old node
 * drift the moment somebody "fixes" the shared module for the new ones.
 */

import { parseCSV, parseCSVRows, rowsToCSV, rowsToRecords, stripBOM, toCSV, unionOfKeys } from '../../src/csv';

import { createNode } from '../helpers/node-harness';

import ParseCSVModule = require('../../src/nodes/std-library/data/parsecsv');
import ToCSVModule = require('../../src/nodes/std-library/data/tocsv');
import StaticDataModule = require('../../src/nodes/std-library/data/staticdata');

describe('the CSV module (CWF-012 slice 1)', () => {
  it('reads plain rows', () => {
    expect(parseCSVRows('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
  });

  it('reads a quoted cell containing the delimiter', () => {
    expect(parseCSVRows('name,note\nann,"blue, then red"')).toEqual([
      ['name', 'note'],
      ['ann', 'blue, then red']
    ]);
  });

  it('reads a quoted cell containing a newline', () => {
    expect(parseCSVRows('name,note\nann,"line one\nline two"')).toEqual([
      ['name', 'note'],
      ['ann', 'line one\nline two']
    ]);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCSVRows('note\n"she said ""hi"""')).toEqual([['note'], ['she said "hi"']]);
  });

  it('reads CRLF line endings', () => {
    expect(parseCSVRows('a,b\r\n1,2\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4']
    ]);
  });

  it('keeps the trailing row a trailing newline produces — Static Array has always done this', () => {
    expect(parseCSVRows('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2'], ['']]);
  });

  it('reads an empty file as one empty cell, and a header-only file as its header', () => {
    expect(parseCSVRows('')).toEqual([['']]);
    expect(parseCSVRows('a,b')).toEqual([['a', 'b']]);
    expect(rowsToRecords(parseCSVRows('a,b'))).toEqual([]);
  });

  it('honours a non-comma delimiter', () => {
    expect(parseCSVRows('a;b\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
    expect(parseCSVRows('a\tb\n1\t2', '\t')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
  });

  it('strips the BOM Excel writes, so the FIRST column keeps its name', () => {
    // ⚠️ This is the failure that reads as "my first column is missing": the BOM lands on the
    // header cell, so the property is named "﻿name" and every lookup for `name` misses.
    const withBom = '﻿name,team\nann,blue';
    expect(stripBOM(withBom).charCodeAt(0)).not.toBe(0xfeff);
    expect(rowsToRecords(parseCSVRows(withBom))).toEqual([{ name: 'ann', team: 'blue' }]);
  });

  it('reads an empty quoted cell as an empty string, not undefined', () => {
    // The one behaviour deliberately CHANGED from the original: `if (arrMatches[2])` was a
    // truthiness test, so `""` fell through to the unquoted branch whose group had not
    // participated, and the cell came out `undefined` — in a parser whose documented contract is
    // "every cell is a string".
    expect(parseCSVRows('a,b\n"",x')).toEqual([
      ['a', 'b'],
      ['', 'x']
    ]);
  });

  it('reads every cell as a string, including columns that look numeric', () => {
    const records = rowsToRecords(parseCSVRows('id,qty\n7,42'));
    expect(records).toEqual([{ id: '7', qty: '42' }]);
    expect(typeof records[0].qty).toBe('string');
  });

  describe('a malformed CSV', () => {
    it('is reported with the line the quote could not be paired on', () => {
      const result = parseCSV('a,b\n1,2\n3,"unterminated\n5,6');
      expect(result.error).toBeDefined();
      expect(result.error?.line).toBe(3);
      expect(result.error?.message).toContain('line 3');
      expect(result.error?.message).toContain('never closed');
    });

    it('is text vanishing out of the MIDDLE of the file, not truncation — which is why the check is contiguity', () => {
      // ⚠️ The obvious check ("did the scanner reach the end of the input") passes on this file.
      // `exec` with the `g` flag scans forward past text it cannot match, so the row count and
      // the tail are both intact and the word `unterminated` is simply gone. The tolerant entry
      // point answers with that, silently — which is the shape `Static Array` needs and the shape
      // a runtime node must never have.
      const rows = parseCSVRows('a,b\n1,2\n3,"unterminated\n5,6');
      expect(rows.length).toBe(4);
      expect(rows[2]).toEqual(['3', '']);
    });

    it('reports an unterminated quote at the very end of the file too', () => {
      const result = parseCSV('a,b\n1,"never closed');
      expect(result.error?.line).toBe(2);
    });

    it('a well-formed file reports no error', () => {
      expect(parseCSV('a,b\n"1,x",2\n').error).toBeUndefined();
      expect(parseCSV('a,b\r\n"one\ntwo",2\r\n').error).toBeUndefined();
      expect(parseCSV('').error).toBeUndefined();
      expect(parseCSV('a;"x;y"\n1;2', ';').error).toBeUndefined();
    });
  });

  describe('writing', () => {
    it('quotes a cell containing the delimiter, a quote or a newline, and doubles the quotes', () => {
      const text = toCSV([{ a: 'x,y', b: 'she said "hi"', c: 'one\ntwo' }]);
      expect(text).toBe('a,b,c\n"x,y","she said ""hi""","one\ntwo"');
    });

    it('defaults the columns to the union of keys, in first-seen order', () => {
      expect(unionOfKeys([{ b: 1 }, { a: 2, b: 3 }, { c: 4 }])).toEqual(['b', 'a', 'c']);
      expect(toCSV([{ b: '1' }, { a: '2' }])).toBe('b,a\n1,\n,2');
    });

    it('honours an explicit column list, a delimiter, and a header switch', () => {
      const records = [{ name: 'ann', team: 'blue', extra: 'x' }];
      expect(toCSV(records, { columns: ['team', 'name'] })).toBe('team,name\nblue,ann');
      expect(toCSV(records, { columns: ['name'], includeHeader: false })).toBe('ann');
      expect(toCSV(records, { columns: ['name', 'team'], delimiter: ';' })).toBe('name;team\nann;blue');
    });

    it('quotes against the delimiter in USE, not against a comma', () => {
      expect(toCSV([{ a: 'x;y' }], { delimiter: ';' })).toBe('a\n"x;y"');
      expect(toCSV([{ a: 'x;y' }], { delimiter: ',' })).toBe('a\nx;y');
    });

    it('writes rows of cells without inventing a header', () => {
      expect(
        rowsToCSV([
          ['a', 'b'],
          ['1', '2']
        ])
      ).toBe('a,b\n1,2');
    });
  });

  it('ROUND TRIPS a file carrying all three hazards at once', () => {
    const original = [
      { name: 'ann', note: 'blue, then red' },
      { name: 'bob', note: 'she said "hi"' },
      { name: 'cass', note: 'line one\nline two' },
      { name: 'dee', note: 'all three: a, a "quote" and a\nnewline' }
    ];
    const text = toCSV(original);
    const back = rowsToRecords(parseCSV(text).rows);
    expect(back).toEqual(original);
    // ...and a second lap changes nothing, which is what makes the quoting rule stable rather
    // than merely reversible once.
    expect(toCSV(back)).toBe(text);
  });
});

describe('Static Array still parses what it parsed before (CWF-012 slice 1)', () => {
  const parse = (csv: string) => {
    const node = createNode(StaticDataModule, 'Static Data');
    node.node.setInputValue('csv', csv);
    node.context.updateDirtyNodes();
    return node.out('items') as unknown as { items: unknown[] };
  };

  it('reads a CSV into records with the header naming the properties', () => {
    const items = parse('name,team\nann,blue\nbob,red');
    expect(items.items.map((m) => (m as { data: unknown }).data)).toEqual([
      { name: 'ann', team: 'blue' },
      { name: 'bob', team: 'red' }
    ]);
  });

  it('still handles quoted cells with embedded delimiters', () => {
    const items = parse('name,note\nann,"blue, then red"');
    expect((items.items[0] as { data: unknown }).data).toEqual({ name: 'ann', note: 'blue, then red' });
  });
});

describe('Parse CSV (CWF-012 slice 2)', () => {
  const parse = (csv: string, params: Record<string, unknown> = {}) => {
    const node = createNode(ParseCSVModule, 'net.noodl.ParseCSV');
    for (const [key, value] of Object.entries(params)) node.node.setInputValue(key, value);
    node.node.setInputValue('text', csv);
    node.context.updateDirtyNodes();
    return node;
  };

  const dataOf = (items: unknown) => (items as { items: unknown[] }).items.map((m) => (m as { data: unknown }).data);

  it('parses into records with Has Header defaulting to ticked, no default setter having run', () => {
    // ⚠️ A declared `default` never runs its setter, so a graph that never touches Has Header
    // gets whatever `initialize` set. If that line is ever deleted the node silently switches to
    // rows-of-cells, and this is the test that says so.
    const node = parse('name,team\nann,blue\nbob,red');
    expect(dataOf(node.out('items'))).toEqual([
      { name: 'ann', team: 'blue' },
      { name: 'bob', team: 'red' }
    ]);
    expect(node.out('count')).toBe(2);
    expect(node.signals).toContain('changed');
  });

  it('answers rows of cells when Has Header is unticked', () => {
    const node = parse('a,b\n1,2', { hasHeader: false });
    expect(node.out('items')).toEqual([
      ['a', 'b'],
      ['1', '2']
    ]);
    expect(node.out('count')).toBe(2);
  });

  it('honours a delimiter, and an EMPTY delimiter falls back to a comma rather than breaking', () => {
    expect(dataOf(parse('a;b\n1;2', { delimiter: ';' }).out('items'))).toEqual([{ a: '1', b: '2' }]);
    // The `length || 32` shape, in this node's clothes: a port cleared in the panel arrives as
    // '' and `'' || ','` is the only thing between that and a regex built on an empty string.
    expect(dataOf(parse('a,b\n1,2', { delimiter: '' }).out('items'))).toEqual([{ a: '1', b: '2' }]);
  });

  it('fails LOUDLY on a malformed CSV, naming the line, and leaves Items as it was', () => {
    const node = createNode(ParseCSVModule, 'net.noodl.ParseCSV');
    node.node.setInputValue('text', 'name,team\nann,blue');
    node.context.updateDirtyNodes();
    const before = node.out('items');

    const raised: { code: string; message: string }[] = [];
    node.node.raiseRuntimeError = ((code: string, message: string) => raised.push({ code, message })) as never;

    node.node.setInputValue('text', 'name,team\nann,blue\nbob,"never closed\ncass,red');
    node.context.updateDirtyNodes();

    expect(node.signals).toContain('failure');
    expect(String(node.out('error'))).toContain('line 3');
    expect(raised[0].code).toBe('parse-csv/parse-failed');
    // Not replaced with a truncated array — the Static Array shape.
    expect(node.out('items')).toBe(before);
  });

  it('says nothing at all until a CSV arrives', () => {
    const node = createNode(ParseCSVModule, 'net.noodl.ParseCSV');
    node.node.setInputValue('delimiter', ';');
    node.context.updateDirtyNodes();
    expect(node.signals).toEqual([]);
    expect(node.out('items')).toBeUndefined();
  });

  it('strips a BOM, so the first column is not silently renamed', () => {
    expect(dataOf(parse('﻿name,team\nann,blue').out('items'))).toEqual([{ name: 'ann', team: 'blue' }]);
  });
});

describe('To CSV (CWF-012 slice 3)', () => {
  const render = (items: unknown, params: Record<string, unknown> = {}) => {
    const node = createNode(ToCSVModule, 'net.noodl.ToCSV');
    for (const [key, value] of Object.entries(params)) node.node.setInputValue(key, value);
    node.node.setInputValue('items', items);
    node.context.updateDirtyNodes();
    return node;
  };

  it('writes plain objects with the union of their keys as the header', () => {
    const node = render([
      { name: 'ann', team: 'blue' },
      { name: 'bob', team: 'red' }
    ]);
    expect(node.out('text')).toBe('name,team\nann,blue\nbob,red');
    expect(node.out('count')).toBe(2);
    expect(node.signals).toContain('changed');
  });

  it('reads records the array family produced, and does not invent an id column', () => {
    const parsed = createNode(ParseCSVModule, 'net.noodl.ParseCSV');
    parsed.node.setInputValue('text', 'name,team\nann,blue');
    parsed.context.updateDirtyNodes();

    const node = render(parsed.out('items'));
    // `id` is minted per record by the runtime and is not a column the author put there.
    expect(node.out('text')).toBe('name,team\nann,blue');
  });

  it('honours an explicit Columns list, comma separated in ONE string', () => {
    // ⚠️ A `stringlist` port carries one comma-separated string, never an array (phase 30).
    const node = render([{ name: 'ann', team: 'blue', extra: 'x' }], { columns: 'team, name' });
    expect(node.out('text')).toBe('team,name\nblue,ann');
  });

  it('can leave the header off, and an empty delimiter falls back to a comma', () => {
    expect(render([{ a: '1' }], { includeHeader: false }).out('text')).toBe('1');
    expect(render([{ a: '1', b: '2' }], { delimiter: '' }).out('text')).toBe('a,b\n1,2');
  });

  it('writes rows of cells straight through rather than naming the columns 0,1,2', () => {
    const node = render([
      ['a', 'b'],
      ['1', '2']
    ]);
    expect(node.out('text')).toBe('a,b\n1,2');
  });

  it('says nothing at all until an array arrives', () => {
    const node = createNode(ToCSVModule, 'net.noodl.ToCSV');
    node.node.setInputValue('delimiter', ';');
    node.context.updateDirtyNodes();
    expect(node.signals).toEqual([]);
  });

  it('ROUND TRIPS through Parse CSV on a file with delimiters, quotes and newlines in cells', () => {
    const original = [
      { name: 'ann', note: 'blue, then red' },
      { name: 'bob', note: 'she said "hi"' },
      { name: 'cass', note: 'one\ntwo' }
    ];
    const written = render(original).out('text') as string;

    const back = createNode(ParseCSVModule, 'net.noodl.ParseCSV');
    back.node.setInputValue('text', written);
    back.context.updateDirtyNodes();

    expect((back.out('items') as { items: unknown[] }).items.map((m) => (m as { data: unknown }).data)).toEqual(
      original
    );
  });
});
