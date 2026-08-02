/**
 * ERG-003 — the boundary between one JSON editor and four storage formats.
 *
 * The cases below are written from the *measurement* in `ERG-003-NOTES.md`, not
 * from the spec: every `stringlist` example here is a real value lifted out of a
 * repo `project.json`, and every `proplist` example is the real `{id,label}`
 * shape the runtime reads. If the storage format is ever changed, these fail
 * first and say which of the twenty-nine runtime consumers is about to break.
 */

import {
  decodeForEditor,
  decodePropList,
  decodeStringList,
  encodeFromEditor,
  encodePropList,
  encodeStringList,
  expectedTypeFor
} from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

describe('expectedTypeFor', () => {
  it('sends only `object` ports to the object validator', () => {
    expect(expectedTypeFor('object')).toBe('object');
    expect(expectedTypeFor('array')).toBe('array');
    expect(expectedTypeFor('stringlist')).toBe('array');
    expect(expectedTypeFor('proplist')).toBe('array');
  });
});

describe('stringlist — decode (measured: 423 stored values, 100% string)', () => {
  it('reads a real multi-entry value from library/prefabs/filters', () => {
    expect(decodeStringList('FilterItems,Filter,FilterValues')).toEqual(['FilterItems', 'Filter', 'FilterValues']);
  });

  it('reads a real single-entry value (121 of the 423 had no comma)', () => {
    expect(decodeStringList('Value')).toEqual(['Value']);
  });

  it('treats empty, null and undefined as an empty list', () => {
    expect(decodeStringList('')).toEqual([]);
    expect(decodeStringList(null)).toEqual([]);
    expect(decodeStringList(undefined)).toEqual([]);
  });

  it('drops the empty entry a trailing comma produces', () => {
    // page-inputs.ts guards this at runtime; the editor should not create it.
    expect(decodeStringList('Value,')).toEqual(['Value']);
  });

  it('still tolerates the array-of-{label} shape normalizeList always accepted', () => {
    expect(decodeStringList([{ label: 'From' }, { label: 'To' }])).toEqual(['From', 'To']);
  });
});

describe('stringlist — encode', () => {
  it('round-trips a measured value unchanged', () => {
    const stored = 'Value,Label,Text,Property,Test';
    const back = encodeFromEditor('stringlist', JSON.stringify(decodeStringList(stored)));
    expect(back).toEqual({ ok: true, value: stored });
  });

  it('stores an empty list as undefined so the port reads as default', () => {
    expect(encodeStringList([])).toEqual({ ok: true, value: undefined });
  });

  it('REFUSES an entry containing a comma instead of silently splitting it', () => {
    // The defect this closes: `performAdd('a,b')` pushed one entry, joined to
    // "a,b", and read back as two. Nothing ever told the author.
    const result = encodeStringList(['a,b']);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/comma/i);
  });

  it('refuses duplicates, matching the rule the add popup already enforced', () => {
    const result = encodeStringList(['Value', 'Value']);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/more than once/i);
  });

  it('refuses an empty or whitespace-only entry', () => {
    expect(encodeStringList(['']).ok).toBe(false);
    expect(encodeStringList(['   ']).ok).toBe(false);
  });

  it('refuses a nested list or object, which the comma format cannot carry', () => {
    expect(encodeStringList([['a']]).ok).toBe(false);
    expect(encodeStringList([{ label: 'a' }]).ok).toBe(false);
  });

  it('trims whitespace around entries', () => {
    expect(encodeStringList([' From ', 'To'])).toEqual({ ok: true, value: 'From,To' });
  });

  it('refuses invalid JSON without writing anything', () => {
    const result = encodeFromEditor('stringlist', '["a", ');
    expect(result.ok).toBe(false);
  });
});

describe('proplist — decode (measured: 55 stored values, all Array<{id,label}>)', () => {
  it('reads a real scriptInputs value from library/prefabs/filters', () => {
    expect(decodePropList([{ id: 'rzc4', label: 'Filters' }])).toEqual([{ id: 'rzc4', label: 'Filters' }]);
  });

  it('reads the empty array 8 of the 55 values held', () => {
    expect(decodePropList([])).toEqual([]);
  });

  it('treats a missing value as empty', () => {
    expect(decodePropList(undefined)).toEqual([]);
  });
});

