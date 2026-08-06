'use strict';

/**
 * CSV, in one place (CWF-012 slice 1).
 *
 * ## Why this module exists rather than a second parser
 *
 * `Static Array` has shipped a real CSV tokeniser since the Noodl days — a regex scanner that
 * handles quoted cells, embedded delimiters, embedded newlines and doubled quotes — but it was
 * **authoring-time only**: the CSV was typed into the editor, never received at runtime. CWF-012's
 * first instruction is therefore not "write a parser" but "lift the one we have", for the reason
 * the task states plainly: two parsers means two behaviours on the same file, and whichever one is
 * fixed will be the one you are not using. `staticdata.ts` now calls {@link parseCSVRows}, so
 * `Parse CSV`, `To CSV` and `Static Array` cannot disagree about what a CSV is.
 *
 * ## Two behaviours carried over deliberately
 *
 * 1. **Every cell is a string.** There is no type inference, so a column that looks numeric yields
 *    `"42"`, not `42`. The task names this and forbids quietly improving it: a graph that has been
 *    comparing `"42"` for a year must keep comparing `"42"`.
 * 2. **A trailing newline produces a trailing row.** `a,b\n` is two rows, the second holding one
 *    empty cell — which is what the tokeniser has always done, and what Static Array's authors
 *    have been seeing.
 *
 * ## One behaviour deliberately changed, and it is a bug fix
 *
 * The original wrote `if (arrMatches[2])` to decide "was this cell quoted", which is a truthiness
 * test on the captured text. An **empty quoted cell** (`""`) captures the empty string, so the
 * test failed and the code fell through to the unquoted branch — whose capture group did not
 * participate in that match. `""` therefore parsed to `undefined`, not `''`, which contradicts
 * behaviour 1 above in the one case it is easiest not to notice. The test here is
 * `!== undefined`, so an empty quoted cell is an empty string.
 *
 * ## Malformed input
 *
 * The tokeniser cannot throw: an unterminated quote simply stops it, and every byte after the
 * offending quote is silently dropped. That is the failure this module has to make loud, because
 * "half my file arrived" is the least debuggable shape a data error can take. {@link parseCSV}
 * reports how far it got, so `Parse CSV` can fail with a line number instead of answering with a
 * truncated array. {@link parseCSVRows} keeps the tolerant shape for Static Array, whose input is
 * authored in the editor and whose behaviour must not change.
 *
 * @module noodl-runtime/csv
 */

export interface CSVParseError {
  /** One sentence, ready for a runtime error or an `Error` output. */
  message: string;
  /** 1-based line of the input where the tokeniser gave up. */
  line: number;
}

export interface CSVParseResult {
  /** Rows of raw cell strings — everything the tokeniser managed to read. */
  rows: string[][];
  /** Present when the tokeniser stopped early, i.e. the rest of the file was dropped. */
  error?: CSVParseError;
}

export interface ToCSVOptions {
  /** Column order. Default: the union of every record's keys, in first-seen order. */
  columns?: string[];
  /** Cell separator. Default `,`. */
  delimiter?: string;
  /** Write the column names as the first row. Default true. */
  includeHeader?: boolean;
  /** Row separator. Default `\n`; pass `\r\n` for a file destined for Excel on Windows. */
  newline?: string;
}

/**
 * Drop a leading byte-order mark.
 *
 * ⚠️ Excel writes UTF-8 **with a BOM**, and the BOM lands on the first *header* cell, so the
 * column that goes missing is the first one — and the author's report is "my first column is
 * missing", which points nowhere near the encoding. Stripping it is not optional politeness.
 */
