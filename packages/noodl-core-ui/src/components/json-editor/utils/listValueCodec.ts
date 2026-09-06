/**
 * List value codec — ERG-003.
 *
 * One JSON editor now serves all four list-shaped port types, but the four do
 * not agree on how a value is *stored*. This module is the only place that
 * knows the difference: it decodes a stored parameter into the JSON the editor
 * edits, and encodes the edited JSON back into the shape the runtime consumes.
 *
 * The encodings below were re-measured for ERG-003 against every `project.json`
 * in the repo (89 files, 5,411 node instances) plus the runtime consumers. See
 * `ERG-003-NOTES.md`. In summary:
 *
 * | Port type    | Stored as                          | Observed |
 * |--------------|------------------------------------|----------|
 * | `stringlist` | comma-separated **string**         | 423 values, 100% string |
 * | `proplist`   | `Array<{ id, label }>`             | 55 values, 100% that shape |
 * | `array`      | **string** holding a JS/JSON literal | 0 stored; from the code path |
 * | `object`     | **string** holding a JS/JSON literal | 0 stored; from the code path |
 *
 * Nothing here touches the DOM, so it is unit-testable in this package's
 * `testEnvironment: 'node'` runner — which matters, because the property panel
 * itself is only checkable live.
 *
 * @module json-editor/utils
 */

/** The four list-shaped port types the property panel routes through one editor. */
export type ListPortType = 'array' | 'object' | 'stringlist' | 'proplist' | 'optionslist';

/**
 * One row of an `optionslist`, as `Select.tsx` reads it.
 *
 * 🔴 **Capitalised, because the runtime reads `i.Label` and `i.Value` on every entry.** A bare
 * `["a","b"]` renders `<option value="">` with nothing selectable, which is the defect this port
 * type exists to make unreachable — see §3 of NOTES-UNOWNED-NODE-WORK.md.
 */
export interface OptionEntry {
  Label: string;
  Value: string;
}

/** One row of a `proplist`, as the runtime reads it (`simplejavascript.ts`, `javascript.ts`). */
export interface PropListEntry {
  id: string;
  label: string;
}

export interface DecodeResult {
  /** JSON text to hand to `JSONEditor`'s `value`. */
  json: string;
  /** `expectedType` for `JSONEditor`, so validation matches the port. */
  expectedType: 'array' | 'object';
  /**
   * The stored value was not JSON but was recoverable (a JavaScript object
   * literal, which is what the runtime's `eval` accepts). `json` holds the
   * canonicalised form.
   */
  recovered: boolean;
  /**
   * Nothing could be parsed. `json` holds the raw stored text verbatim and the
   * caller MUST open in `advanced` mode: showing an empty visual tree over a
   * value we failed to read is how an author's data gets silently replaced.
   */
  unparseable: boolean;
}

/**
 * The complementary `error?: undefined` / `value?: undefined` members are load
 * bearing, not decoration: this repo compiles with `strictNullChecks` off, and
 * under that setting TypeScript does not narrow a union by a boolean literal
 * discriminant — `if (!r.ok) return r.error` reports `error` as missing. Making
 * both members structurally complete keeps the type honest at the call sites
 * without asking every caller for a cast.
 */
export type EncodeResult<T = unknown> =
  | { ok: true; value: T; error?: undefined }
  | { ok: false; value?: undefined; error: string };

/** `array`/`proplist`/`stringlist` all edit as JSON arrays; only `object` is an object. */
export function expectedTypeFor(portType: ListPortType): 'array' | 'object' {
  return portType === 'object' ? 'object' : 'array';
}

/** Every port type the shared list editor claims. Derived from the catalog, not hand-listed. */
export const LIST_PORT_TYPES: readonly ListPortType[] = [
  'array',
  'object',
  'stringlist',
  'proplist',
  'optionslist'
];

/**
 * Is this port one of the list-shaped ones, and which?
 *
 * `DataTypes/Ports.ts` routes on the answer and ERG-003's catalog test derives
 * its expectation from it, so "which ports are covered" has exactly one
 * definition. `type` is a port type as the node library stores it: a bare name,
 * or an object with `name` (already resolved through `editAsType` by the
 * caller's `getEditType`).
 */
