/**
 * §3 of `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md` —
 * the `optionslist` port type, Richard's chosen direction of 2026-09-04.
 *
 * 🔴 **The defect this type exists to make unreachable**: as an `array`, `Dropdown.items` was a
 * JSON blob, and `Select.tsx` reads `i.Label` and `i.Value` on every entry — so a beginner who
 * typed the obvious `["Small", "Large"]` got `<option value="">` three times over and nothing
 * selectable. Correct JSON, silently useless. Every assertion below is about that gap closing.
 *
 * ⚠️ **The migration half is not optional.** The port shipped as `array`, whose stored form is a
 * *string* holding a literal. No project in this repo has one — measured at 0 across 148 files,
 * which is what the codec's own table already said about `array` — but a user's project may, and
 * a port type that could not read its own history would silently empty their Dropdown.
 */
import {
  decodeForEditor,
  decodeOptionsList,
  encodeFromEditor,
  encodeOptionsList,
  slugForOption,
  LIST_PORT_TYPES
} from '@noodl-core-ui/components/json-editor/utils/listValueCodec';

const ok = <T,>(r: { ok: boolean; value?: T; error?: string }): T => {
  if (!r.ok) throw new Error(`expected an encode to succeed, got: ${r.error}`);
  return r.value as T;
};

describe('optionslist §1 — it is one of the list-shaped types', () => {
  it('is registered, so the panel routing and the catalog gate both see it', () => {
    expect(LIST_PORT_TYPES).toContain('optionslist');
  });
});

describe('optionslist §2 — 🔴 typing a label is enough', () => {
  it('mints a Label and a Value from a bare string', () => {
    // The exact input a beginner writes, and the shape `Select.tsx` needs back.
    expect(ok(encodeOptionsList(['Small', 'Large']))).toEqual([
      { Label: 'Small', Value: 'small' },
      { Label: 'Large', Value: 'large' }
    ]);
  });

  it('never produces an empty Value, which is the defect itself', () => {
    for (const label of ['Small', '  Spaced  Out  ', '日本語', '!!!', '3']) {
      const [row] = ok(encodeOptionsList([label]));
      expect(row.Value).not.toBe('');
    }
  });

  it('falls back to the label when a slug would be empty', () => {
    // All-punctuation and non-Latin labels slug to nothing. A derived value is a convenience and
    // is never allowed to be worse than the label it came from.
    expect(slugForOption('日本語')).toBe('日本語');
    expect(slugForOption('!!!')).toBe('!!!');
  });

  it('slugs the ordinary way', () => {
    expect(slugForOption('Large')).toBe('large');
    expect(slugForOption('Extra Large')).toBe('extra-large');
    expect(slugForOption('  Mixed_Case Thing  ')).toBe('mixed-case-thing');
  });
});

