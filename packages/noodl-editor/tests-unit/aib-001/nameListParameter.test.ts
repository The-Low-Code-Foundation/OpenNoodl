/**
 * AIB-001 criterion 4 — the six `.split(',')` sites survive a bad value.
 *
 * Slices 1 and 2 stop the value being written. This is the guard for everything
 * the gate cannot see: a hand-edited `project.json`, a legacy import, an MCP
 * write from a client that skipped the gate, and every project file that
 * predates the rule.
 *
 * The distinction that makes it worth having: all six sites run inside model
 * event listeners or a build, so a `TypeError` there does not produce a bad
 * port list — it aborts whatever was dispatching. In the case this task is
 * named for, that was the apply transaction, and one array-valued parameter
 * discarded 44 authored nodes.
 *
 * `parseNameList` is the whole decision, so it is the whole test. The warnings
 * wiring around it (`readNameList`) is four lines and reaches `WarningsModel`,
 * which is why it is a separate module and belongs to the editor suite.
 */

import { parseNameList } from '../../src/editor/src/models/NodeTypeAdapters/nameListParameter';

describe('reading a stringlist parameter', () => {
  it('splits the documented wire format, unchanged and unremarked', () => {
    expect(parseNameList('id,slug', 'pathParams')).toEqual({ names: ['id', 'slug'] });
  });

  it('preserves the exact splitting behaviour the six sites already had', () => {
    // Names with spaces are legitimate and appear in the shipped prefabs
    // ("Formatted Date"), so this must not start trimming. A guard that also
    // tidies is a behaviour change wearing a bug fix's clothes.
    expect(parseNameList('Date,Formatted Date', 'properties').names).toEqual(['Date', 'Formatted Date']);
    expect(parseNameList('', 'properties').names).toEqual(['']);
  });

  it('treats an absent parameter as no names, silently', () => {
    for (const absent of [undefined, null]) {
      expect(parseNameList(absent, 'pathParams')).toEqual({ names: [] });
    }
  });

  it('does not throw on the array that used to roll back a whole plan', () => {
    // The literal reproduction: `["id","slug"]` reaching what was
    // `node.parameters['pathParams'].split(',')`.
    expect(() => parseNameList(['id', 'slug'], 'pathParams')).not.toThrow();
  });

  it('still produces the right ports from an array, and says the file is off-format', () => {
    // Used *and* reported: the author gets working ports and is told what to
    // fix, rather than a working editor hiding a file that breaks elsewhere.
    const read = parseNameList(['id', 'slug'], 'pathParams');
    expect(read.names).toEqual(['id', 'slug']);
    expect(read.problem).toContain('pathParams');
    expect(read.problem).toContain('comma-separated string');
    expect(read.problem).toContain('"id,slug"');
  });

  it('refuses to guess at a shape that is not the same list written differently', () => {
    for (const value of [{ id: true }, 42, [{ name: 'id' }], ['id', 7]]) {
      const read = parseNameList(value, 'pathParams');
      expect(read.names).toEqual([]);
      expect(read.problem).toContain('no parameter ports could be generated');
    }
  });
});