export function listPortTypeFor(type: unknown): ListPortType | undefined {
  if (!type) return undefined;
  const name = typeof type === 'string' ? type : (type as { name?: unknown }).name;
  return LIST_PORT_TYPES.find((t) => t === name);
}

/* -------------------------------------------------------------------------- */
/* Literal reading                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Read a stored `array`/`object` literal.
 *
 * Strict JSON first. Failing that, a JavaScript literal — because that is what
 * the runtime actually accepts: `Node.prototype.setInputValue` `eval`s the
 * string, and `DataTypes/Ports.ts` deliberately does *not* JSON-validate these
 * ports so that `{ Authorization: 'Bearer x' }` stays legal. An editor stricter
 * than the runtime would report a working value as broken.
 *
 * `Function` rather than `eval` so this never sees the caller's scope. It runs
 * only on text already stored in the user's own project, which the runtime
 * evaluates anyway — this is not a new trust boundary.
 */
function readLiteral(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false };

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    /* fall through to the JS-literal read */
  }

  try {
    // Parenthesised for the same reason `node.ts` does it: `{a:1}` parses as a
    // labelled statement in expression position and quietly yields `1`.
    // eslint-disable-next-line no-new-func
    const value = new Function('"use strict"; return (' + trimmed + ');')();
    // A literal that evaluates to a function or undefined is not data.
    if (typeof value === 'function' || value === undefined) return { ok: false };
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/** Anything the editor round-trips has to survive `JSON.stringify`. */
function canonical(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/* -------------------------------------------------------------------------- */
/* stringlist                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Stored comma string -> the array the editor shows.
 *
 * Tolerates the array-of-`{label}` shape that `StringListType.normalizeList`
 * has always accepted, so a port that somehow holds one still opens.
 */
export function decodeStringList(stored: unknown): string[] {
  if (stored === undefined || stored === null || stored === '') return [];
  if (Array.isArray(stored)) {
    return stored.map((item) =>
      item && typeof item === 'object' && 'label' in (item as object)
        ? String((item as { label: unknown }).label)
        : String(item)
    );
  }
  if (typeof stored === 'string') return stored.split(',').filter(Boolean);
  return [];
}

/**
 * Editor array -> the comma string the runtime consumes.
 *
 * The rejections are the point. A comma-separated string cannot represent an
 * entry containing a comma, and until now nothing said so: typing `a,b` as one
 * entry produced two, silently. Twenty-nine runtime files independently
 * `split(',')` this parameter, so the format is not ours to change here — but
 * refusing what it cannot carry is.
 */
export function encodeStringList(entries: unknown): EncodeResult<string | undefined> {
  if (!Array.isArray(entries)) {
    return { ok: false, error: 'Expected a list of names, for example ["First", "Second"].' };
  }

  const out: string[] = [];
  for (const raw of entries) {
    if (raw === null || raw === undefined) {
      return { ok: false, error: 'A list entry cannot be empty.' };
    }
    if (typeof raw === 'object') {
      return { ok: false, error: 'Each entry must be a name, not a list or an object.' };
    }
    const name = String(raw).trim();
    if (name === '') {
      return { ok: false, error: 'A list entry cannot be empty.' };
    }
    if (name.includes(',')) {
      return {
        ok: false,
        error: `"${name}" contains a comma. This list is stored comma-separated, so an entry cannot contain one.`
      };
    }
    if (out.includes(name)) {
      return { ok: false, error: `"${name}" appears more than once. Entry names must be unique.` };
    }
    out.push(name);
  }

  // An empty list is stored as "no value at all" so the port reads as default,
  // which is what `StringListType.listUpdated` has always done.
  return { ok: true, value: out.length === 0 ? undefined : out.join(',') };
}

/* -------------------------------------------------------------------------- */
/* proplist                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Stored `[{id,label}]` -> what the editor shows.
 *
 * `id` is kept in the JSON rather than hidden: it is the key the runtime uses to
 * attach each row's child ports (`parentItemId`), so an author who reorders rows
 * in the code view keeps those ports attached. Dropping it from the view would
 * make every code-mode edit silently re-mint ids.
 */
export function decodePropList(stored: unknown): PropListEntry[] {
  if (!Array.isArray(stored)) return [];
  const out: PropListEntry[] = [];
  for (const item of stored) {
    if (typeof item === 'string') {
      out.push({ id: '', label: item });
    } else if (item && typeof item === 'object') {
      const label = (item as { label?: unknown }).label;
      if (label === undefined) continue;
      const id = (item as { id?: unknown }).id;
      out.push({ id: typeof id === 'string' ? id : '', label: String(label) });
    }
  }
  return out;
}

/** Four base-36 characters, the same shape `PropListType._guid` produces. */
function mintId(taken: Set<string>): string {
  for (;;) {
    const uid = ('0000' + ((Math.random() * Math.pow(36, 4)) | 0).toString(36)).slice(-4);
    if (!taken.has(uid)) {
      taken.add(uid);
      return uid;
    }
  }
}

/**
 * Editor array -> `[{id,label}]`.
 *
 * An incoming `id` is a **hint, not an authority**: it is honoured only when it
 * already belongs to this port. Anything else falls through to the id of the
 * previous entry with the same label, and only a genuinely new label mints one.
 *
 * That ordering is what makes the three code-mode edits all do the right thing:
 *
 * - *Reorder* — every id is one of ours, so all are honoured and every child
 *   port stays attached. This is the case the id stability exists for.
 * - *Rename, id kept* — the id is ours, so the child ports follow the new label.
 * - *Paste a list copied from another node* — the ids are foreign, so they are
 *   ignored and matching labels re-attach to **this** node's ids.
 *
 * Honouring a foreign id looks harmless, and for label-keyed consumers
 * (`Function`/`Script`/`REST` name their child ports `intype-<label>`) it is.
 * But `Navigation Stack` names them `pageComp-<id>`/`pagePath-<id>` and
 * `Create`/`Update Record` names them `acl-<id>-role` and friends — there the id
 * is part of a stored parameter key and a connection endpoint. Letting a pasted
 * id win there silently orphans the sibling parameters: the page keeps its name
 * and loses the component it renders, with nothing said. The rule below costs
 * nothing in the cases that were already correct and closes that one.
 */
export function encodePropList(entries: unknown, previous: unknown): EncodeResult<PropListEntry[] | undefined> {
  if (!Array.isArray(entries)) {
    return { ok: false, error: 'Expected a list of entries, for example [{ "label": "First" }].' };
  }

  const prior = decodePropList(previous);
  const idByLabel = new Map<string, string>();
  const taken = new Set<string>();
  // Snapshot of the ids this port already owns. Kept separate from `taken`,
  // which grows as ids are minted below — an id minted during this same pass
  // must not retroactively make a foreign id look like one of ours.
  const priorIds = new Set<string>();
  for (const p of prior) {
    if (p.id) {
      taken.add(p.id);
      priorIds.add(p.id);
      if (!idByLabel.has(p.label)) idByLabel.set(p.label, p.id);
    }
  }

  const out: PropListEntry[] = [];
  const seenLabels = new Set<string>();
  const usedIds = new Set<string>();

  for (const raw of entries) {
    let label: unknown;
    let id: unknown;

    if (typeof raw === 'string' || typeof raw === 'number') {
      label = raw;
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      label = (raw as { label?: unknown }).label;
      id = (raw as { id?: unknown }).id;
      if (label === undefined) {
        return { ok: false, error: 'Every entry needs a "label". Example: { "label": "First" }.' };
      }
    } else {
      return { ok: false, error: 'Every entry must be an object with a "label", or a plain name.' };
    }

    const name = String(label).trim();
    if (name === '') return { ok: false, error: 'An entry label cannot be empty.' };
    if (seenLabels.has(name)) {
      return { ok: false, error: `"${name}" appears more than once. Entry labels must be unique.` };
    }
    seenLabels.add(name);

    const claimed = typeof id === 'string' && id !== '' && priorIds.has(id) ? id : '';
    let finalId = claimed || idByLabel.get(name) || '';
    // Two rows must never share an id: the child ports of one would attach to both.
    if (finalId === '' || usedIds.has(finalId)) finalId = mintId(new Set([...taken, ...usedIds]));
    usedIds.add(finalId);
    taken.add(finalId);

    out.push({ id: finalId, label: name });
  }

  // Same "empty means default" rule `PropListType.listUpdated` already applied.
  return { ok: true, value: out.length === 0 ? undefined : out };
}

/* -------------------------------------------------------------------------- */
/* optionslist                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The value an option carries when its author has not written one: **the label itself**.
 *
 * 🔴 **It used to be a slug** (`"Extra Large"` → `extra-large`), and Richard, 2026-09-06, is
 * why it is not any more:
 *
 * > *"the default value when placing a dropdown node is 'option-1' even though the label is
 * > 'Option 1' which will further confuse the user … The 'value' set if you only use the easy JSON
 * > editor mode must be exactly the same as the label, so the simple mode users won't get
 * > confused. If the user goes advanced and edits the JSON value fields manually, then they take
 * > the responsibility of knowing how to hook up external data."*
 *
 * A slug is only a convenience for an author who already knows what a value *is* — and it invents
 * a second string per option that they never typed and cannot see in Easy mode. Mirroring the
 * label invents nothing: what the Value port sends is exactly what the reader picked, which is the
 * one mapping a beginner can predict without opening Advanced mode. The moment somebody needs
 * `"Large"` to send `l`, they write it in Advanced mode and own the difference.
 *
 * ⚠️ Trimmed, and never empty — an empty `Value` is the `<option value="">` defect this port
 * type exists to prevent, which is why an all-whitespace label is refused outright by
 * {@link encodeOptionsList} rather than being allowed to derive one.
 */
export function derivedValueForOption(label: string): string {
  return label.trim();
}

/**
 * Stored value -> normalised `[{Label, Value}]`.
 *
 * 🔴 **Four stored shapes are accepted, and the reason is migration.** `items` shipped as
 * `type: 'array'`, whose stored form is a *string* holding a JS/JSON literal. No project in this
 * repo has one (measured: 0 across 148 files, which is what the `array` row of the table above
 * already said) but a user's project may, and a port type change that could not read the old
 * shape would silently empty their Dropdown.
 *
 * So: a real array, a string holding a literal, bare strings per row, and `{label,value}` in the
 * lowercase spelling a person would guess.
 */
export function decodeOptionsList(stored: unknown): OptionEntry[] {
  if (stored === undefined || stored === null || stored === '') return [];

  let source: unknown = stored;
  if (typeof stored === 'string') {
    const read = readLiteral(stored);
    if (!read.ok) return [];
    source = read.value;
  }
  if (!Array.isArray(source)) return [];

  const out: OptionEntry[] = [];
  for (const item of source) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const label = String(item);
      out.push({ Label: label, Value: derivedValueForOption(label) });
      continue;
    }
    if (typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    // Both spellings. The capital pair is what the runtime reads; the lowercase pair is what a
    // person hand-writing JSON guesses, and reading it costs nothing.
    const label = row.Label !== undefined ? row.Label : row.label;
    const value = row.Value !== undefined ? row.Value : row.value;
    if (label === undefined && value === undefined) continue;
    const labelText = String(label !== undefined ? label : value);
    out.push({
      Label: labelText,
      Value: value !== undefined ? String(value) : derivedValueForOption(labelText)
    });
  }
  return out;
}

/**
 * Editor array -> the `[{Label, Value}]` the runtime consumes.
 *
 * A row may be written three ways and all three mean the same thing:
 *
 * - `"Large"` — the beginner path. Label is what was typed, Value is its slug.
 * - `{ "Label": "Large" }` — the same, spelled out.
 * - `{ "Label": "Large", "Value": "l" }` — the author overriding the derived value.
 *
 * 🔴 **Duplicate values are handled differently depending on where they came from, because the
 * two cases mean different things.** A *derived* collision ("A B" and "A-B" both slug to `a-b`) is
 * an accident of the convenience and gets a numeric suffix — refusing there would block an author
 * from typing two ordinary labels. An *explicitly written* duplicate is a statement, and a wrong
 * one: two options with the same value cannot be told apart by anything downstream, so it is
 * refused with a message rather than silently renamed behind the author's back.
 */
export function encodeOptionsList(entries: unknown): EncodeResult<OptionEntry[] | undefined> {
  if (!Array.isArray(entries)) {
    return { ok: false, error: 'Expected a list of options, for example ["First", "Second"].' };
  }

  const out: OptionEntry[] = [];
  const used = new Set<string>();

  for (const raw of entries) {
    let label: string;
    let explicitValue: string | undefined;

    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      label = String(raw);
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const row = raw as Record<string, unknown>;
      const rawLabel = row.Label !== undefined ? row.Label : row.label;
      const rawValue = row.Value !== undefined ? row.Value : row.value;
      if (rawLabel === undefined && rawValue === undefined) {
        return { ok: false, error: 'Every option needs a "Label". Example: { "Label": "First" }.' };
      }
      label = String(rawLabel !== undefined ? rawLabel : rawValue);
      if (rawValue !== undefined) explicitValue = String(rawValue);
    } else {
      return { ok: false, error: 'Each option must be a label, or an object with Label and Value.' };
    }

    if (label.trim() === '') {
      return { ok: false, error: 'An option label cannot be empty — it is what the reader sees.' };
    }

    if (explicitValue !== undefined) {
      if (explicitValue.trim() === '') {
        return {
          ok: false,
          error: `"${label}" has an empty Value. An option with no value cannot be selected — remove the Value to derive one from the label.`
        };
      }
      if (used.has(explicitValue)) {
        return {
          ok: false,
          error: `Two options both use the value "${explicitValue}". Values must differ, or nothing downstream can tell the options apart.`
        };
      }
      used.add(explicitValue);
      out.push({ Label: label, Value: explicitValue });
      continue;
    }

    // Derived: disambiguate rather than refuse.
    //
    // ⚠️ Since a derived value is now the label verbatim, the only way to reach this is to type the
    // SAME LABEL TWICE — the old slug collisions ("A B" and "A-B") no longer exist. Two options a
    // reader cannot tell apart is a mistake worth surfacing, but not one worth blocking a save
    // over mid-edit; and because the suffixed row's Value no longer equals its Label, Easy mode
    // expands it to `{ Label, Value }` on the next open, which is the author seeing it.
    const base = derivedValueForOption(label);
    let value = base;
    for (let n = 2; used.has(value); n++) value = `${base} (${n})`;
    used.add(value);
    out.push({ Label: label, Value: value });
  }

  // The same "empty means default" rule the other list types apply — an empty list clears the
  // parameter so the port falls back to its declared default rather than storing `[]`.
  return { ok: true, value: out.length === 0 ? undefined : out };
}