describe('proplist — encode', () => {
  const previous = [
    { id: 'melj', label: 'Options' },
    { id: 'pdiv', label: 'Selection' },
    { id: 'l9z7', label: 'Labels' }
  ];

  it('round-trips a measured value with every id intact', () => {
    const decoded = decodePropList(previous);
    expect(encodeFromEditor('proplist', JSON.stringify(decoded), previous)).toEqual({ ok: true, value: previous });
  });

  it('keeps ids stable across a pure reorder, so child ports stay attached', () => {
    // `parentItemId` is how the runtime hangs each row's "Type" dropdown off it
    // (simplejavascript.ts, javascript.ts). Re-minting on reorder would orphan them.
    const reordered = [
      { id: 'l9z7', label: 'Labels' },
      { id: 'melj', label: 'Options' },
      { id: 'pdiv', label: 'Selection' }
    ];
    const result = encodePropList(reordered, previous);
    expect(result).toEqual({ ok: true, value: reordered });
  });

  it('recovers the id by label when the author deleted it from the JSON', () => {
    const result = encodePropList([{ label: 'Selection' }, { label: 'Options' }], previous);
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.value).toEqual([
      { id: 'pdiv', label: 'Selection' },
      { id: 'melj', label: 'Options' }
    ]);
  });

  it('mints an id for a genuinely new label, and never reuses one', () => {
    const result = encodePropList([{ label: 'Options' }, { label: 'Brand New' }], previous);
    expect(result.ok).toBe(true);
    const value = result.ok === true ? result.value! : [];
    expect(value[0]).toEqual({ id: 'melj', label: 'Options' });
    expect(value[1].label).toBe('Brand New');
    expect(value[1].id).toMatch(/^[0-9a-z]{4}$/);
    expect(['melj', 'pdiv', 'l9z7']).not.toContain(value[1].id);
  });

  it('never lets two rows share an id', () => {
    const result = encodePropList([{ id: 'melj', label: 'A' }, { id: 'melj', label: 'B' }], previous);
    expect(result.ok).toBe(true);
    const value = result.ok === true ? result.value! : [];
    expect(value[0].id).not.toBe(value[1].id);
  });

  it('accepts a plain name as shorthand for { label }', () => {
    const result = encodePropList(['Options'], previous);
    expect(result).toEqual({ ok: true, value: [{ id: 'melj', label: 'Options' }] });
  });

  it('refuses a duplicate label — it would name two ports the same', () => {
    expect(encodePropList([{ label: 'A' }, { label: 'A' }], previous).ok).toBe(false);
  });

  it('refuses an entry with no label', () => {
    expect(encodePropList([{ id: 'x1x1' }], previous).ok).toBe(false);
  });

  it('stores an empty list as undefined', () => {
    expect(encodePropList([], previous)).toEqual({ ok: true, value: undefined });
  });
});

/**
 * An incoming id is a hint, not an authority.
 *
 * The rule matters because the two classes of `proplist` consumer disagree about
 * what an id is for. `Function`/`Script`/`REST` key each row's child ports by
 * *label* (`intype-<label>`), so the id only groups rows in the property panel
 * and a foreign one is harmless. `Navigation Stack` keys them by *id*
 * (`pageComp-<id>`, `pagePath-<id>`), as does `Create`/`Update Record`
 * (`acl-<id>-role`, `acl-<id>-userid`, …) — and `acl-<id>-userid` is
 * `allowConnectionsOnly`, so it is a live connection endpoint.
 *
 * For that second class, honouring a pasted id renames the row's identity out
 * from under parameters that are still stored against the old one. The page
 * keeps its label and loses the component it renders. Nothing reports it.
 */
describe('proplist — a pasted id never repoints an existing entry', () => {
  // A Navigation Stack whose two pages each have a `pageComp-<id>` parameter
  // holding the component they render.
  const navStackPages = [
    { id: 'zz99', label: 'Home' },
    { id: 'yy88', label: 'Settings' }
  ];

  it('ignores ids copied from another node and re-attaches by label', () => {
    // The reported case: copy the JSON out of one Navigation Stack, paste it
    // into another with the same page names. Before this rule, `pageComp-zz99`
    // was orphaned and Home rendered nothing.
    const pastedFromAnotherNode = [
      { id: 'ab12', label: 'Home' },
      { id: 'cd34', label: 'Settings' }
    ];
    expect(encodePropList(pastedFromAnotherNode, navStackPages)).toEqual({ ok: true, value: navStackPages });
  });

  it('mints for a pasted entry whose label is new here, rather than trusting its id', () => {
    const result = encodePropList([{ id: 'ab12', label: 'Home' }, { id: 'cd34', label: 'Checkout' }], navStackPages);
    expect(result.ok).toBe(true);
    const value = result.ok === true ? result.value! : [];
    expect(value[0]).toEqual({ id: 'zz99', label: 'Home' });
    expect(value[1].label).toBe('Checkout');
    expect(value[1].id).not.toBe('cd34');
    expect(value[1].id).toMatch(/^[0-9a-z]{4}$/);
  });

  it('still honours an id this port already owns — reorder keeps child ports attached', () => {
    // Regression guard for the behaviour the rule must not cost: every id here
    // IS ours, so all are accepted and no port is orphaned.
    const reordered = [
      { id: 'yy88', label: 'Settings' },
      { id: 'zz99', label: 'Home' }
    ];
    expect(encodePropList(reordered, navStackPages)).toEqual({ ok: true, value: reordered });
  });

  it('still honours an owned id across a rename, so child ports follow the new label', () => {
    const renamed = [
      { id: 'zz99', label: 'Homepage' },
      { id: 'yy88', label: 'Settings' }
    ];
    expect(encodePropList(renamed, navStackPages)).toEqual({ ok: true, value: renamed });
  });

  it('mints for a hand-invented id on a brand new list', () => {
    const result = encodePropList([{ id: 'ab12', label: 'One' }], undefined);
    expect(result.ok).toBe(true);
    const value = result.ok === true ? result.value! : [];
    expect(value[0].label).toBe('One');
    expect(value[0].id).not.toBe('ab12');
  });

  it('does not let an id minted during this pass validate a later foreign id', () => {
    // `taken` grows as ids are minted; `priorIds` must not. Otherwise a foreign
    // id could be accepted merely because an earlier row happened to mint it.
    const result = encodePropList([{ id: 'ab12', label: 'New A' }, { id: 'ab12', label: 'New B' }], navStackPages);
    expect(result.ok).toBe(true);
    const value = result.ok === true ? result.value! : [];
    expect(value[0].id).not.toBe('ab12');
    expect(value[1].id).not.toBe('ab12');
    expect(value[0].id).not.toBe(value[1].id);
  });
});

