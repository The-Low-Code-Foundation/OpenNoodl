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
export type ListPortType = 'array' | 'object' | 'stringlist' | 'proplist';

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

export type EncodeResult<T = unknown> = { ok: true; value: T } | { ok: false; error: string };

/** `array`/`proplist`/`stringlist` all edit as JSON arrays; only `object` is an object. */
export function expectedTypeFor(portType: ListPortType): 'array' | 'object' {
  return portType === 'object' ? 'object' : 'array';
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
 * An entry that arrives without a usable `id` inherits the id of the previous
 * entry with the same label, so renaming nothing and reordering everything keeps
 * every child port attached. Only a genuinely new label mints a new id.
 */
export function encodePropList(entries: unknown, previous: unknown): EncodeResult<PropListEntry[] | undefined> {
  if (!Array.isArray(entries)) {
    return { ok: false, error: 'Expected a list of entries, for example [{ "label": "First" }].' };
  }

  const prior = decodePropList(previous);
  const idByLabel = new Map<string, string>();
  const taken = new Set<string>();
  for (const p of prior) {
    if (p.id) {
      taken.add(p.id);
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

    let finalId = typeof id === 'string' && id !== '' ? id : idByLabel.get(name) || '';
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