/**
 * The simplest spelling of a row that round-trips to the same thing.
 *
 * 🔴 **This is what makes the beginner mode a beginner mode.** Richard asked for "click plus and
 * type"; if the editor always showed `{ "Label": …, "Value": … }` the author would meet a
 * two-field object before they had done anything. A row whose value is exactly its label carries
 * no information the label does not, so it is shown as the bare label.
 *
 * ⚠️ It is the spelling of ONE MODE, not of the value — see {@link optionsListJsonForMode}.
 */
function shortestOptionForm(entry: OptionEntry): string | OptionEntry {
  return entry.Value === derivedValueForOption(entry.Label) ? entry.Label : entry;
}

/**
 * The two spellings of an options list, and which mode is allowed to see which.
 *
 * 🔴 **Richard, 2026-09-06 — collapsing every row in BOTH modes was the defect:**
 *
 * > *"The 'simplified' way of adding options now removes the users option to actually change the
 * > value and label to be different. I had imagined the simple mode as it is at the moment, maybe
 * > hiding the values and making them identical to the labels by default, but that in advanced
 * > mode you'd still see the values to be able to tweak them (for database compatibility for
 * > example)."*
 *
 * `shortestOptionForm` is the right answer for the visual tree and the wrong one for the text
 * editor: Advanced mode exists precisely to show what is stored, and a bare `"Small"` where the
 * parameter holds `{ Label: "Small", Value: "Small" }` leaves an author who needs it to send `s`
 * with nothing to edit and no hint that a Value field exists at all.
 *
 * ⚠️ **It runs on the editor's DRAFT TEXT, not on the stored parameter.** A mode switch has to
 * carry unsaved edits across, so it re-reads whatever is in the box.
 *
 * ⚠️ **Text it cannot read is handed back verbatim.** Advanced mode is where an author fixes
 * broken JSON; rewriting it under them while they do is how the fix gets lost. Same rule for a
 * list the decoder would shrink — a row it drops would vanish from the text on a mode switch,
 * which is data loss dressed up as a re-spelling.
 */
