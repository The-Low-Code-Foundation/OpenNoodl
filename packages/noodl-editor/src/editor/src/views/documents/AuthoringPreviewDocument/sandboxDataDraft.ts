/**
 * BEN-006 — what the data editor is actually doing, without the React around it.
 *
 * Split out for one reason: every rule worth getting right here is a rule about
 * *values*, and a rule about values that can only be checked by driving a panel
 * is a rule that does not get checked. The table/JSON views must edit the same
 * underlying records or the escape hatch is a second dialect; a number typed
 * into a text cell must not silently become a string; text that will not parse
 * must be kept rather than discarded. All three are pinned in specs because all
 * three are pinned here.
 *
 * @module noodl-editor/views/documents/AuthoringPreviewDocument/sandboxDataDraft
 */

import { SANDBOX_RECORD_FLAG, type SandboxRecord } from '@noodl/runtime/src/sandbox/types';

/** Row counts the panel offers as one click. */
export const ROW_COUNTS = [1, 3, 5, 20];

/**
 * Keys the sandbox puts on every record for its own bookkeeping.
 *
 * Editing them is meaningless — `completeRecord` reassigns `objectId`/`id`
 * whatever anyone types — and showing them buries the two fields the user
 * actually came here for under three they did not.
 */
export const INTERNAL_FIELDS: ReadonlySet<string> = new Set(['objectId', 'id', SANDBOX_RECORD_FLAG]);

export interface ClassDraft {
  /** The records, as the panel and the export both understand them. */
  records: Array<Record<string, unknown>>;
  /** The same value as text. The JSON view's source; kept in step by every table edit. */
  json: string;
  /** Non-empty only while `json` holds text that will not parse. `records` is then stale, deliberately. */
  error: string;
  /** JSON view rather than table view. */
  raw: boolean;
  /** False until the user changes something, so Reset can tell "generated" from "mine". */
  edited: boolean;
}

/** What the preview is serving, with the bookkeeping taken back off. */
export function editableRecords(records: readonly SandboxRecord[]): Array<Record<string, unknown>> {
  return records.map((record) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!INTERNAL_FIELDS.has(key)) out[key] = value;
    }
    return out;
  });
}

/** The columns: what the graph reads, then anything the records carry that it does not. */
export function visibleFields(
  fields: readonly string[],
  records: ReadonlyArray<Record<string, unknown>>
): string[] {
  const out = fields.filter((field) => !INTERNAL_FIELDS.has(field));
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!INTERNAL_FIELDS.has(key) && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

/** A draft prefilled from what is on screen — never from an empty box. */
export function draftFrom(records: readonly SandboxRecord[], edited = false): ClassDraft {
  const editable = editableRecords(records);
  return { records: editable, json: JSON.stringify(editable, null, 2), error: '', raw: false, edited };
}

/** A table edit: both halves move together, or the JSON view is a second dialect. */
export function withRecords(draft: ClassDraft, records: Array<Record<string, unknown>>): ClassDraft {
  return { ...draft, records, json: JSON.stringify(records, null, 2), error: '', edited: true };
}

/**
 * A JSON edit.
 *
 * Text that will not parse is **kept**, with its message, and `records` is left
 * where it was: discarding what someone typed because they are mid-keystroke is
 * how an editor teaches you not to type in it. `error` is what stops Apply.
 */
export function withJson(draft: ClassDraft, json: string): ClassDraft {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return { ...draft, json, error: 'This must be a list of records — a JSON array.', edited: true };
    }
    const bad = parsed.findIndex((record) => record === null || typeof record !== 'object' || Array.isArray(record));
    if (bad !== -1) {
      return { ...draft, json, error: `Row ${bad + 1} is not a record — every entry must be an object.`, edited: true };
    }
    return { ...draft, json, records: parsed, error: '', edited: true };
  } catch (error) {
    return { ...draft, json, error: String((error as Error)?.message ?? error), edited: true };
  }
}

/**
 * "Show me this with one row."
 *
 * Padded with `{}` rather than with a copy of the last row: `completeRecord`
 * synthesizes a distinct record per index, so an added row reads as a new row
 * instead of as the same one twice.
 */
export function withRowCount(draft: ClassDraft, count: number): ClassDraft {
  const current = draft.records;
  const next =
    count <= current.length
      ? current.slice(0, count)
      : [...current, ...Array.from({ length: count - current.length }, () => ({} as Record<string, unknown>))];
  return withRecords(draft, next);
}

/**
 * A cell's text, back into a value of the kind that was there.
 *
 * A table cell is text, so a number typed into one returns as a string unless
 * something converts it — and a `price` that silently became `"12"` is a whole
 * class of "why does my component render nothing", which is what the bench
 * exists to end rather than to introduce. Typed against the *previous* value
 * because that is the only evidence available: the field's declared type is not
 * part of a sandbox record.
 */
export function parseCell(text: string, previous: unknown): unknown {
  if (typeof previous === 'number') {
    const asNumber = Number(text);
    return text.trim() !== '' && Number.isFinite(asNumber) ? asNumber : text;
  }
  if (typeof previous === 'boolean') {
    if (text === 'true') return true;
    if (text === 'false') return false;
  }
  return text;
}

/** A value as a cell shows it. An object shows as its JSON; the JSON view edits it properly. */
export function cellText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