describe('array / object — decode (measured: 0 stored values; behaviour taken from the code path)', () => {
  it('gives an empty port the right empty literal', () => {
    expect(decodeForEditor('array', undefined).json).toBe('[]');
    expect(decodeForEditor('object', undefined).json).toBe('{}');
    expect(decodeForEditor('array', '').json).toBe('[]');
  });

  it('canonicalises stored JSON', () => {
    const result = decodeForEditor('array', '[1,2,3]');
    expect(JSON.parse(result.json)).toEqual([1, 2, 3]);
    expect(result.recovered).toBe(false);
    expect(result.unparseable).toBe(false);
  });

  it('RECOVERS a JavaScript object literal, which is what the runtime evals', () => {
    // `Ports.ts` deliberately does not JSON-validate these ports so that
    // `{ Authorization: 'Bearer x' }` stays legal. An editor that called this
    // invalid would show an empty tree over a value that works.
    const result = decodeForEditor('object', "{ Authorization: 'Bearer x' }");
    expect(result.unparseable).toBe(false);
    expect(result.recovered).toBe(true);
    expect(JSON.parse(result.json)).toEqual({ Authorization: 'Bearer x' });
  });

  it('recovers a trailing-comma array literal', () => {
    const result = decodeForEditor('array', '[1, 2, 3,]');
    expect(result.recovered).toBe(true);
    expect(JSON.parse(result.json)).toEqual([1, 2, 3]);
  });

  it('accepts a real array/object, which setInputValue also passes straight through', () => {
    expect(JSON.parse(decodeForEditor('array', [1, 2]).json)).toEqual([1, 2]);
    expect(JSON.parse(decodeForEditor('object', { a: 1 }).json)).toEqual({ a: 1 });
  });

  it('flags genuinely unreadable text and hands it back VERBATIM', () => {
    // The "never silently corrupt" rule: we must not replace what we cannot read.
    const raw = 'this is not a literal at all {{{';
    const result = decodeForEditor('array', raw);
    expect(result.unparseable).toBe(true);
    expect(result.json).toBe(raw);
  });

  it('does not evaluate a function literal into the value', () => {
    expect(decodeForEditor('object', '() => 1').unparseable).toBe(true);
  });
});

describe('array / object — encode', () => {
  it('stores canonical JSON text, matching what CodeEditorType wrote', () => {
    const result = encodeFromEditor('array', '[1,2,3]');
    expect(result.ok).toBe(true);
    expect(result.ok === true && JSON.parse(result.value as string)).toEqual([1, 2, 3]);
  });

  it('stores an empty array/object as undefined so the port reads as default', () => {
    expect(encodeFromEditor('array', '[]')).toEqual({ ok: true, value: undefined });
    expect(encodeFromEditor('object', '{}')).toEqual({ ok: true, value: undefined });
  });

  it('refuses an object at an array port and says how to fix it', () => {
    const result = encodeFromEditor('array', '{"a":1}');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/\[ \]/);
  });

  it('refuses an array at an object port', () => {
    expect(encodeFromEditor('object', '[1]').ok).toBe(false);
  });

  it('refuses invalid JSON rather than writing a broken value', () => {
    expect(encodeFromEditor('array', '[1, 2').ok).toBe(false);
  });

  it('round-trips a recovered JS literal into valid JSON', () => {
    const decoded = decodeForEditor('object', "{ Authorization: 'Bearer x' }");
    const result = encodeFromEditor('object', decoded.json);
    expect(result.ok).toBe(true);
    expect(JSON.parse(result.ok === true ? (result.value as string) : '{}')).toEqual({ Authorization: 'Bearer x' });
  });
});