export function optionsListJsonForMode(json: string, mode: 'easy' | 'advanced'): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json && json.trim() !== '' ? json : '[]');
  } catch {
    return json;
  }
  if (!Array.isArray(parsed)) return json;

  const decoded = decodeOptionsList(parsed);
  if (decoded.length !== parsed.length) return json;

  return canonical(mode === 'advanced' ? decoded : decoded.map(shortestOptionForm));
}

/* -------------------------------------------------------------------------- */
/* The public boundary                                                        */
/* -------------------------------------------------------------------------- */

/** Stored parameter -> the JSON text the editor edits. */
export function decodeForEditor(portType: ListPortType, stored: unknown): DecodeResult {
  const expectedType = expectedTypeFor(portType);

  if (portType === 'stringlist') {
    return { json: canonical(decodeStringList(stored)), expectedType, recovered: false, unparseable: false };
  }

  if (portType === 'proplist') {
    return { json: canonical(decodePropList(stored)), expectedType, recovered: false, unparseable: false };
  }

  if (portType === 'optionslist') {
    const decoded = decodeOptionsList(stored);
    // ⚠️ `recovered` is set for a stored STRING that parsed, which is the legacy `array` shape.
    // The caller uses it to tell the author their value was rewritten into the new form rather
    // than leaving them to notice the file changed.
    const recovered = typeof stored === 'string' && stored.trim() !== '' && decoded.length > 0;
    const unparseable = typeof stored === 'string' && stored.trim() !== '' && decoded.length === 0;
    if (unparseable) return { json: stored, expectedType, recovered: false, unparseable: true };
    return { json: canonical(decoded.map(shortestOptionForm)), expectedType, recovered, unparseable: false };
  }

  // array / object: stored as a literal *string*, but a real array/object is
  // also legal at runtime (`setInputValue` only parses when it sees a string),
  // so both are accepted here.
  if (stored === undefined || stored === null || stored === '') {
    return { json: expectedType === 'array' ? '[]' : '{}', expectedType, recovered: false, unparseable: false };
  }

  if (typeof stored !== 'string') {
    return { json: canonical(stored), expectedType, recovered: false, unparseable: false };
  }

  const read = readLiteral(stored);
  if (!read.ok) {
    // Hand back the raw text untouched. The caller opens Advanced mode over it;
    // nothing is discarded and nothing is guessed.
    return { json: stored, expectedType, recovered: false, unparseable: true };
  }

  const isJson = (() => {
    try {
      JSON.parse(stored.trim());
      return true;
    } catch {
      return false;
    }
  })();

  return { json: canonical(read.value), expectedType, recovered: !isJson, unparseable: false };
}