export function stripBOM(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * The scanner, shared by both entry points.
 *
 * `gapAt` is the first character the scanner **skipped**, and it is the whole malformed-input
 * story. ⚠️ The obvious check — "did it reach the end of the input" — is not enough, and assuming
 * it was cost an hour: `exec` with the `g` flag does not stop at text it cannot match, it *scans
 * forward* to the next position that matches. So `3,"unterminated\n5,6` does not truncate the
 * file; it silently swallows the word `unterminated` and carries on at the newline, reaching the
 * end with every row present and one cell quietly emptied. Contiguity is the property that fails —
 * each match has to begin exactly where the previous one ended.
 */
function tokenise(text: string, delimiter: string): { rows: string[][]; gapAt?: number } {
  // Delimiters, then either a quoted field or a standard one. Lifted from Static Array's
  // `CSVToArray` unchanged apart from the empty-quoted-cell fix noted in the module comment.
  const objPattern = new RegExp(
    // Delimiters.
    '(\\' +
      delimiter +
      '|\\r?\\n|\\r|^)' +
      // Quoted fields.
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      // Standard fields.
      '([^"\\' +
      delimiter +
      '\\r\\n]*))',
    'gi'
  );

  const rows: string[][] = [[]];
  let matches: RegExpExecArray | null = null;
  let prevLastIndex: number | undefined;
  /** Where the next match must begin if nothing was skipped. */
  let expected = 0;
  let gapAt: number | undefined;

  // The zero-progress guard is load-bearing: the standard-field group can match the empty
  // string, so without it a position the pattern cannot advance past loops forever.
  while ((matches = objPattern.exec(text)) && prevLastIndex !== objPattern.lastIndex) {
    prevLastIndex = objPattern.lastIndex;
    if (gapAt === undefined && matches.index > expected) gapAt = expected;
    expected = objPattern.lastIndex;

    const matchedDelimiter = matches[1];

    // A delimiter that is not the *cell* delimiter is a row break.
    if (matchedDelimiter.length && matchedDelimiter !== delimiter) rows.push([]);

    // ⚠️ `!== undefined`, not truthiness — see the module comment. `""` is a quoted cell whose
    // capture is the empty string, and the truthiness test sent it down the unquoted branch,
    // where group 3 had not participated and the cell came out `undefined`.
    const value = matches[2] !== undefined ? matches[2].replace(/""/g, '"') : matches[3];

    rows[rows.length - 1].push(value);
  }

  // The other half: the scanner stopped with input left over, which is what an unterminated quote
  // at the very end of the file produces (there is no later delimiter to resume at).
  if (gapAt === undefined && expected < text.length) gapAt = expected;

  return { rows, gapAt };
}

/**
 * Rows of raw cell strings, tolerantly — the exact shape `Static Array` has always produced.
 *
 * Whatever the tokeniser could read, with no complaint about what it could not. Use
 * {@link parseCSV} anywhere the text arrived at runtime.
 */
export function parseCSVRows(text: string | undefined | null, delimiter?: string): string[][] {
  return tokenise(stripBOM(String(text === undefined || text === null ? '' : text)), delimiter || ',').rows;
}

/**
 * Rows plus a verdict.
 *
 * The one failure a CSV tokeniser has is a **quote it cannot pair**, and its consequence is not an
 * exception — it is characters disappearing out of the middle of the file, or the tail of the file
 * disappearing entirely. See {@link tokenise} for why contiguity, and not "did we reach the end",
 * is the property that detects it.
 */
export function parseCSV(text: string | undefined | null, delimiter?: string): CSVParseResult {
  const source = stripBOM(String(text === undefined || text === null ? '' : text));
  const { rows, gapAt } = tokenise(source, delimiter || ',');

  if (gapAt !== undefined) {
    const line = source.slice(0, gapAt).split(/\r\n|\r|\n/).length;
    return {
      rows,
      error: {
        line,
        message:
          `The CSV could not be parsed at line ${line}: a quote is never closed, so text around it ` +
          'would have been silently dropped. A quote inside a quoted cell has to be written as "".'
      }
    };
  }

  return { rows };
}

/**
 * Header row + data rows → records.
 *
 * A header-only file yields no records, which is right: it describes zero rows. A row shorter than
 * the header leaves the missing columns `undefined` rather than inventing an empty string, so
 * "this row was short" stays visible to whatever reads it.
 */
export function rowsToRecords(rows: string[][]): Record<string, string>[] {
  const header = rows[0];
  if (!header) return [];

  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) record[header[j]] = row[j];
    records.push(record);
  }
  return records;
}

/** The union of every record's keys, in the order they were first seen. */
export function unionOfKeys(records: Record<string, unknown>[]): string[] {
  const seen: string[] = [];
  const index: Record<string, true> = {};
  for (const record of records) {
    if (!record) continue;
    for (const key of Object.keys(record)) {
      if (index[key]) continue;
      index[key] = true;
      seen.push(key);
    }
  }
  return seen;
}

/**
 * One cell, quoted only where it has to be.
 *
 * The whole correctness question of writing CSV lives here: a cell containing the delimiter, a
 * quote or a newline **must** be wrapped in quotes and have its own quotes doubled. Get it wrong
 * and the file parses, silently, into the wrong shape — which is why the round-trip test in
 * `csv.test.ts` uses a fixture carrying all three hazards at once.
 */
function quoteCell(value: unknown, delimiter: string): string {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : String(value);
  const needsQuoting = text.indexOf(delimiter) !== -1 || /["\r\n]/.test(text);
  return needsQuoting ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** Records → CSV text. See {@link ToCSVOptions} for the defaults. */
export function toCSV(records: Record<string, unknown>[], options: ToCSVOptions = {}): string {
  const delimiter = options.delimiter || ',';
  const newline = options.newline || '\n';
  const includeHeader = options.includeHeader !== false;
  const columns = options.columns && options.columns.length ? options.columns : unionOfKeys(records || []);

  const lines: string[] = [];
  if (includeHeader) lines.push(columns.map((c) => quoteCell(c, delimiter)).join(delimiter));
  for (const record of records || []) {
    lines.push(columns.map((c) => quoteCell(record ? record[c] : undefined, delimiter)).join(delimiter));
  }
  return lines.join(newline);
}

/** Rows of cells → CSV text, for the header-less direction. */
export function rowsToCSV(rows: unknown[][], options: ToCSVOptions = {}): string {
  const delimiter = options.delimiter || ',';
  const newline = options.newline || '\n';
  return (rows || []).map((row) => (row || []).map((cell) => quoteCell(cell, delimiter)).join(delimiter)).join(newline);
}