describe('optionslist §3 — 🔴 the author can override the value', () => {
  it("honours an explicit Value — Richard's 'Large' → 'l' case", () => {
    expect(ok(encodeOptionsList([{ Label: 'Large', Value: 'l' }]))).toEqual([{ Label: 'Large', Value: 'l' }]);
  });

  it('accepts the lowercase spelling a person would guess', () => {
    expect(ok(encodeOptionsList([{ label: 'Large', value: 'l' }]))).toEqual([{ Label: 'Large', Value: 'l' }]);
  });

  it('🔴 refuses an explicitly duplicated value, and says why', () => {
    // Two options with the same value cannot be told apart by anything downstream. Renaming one
    // behind the author's back would be changing a statement they made.
    const r = encodeOptionsList([
      { Label: 'A', Value: 'x' },
      { Label: 'B', Value: 'x' }
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('"x"');
  });

  it('🔴 but DISAMBIGUATES a derived collision rather than refusing', () => {
    // "A B" and "A-B" both slug to `a-b`. That is an accident of the convenience, not a statement,
    // and refusing here would block an author from typing two perfectly ordinary labels.
    expect(ok(encodeOptionsList(['A B', 'A-B']))).toEqual([
      { Label: 'A B', Value: 'a-b' },
      { Label: 'A-B', Value: 'a-b-2' }
    ]);
  });

  it('refuses an empty label and an explicitly empty value', () => {
    expect(encodeOptionsList(['']).ok).toBe(false);
    expect(encodeOptionsList([{ Label: 'A', Value: '  ' }]).ok).toBe(false);
  });

  it('clears the parameter for an empty list, so the port falls back to its default', () => {
    expect(ok(encodeOptionsList([]))).toBeUndefined();
  });

  it('refuses something that is not a list at all, with an example', () => {
    const r = encodeOptionsList({ Label: 'A' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('[');
  });
});

describe('optionslist §4 — ⚠️ it reads the shape it used to be stored in', () => {
  it('🔴 reads the legacy `array` form: a STRING holding a literal', () => {
    expect(decodeOptionsList('[{"Label":"Small","Value":"s"}]')).toEqual([{ Label: 'Small', Value: 's' }]);
  });

  it('reads a JavaScript literal too, which is what the runtime eval accepted', () => {
    expect(decodeOptionsList("[{Label:'Small', Value:'s'}]")).toEqual([{ Label: 'Small', Value: 's' }]);
  });

  it('reads a real array, which is the new stored form', () => {
    expect(decodeOptionsList([{ Label: 'Small', Value: 's' }])).toEqual([{ Label: 'Small', Value: 's' }]);
  });

  it('reads bare strings, and gives each one a value', () => {
    expect(decodeOptionsList(['Small'])).toEqual([{ Label: 'Small', Value: 'small' }]);
  });

  it('reads an entry that has only a Value, rather than dropping it', () => {
    // A half-written row is still the author's data. Losing it silently is the one outcome that
    // must not happen.
    expect(decodeOptionsList([{ Value: 's' }])).toEqual([{ Label: 's', Value: 's' }]);
  });

  it('is empty for the empty values, and never throws on nonsense', () => {
    for (const empty of [undefined, null, '', 42, { a: 1 }]) {
      expect(decodeOptionsList(empty as never)).toEqual([]);
    }
  });
});

describe('optionslist §5 — 🔴 the editor shows the shortest form that round-trips', () => {
  it('shows a bare label when the value carries no extra information', () => {
    // This is what makes it a beginner mode: an author who has typed nothing special never meets
    // a two-field object.
    const decoded = decodeForEditor('optionslist', [
      { Label: 'Small', Value: 'small' },
      { Label: 'Large', Value: 'large' }
    ]);
    expect(JSON.parse(decoded.json)).toEqual(['Small', 'Large']);
    expect(decoded.expectedType).toBe('array');
  });

  it('🔴 expands to the object the moment a value is customised', () => {
    const decoded = decodeForEditor('optionslist', [
      { Label: 'Small', Value: 'small' },
      { Label: 'Large', Value: 'l' }
    ]);
    expect(JSON.parse(decoded.json)).toEqual(['Small', { Label: 'Large', Value: 'l' }]);
  });

  it('🔴 round-trips: what the editor shows encodes back to what was stored', () => {
    const stored = [
      { Label: 'Small', Value: 'small' },
      { Label: 'Large', Value: 'l' }
    ];
    const shown = decodeForEditor('optionslist', stored).json;
    expect(ok(encodeFromEditor('optionslist', shown, stored))).toEqual(stored);
  });

  it('flags a legacy string as recovered, so the author is told it will be rewritten', () => {
    const decoded = decodeForEditor('optionslist', '[{"Label":"Small","Value":"s"}]');
    expect(decoded.recovered).toBe(true);
    expect(decoded.unparseable).toBe(false);
  });

  it('🔴 hands back unreadable text verbatim rather than showing an empty list over it', () => {
    // Showing an empty visual tree over a value we failed to read is how an author's data gets
    // silently replaced — the rule the rest of this codec already follows.
    const decoded = decodeForEditor('optionslist', 'this is not a list');
    expect(decoded.unparseable).toBe(true);
    expect(decoded.json).toBe('this is not a list');
  });

  it('is an empty list, not an empty object, for an unset parameter', () => {
    expect(JSON.parse(decodeForEditor('optionslist', undefined).json)).toEqual([]);
  });
});