/**
 * The JSON text from the editor -> the stored parameter.
 *
 * `previous` is the parameter's current value, used only by `proplist` to keep
 * ids stable. Returns `{ ok: false }` with a message an author can act on rather
 * than throwing — the caller's contract is that a failed encode writes nothing.
 */
export function encodeFromEditor(portType: ListPortType, json: string, previous?: unknown): EncodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json && json.trim() !== '' ? json : expectedTypeFor(portType) === 'array' ? '[]' : '{}');
  } catch (e) {
    return { ok: false, error: 'This is not valid JSON, so it was not saved. ' + (e as Error).message };
  }

  if (portType === 'stringlist') return encodeStringList(parsed);
  if (portType === 'proplist') return encodePropList(parsed, previous);
  if (portType === 'optionslist') return encodeOptionsList(parsed);

  if (portType === 'array' && !Array.isArray(parsed)) {
    return { ok: false, error: 'This port takes a list. Wrap the value in [ ] brackets.' };
  }
  if (portType === 'object' && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
    return { ok: false, error: 'This port takes an object. Wrap the value in { } braces.' };
  }

  // Stored as a string, which is what `CodeEditorType` has always written and
  // what `setInputValue` parses. Canonicalised so the code view and the visual
  // view cannot disagree about what is on disk.
  const text = canonical(parsed);
  const isEmpty = portType === 'array' ? (parsed as unknown[]).length === 0 : Object.keys(parsed).length === 0;
  return { ok: true, value: isEmpty ? undefined : text };
}
