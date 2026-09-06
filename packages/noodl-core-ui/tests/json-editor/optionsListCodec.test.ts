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
  derivedValueForOption,
  optionsListJsonForMode,
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
      { Label: 'Small', Value: 'Small' },
      { Label: 'Large', Value: 'Large' }
    ]);
  });

  it('never produces an empty Value, which is the defect itself', () => {
    for (const label of ['Small', '  Spaced  Out  ', '日本語', '!!!', '3']) {
      const [row] = ok(encodeOptionsList([label]));
      expect(row.Value).not.toBe('');
    }
  });

  /**
   * 🔴 Richard, 2026-09-06: *"The 'value' set if you only use the easy JSON editor mode must be
   * exactly the same as the label, so the simple mode users won't get confused."* This replaces
   * the slug (`Extra Large` → `extra-large`), which invented a second string per option that the
   * author never typed and — with values hidden in Easy mode — could not see.
   */
  it('🔴 derives the value as the label VERBATIM, not as a slug', () => {
    expect(derivedValueForOption('Extra Large')).toBe('Extra Large');
    expect(ok(encodeOptionsList(['Extra Large']))).toEqual([{ Label: 'Extra Large', Value: 'Extra Large' }]);
  });

  it('trims, so a stray space cannot make two values differ invisibly', () => {
    expect(derivedValueForOption('  Mixed Case  ')).toBe('Mixed Case');
    expect(ok(encodeOptionsList(['  Mixed Case  ']))).toEqual([{ Label: '  Mixed Case  ', Value: 'Mixed Case' }]);
  });

  it('keeps non-Latin and punctuation labels intact, where a slug erased them', () => {
    expect(derivedValueForOption('日本語')).toBe('日本語');
    expect(derivedValueForOption('!!!')).toBe('!!!');
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

  it('no longer collides on labels that merely slugged the same', () => {
    // "A B" and "A-B" used to both slug to `a-b`, and the second was silently renamed. With the
    // value mirroring the label there is nothing to collide.
    expect(ok(encodeOptionsList(['A B', 'A-B']))).toEqual([
      { Label: 'A B', Value: 'A B' },
      { Label: 'A-B', Value: 'A-B' }
    ]);
  });

  it('🔴 DISAMBIGUATES two identical labels rather than refusing mid-edit', () => {
    // The only derived collision left. Two options a reader cannot tell apart is a mistake worth
    // surfacing, but blocking Save while somebody is still typing is not how to surface it — and
    // because the suffixed row's Value no longer equals its Label, the editor expands it to the
    // object form, which is the author seeing it.
    expect(ok(encodeOptionsList(['Option 1', 'Option 1']))).toEqual([
      { Label: 'Option 1', Value: 'Option 1' },
      { Label: 'Option 1', Value: 'Option 1 (2)' }
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
    expect(decodeOptionsList(['Small'])).toEqual([{ Label: 'Small', Value: 'Small' }]);
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
      { Label: 'Small', Value: 'Small' },
      { Label: 'Large', Value: 'Large' }
    ]);
    expect(JSON.parse(decoded.json)).toEqual(['Small', 'Large']);
    expect(decoded.expectedType).toBe('array');
  });

  it('🔴 expands to the object the moment a value is customised', () => {
    const decoded = decodeForEditor('optionslist', [
      { Label: 'Small', Value: 'Small' },
      { Label: 'Large', Value: 'l' }
    ]);
    expect(JSON.parse(decoded.json)).toEqual(['Small', { Label: 'Large', Value: 'l' }]);
  });

  it('🔴 round-trips: what the editor shows encodes back to what was stored', () => {
    const stored = [
      { Label: 'Small', Value: 'Small' },
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

/**
 * 🔴 Richard, 2026-09-06: *"I had imagined the simple mode as it is at the moment, maybe hiding the
 * values and making them identical to the labels by default, but that in advanced mode you'd still
 * see the values to be able to tweak them (for database compatibility for example)."*
 *
 * ⚠️ Every row here grades the ONE JSON STRING the editor holds, because that is where the defect
 * lived: `JSONEditor` keeps a single draft and both modes rendered it, so Easy mode's collapsed
 * spelling silently became Advanced mode's too and the Value field an author needed had nowhere to
 * appear.
 */
describe('optionslist §6 — 🔴 Easy mode hides the value, Advanced mode shows it', () => {
  const EASY = JSON.stringify(['Small', 'Large'], null, 2);
  const ADVANCED = JSON.stringify(
    [
      { Label: 'Small', Value: 'Small' },
      { Label: 'Large', Value: 'Large' }
    ],
    null,
    2
  );

  it('expands the collapsed rows when switching to Advanced', () => {
    expect(optionsListJsonForMode(EASY, 'advanced')).toBe(ADVANCED);
  });

  it('collapses them again when switching back to Easy', () => {
    expect(optionsListJsonForMode(ADVANCED, 'easy')).toBe(EASY);
  });

  it('🔴 keeps a value the author actually customised, in BOTH directions', () => {
    // The whole reason Advanced mode has to show the field: `l` must survive a trip through Easy
    // mode, where it is the one row that stays an object.
    const customised = JSON.stringify([{ Label: 'Large', Value: 'l' }], null, 2);
    expect(JSON.parse(optionsListJsonForMode(customised, 'easy'))).toEqual([{ Label: 'Large', Value: 'l' }]);
    expect(JSON.parse(optionsListJsonForMode(customised, 'advanced'))).toEqual([{ Label: 'Large', Value: 'l' }]);
  });

  it('encodes to the same stored value from either spelling', () => {
    // The switch is a re-spelling, not an edit — the parameter written must not depend on which
    // mode happened to be open when Save was pressed.
    expect(ok(encodeFromEditor('optionslist', EASY))).toEqual(ok(encodeFromEditor('optionslist', ADVANCED)));
  });

  it('⚠️ hands back text it cannot read VERBATIM, because Advanced mode is where it gets fixed', () => {
    for (const broken of ['[{"Label": "Small",', 'not json at all', '{"a":1}']) {
      expect(optionsListJsonForMode(broken, 'advanced')).toBe(broken);
      expect(optionsListJsonForMode(broken, 'easy')).toBe(broken);
    }
  });

  it('⚠️ refuses to re-spell a list it would SHRINK — a dropped row is data loss', () => {
    // `decodeOptionsList` skips a nested array and an object with neither key. Re-spelling would
    // silently delete those rows from the author's draft on a mode switch.
    const withUnreadableRow = JSON.stringify(['Small', ['nested'], {}], null, 2);
    expect(optionsListJsonForMode(withUnreadableRow, 'advanced')).toBe(withUnreadableRow);
  });

  it('is empty-safe, so an untouched new list survives a switch', () => {
    expect(JSON.parse(optionsListJsonForMode('[]', 'advanced'))).toEqual([]);
    expect(JSON.parse(optionsListJsonForMode('', 'advanced'))).toEqual([]);
  });
});
