/**
 * Stream parser utilities (AGENT-007).
 *
 * Pure functions that turn raw stream fragments into usable values. Nothing here
 * touches a transport, a timer, a node instance or a global — every function is a
 * total mapping from (buffer, options) to (values, leftover), which is what makes
 * the streaming behaviour testable without a server and reusable by both the SSE
 * node (AGENT-001) and the WebSocket node (AGENT-002).
 *
 * The shared shape is `{ <values>, rest }`: a caller keeps `rest` and prepends the
 * next fragment to it. None of these functions hold state, so a caller that loses
 * `rest` loses exactly the bytes it dropped and nothing else.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

// ============================================================================
// Server-Sent Events wire format
// ============================================================================

/**
 * One dispatched SSE event, as it came off the wire.
 *
 * `id` is the value of this event's `id:` field, *not* the stream's persistent
 * Last-Event-ID buffer — the HTML spec says that buffer survives events that carry
 * no `id:`, and only a connection can own something that outlives a fragment. So
 * `id` is `''` when the server sent no id, and the connection layer
 * (`sse-connection.ts`) is the thing that remembers the last non-empty one.
 */
export interface SseFrame {
  /** `event:` field, or `'message'` when the server sent none. */
  event: string;
  /** `data:` field(s). Multiple `data:` lines are joined with `\n`. */
  data: string;
  /** This event's `id:` field, or `''`. */
  id: string;
  /** `retry:` field in ms, when the server sent a valid one. */
  retry?: number;
}

export interface SseParseResult {
  frames: SseFrame[];
  /** Everything after the last dispatched event, to be prepended to the next chunk. */
  rest: string;
}

/**
 * Parses as many complete SSE events out of `buffer` as it can.
 *
 * Implements the WHATWG `text/event-stream` interpretation: lines end with CRLF, LF
 * or CR; a blank line dispatches; `:`-leading lines are comments; a field with no
 * colon has an empty value; one space after the colon is stripped; `data:` lines
 * accumulate and a single trailing newline is removed on dispatch; an event with no
 * `data:` field at all is *not* dispatched.
 *
 * Only whole events are consumed. A partial event stays in `rest` and is re-parsed
 * on the next call — which is why this function can be pure at all. The cost is
 * that a single very large event is re-scanned per chunk; SSE events are small, and
 * the alternative (carrying partial field state across calls) is a state machine the
 * caller would have to store and the tests could not inspect.
 *
 * A trailing lone `\r` is deliberately left unconsumed: it may be the first half of
 * a CRLF that has not arrived yet.
 */
export function parseSseChunk(buffer: string): SseParseResult {
  const frames: SseFrame[] = [];

  // A byte-order mark may only appear at the very start of the stream.
  let i = buffer.charCodeAt(0) === 0xfeff ? 1 : 0;
  let consumed = i;

  let eventType = '';
  let data: string | null = null;
  let id = '';
  let retry: number | undefined;

  const dispatch = () => {
    if (data === null) {
      // No data field: per spec the event is not dispatched, but the buffers reset.
      eventType = '';
      retry = undefined;
      return;
    }
    frames.push({
      event: eventType || 'message',
      data: data.endsWith('\n') ? data.slice(0, -1) : data,
      id,
      ...(retry !== undefined ? { retry } : {})
    });
    eventType = '';
    data = null;
    retry = undefined;
    // `id` intentionally persists across events within this call, mirroring the
    // spec's stream-level Last-Event-ID buffer.
  };

  while (i < buffer.length) {
    let lineEnd = -1;
    let nextStart = -1;

    for (let j = i; j < buffer.length; j++) {
      const c = buffer.charCodeAt(j);
      if (c === 10 /* \n */) {
        lineEnd = j;
        nextStart = j + 1;
        break;
      }
      if (c === 13 /* \r */) {
        if (j + 1 >= buffer.length) {
          // Could be the first half of a CRLF still in flight.
          return { frames, rest: buffer.slice(consumed) };
        }
        lineEnd = j;
        nextStart = buffer.charCodeAt(j + 1) === 10 ? j + 2 : j + 1;
        break;
      }
    }

    if (lineEnd === -1) break; // Incomplete line.

    const line = buffer.slice(i, lineEnd);
    i = nextStart;

    if (line.length === 0) {
      dispatch();
      consumed = i;
      continue;
    }
    if (line.charCodeAt(0) === 58 /* : */) continue; // Comment / keep-alive.

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.charCodeAt(0) === 32 /* space */) value = value.slice(1);

    if (field === 'event') {
      eventType = value;
    } else if (field === 'data') {
      data = data === null ? value + '\n' : data + value + '\n';
    } else if (field === 'id') {
      // A NUL in the id is ignored rather than stored.
      if (value.indexOf('\u0000') === -1) id = value;
    } else if (field === 'retry') {
      if (/^\d+$/.test(value)) retry = parseInt(value, 10);
    }
    // Unknown fields are ignored, per spec.
  }

  return { frames, rest: buffer.slice(consumed) };
}

// ============================================================================
// Delimited text
// ============================================================================

export interface DelimitedResult {
  messages: string[];
  rest: string;
}

/**
 * Splits `buffer` on `delimiter`, keeping the trailing incomplete piece in `rest`.
 *
 * An empty delimiter means "there are no message boundaries" — everything keeps
 * accumulating. That is the mode an AI token stream wants: the useful output is the
 * growing text, not a list of messages.
 */
export function splitDelimited(buffer: string, delimiter: string): DelimitedResult {
  if (!delimiter) return { messages: [], rest: buffer };
  const parts = buffer.split(delimiter);
  const rest = parts.pop() as string;
  return { messages: parts, rest };
}

// ============================================================================
// Incremental JSON
// ============================================================================

export interface JsonScanResult {
  /** Complete top-level values, in order. */
  values: unknown[];
  /** The unparsed tail — an incomplete value, or ''. */
  rest: string;
  /** One entry per value that scanned as complete but failed `JSON.parse`. */
  errors: string[];
}

export interface JsonScanOptions {
  /**
   * Treat top-level `[`, `]` and `,` as framing rather than data, so a JSON array
   * arriving over a stream yields its elements as they complete. Default `true`.
   *
   * Set `false` when the whole document is the value you want (`'single'` format).
   */
  arrayFraming?: boolean;
}

/**
 * Extracts every complete top-level JSON value from `buffer`.
 *
 * This replaces the phase-3.5 spec's "try `JSON.parse(buffer)`, else try
 * `JSON.parse(buffer + ']')`" approach, which reports success on truncated data and
 * fails outright when a chunk boundary lands inside a string or a nested object. A
 * real scanner is barely longer and is correct at every boundary: it tracks string
 * state and escapes, counts brace/bracket depth, and simply stops when a value is
 * unterminated.
 *
 * With `arrayFraming` (the default) it handles NDJSON, whitespace-separated
 * concatenated JSON, and a streamed JSON array with one implementation — the three
 * shapes an agent backend actually emits.
 *
 * A value that scans as complete but does not parse is reported in `errors` and
 * skipped, so one bad record cannot stall the stream forever.
 */
export function scanJsonValues(buffer: string, options?: JsonScanOptions): JsonScanResult {
  const arrayFraming = options?.arrayFraming !== false;
  const values: unknown[] = [];
  const errors: string[] = [];

  let i = 0;
  while (i < buffer.length) {
    // Skip whitespace, and the punctuation that frames a stream of values.
    while (i < buffer.length) {
      const c = buffer[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
      else if (arrayFraming && (c === ',' || c === '[' || c === ']')) i++;
      else break;
    }
    if (i >= buffer.length) return { values, rest: '', errors };

    const end = scanOneValue(buffer, i);
    if (end === -1) return { values, rest: buffer.slice(i), errors };

    const slice = buffer.slice(i, end);
    try {
      values.push(JSON.parse(slice));
    } catch (e) {
      errors.push('Could not parse JSON value: ' + describeError(e));
    }
    i = end;
  }

  return { values, rest: '', errors };
}

/**
 * Returns the index just past the JSON value starting at `start`, or -1 if the value
 * is not yet complete in `buffer`.
 */
function scanOneValue(buffer: string, start: number): number {
  const first = buffer[start];

  if (first === '{' || first === '[') {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = start; j < buffer.length; j++) {
      const c = buffer[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') {
        depth--;
        if (depth === 0) return j + 1;
      }
    }
    return -1;
  }

  if (first === '"') {
    let escaped = false;
    for (let j = start + 1; j < buffer.length; j++) {
      const c = buffer[j];
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') return j + 1;
    }
    return -1;
  }

  // A scalar (number / true / false / null) is only complete once something that
  // cannot belong to it has arrived. `12` at the end of a buffer might still become
  // `123`, so an unterminated scalar waits.
  for (let j = start; j < buffer.length; j++) {
    const c = buffer[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',' || c === '}' || c === ']') {
      return j;
    }
  }
  return -1;
}

/**
 * Result of a parse attempt.
 *
 * Written with optional fields rather than as a `{ok:true}|{ok:false}` union because
 * this package compiles with `strictNullChecks` off, under which TypeScript does not
 * narrow a discriminated union by a boolean discriminant — the union compiles here but
 * every consumer would need a cast, which is worse than a slightly looser type.
 */
export interface JsonParseOutcome {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/** `JSON.parse` that reports rather than throws. */
export function tryParseJson(text: string): JsonParseOutcome {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

/**
 * Parses `text` as JSON if it can, and hands back the original string if it cannot.
 *
 * This is what a stream consumer wants from a `data:` payload: agent backends mix
 * JSON frames and bare text (`data: [DONE]`) on the same stream, and a node output
 * that went `undefined` on the text ones would be useless.
 */
export function parseJsonOrText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return text;
  const first = trimmed.charCodeAt(0);
  // Cheap gate: only bother when it could plausibly be JSON. Avoids paying for a
  // thrown exception on every token of a plain-text stream.
  const couldBeJson =
    first === 123 /* { */ ||
    first === 91 /* [ */ ||
    first === 34 /* " */ ||
    first === 45 /* - */ ||
    (first >= 48 && first <= 57) /* 0-9 */ ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null';
  if (!couldBeJson) return text;
  const outcome = tryParseJson(trimmed);
  return outcome.ok ? outcome.value : text;
}

// ============================================================================
// Pattern extraction
// ============================================================================

export interface PatternResult {
  /** False only when the pattern itself is invalid. */
  ok: boolean;
  error?: string;
  /** First match, or null when nothing matched. */
  match: string | null;
  /** Every match when `all`, otherwise the first (or empty). */
  matches: string[];
  /** Capture groups of the first match. Unmatched optional groups become ''. */
  groups: string[];
  /** Named capture groups of the first match. */
  namedGroups: Record<string, string>;
}

export interface PatternOptions {
  /** Collect every match instead of just the first. */
  all?: boolean;
  /** Extra regex flags (`i`, `m`, `s`, `u`). `g` is managed by `all`. */
  flags?: string;
}

/**
 * Runs `pattern` over `text` and reports matches, without ever throwing.
 *
 * An invalid regex is a first-class result (`ok: false`) rather than an exception,
 * because the pattern is app-author input and a graph cannot catch a throw. Note
 * that a catastrophically backtracking pattern is still the author's problem: this
 * runs the platform regex engine and cannot bound it.
 */
export function extractPattern(text: string, pattern: string, options?: PatternOptions): PatternResult {
  const empty: PatternResult = { ok: true, match: null, matches: [], groups: [], namedGroups: {} };
  if (!pattern) return empty;

  // Strip a user-supplied `g`; `all` is the switch that controls it, and a stray `g`
  // on a non-global call would make `match` behave differently than documented.
  const requested = (options?.flags || '').replace(/[^imsuy]/g, '');
  const flags = options?.all ? requested + 'g' : requested;

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    return { ok: false, error: describeError(e), match: null, matches: [], groups: [], namedGroups: {} };
  }

  if (typeof text !== 'string' || text === '') return empty;

  if (options?.all) {
    const all = Array.from(text.matchAll(regex));
    if (all.length === 0) return empty;
    const first = all[0];
    return {
      ok: true,
      match: first[0],
      matches: all.map((m) => m[0]),
      groups: captureGroups(first),
      namedGroups: namedCaptureGroups(first)
    };
  }

  const m = regex.exec(text);
  if (!m) return empty;
  return {
    ok: true,
    match: m[0],
    matches: [m[0]],
    groups: captureGroups(m),
    namedGroups: namedCaptureGroups(m)
  };
}

function captureGroups(m: RegExpMatchArray): string[] {
  return Array.prototype.slice.call(m, 1).map((g: string | undefined) => (g === undefined ? '' : g));
}

function namedCaptureGroups(m: RegExpMatchArray): Record<string, string> {
  const out: Record<string, string> = {};
  const named = m.groups;
  if (named) {
    for (const key in named) out[key] = named[key] === undefined ? '' : (named[key] as string);
  }
  return out;
}

// ============================================================================
// Buffer housekeeping
// ============================================================================

/**
 * UTF-8 byte length of `text`.
 *
 * Computed rather than measured with `Blob` (which the phase-3.5 spec used): the
 * runtime is framework-neutral and also runs under SSR in Node, where `Blob` has
 * only existed globally since Node 18 and where allocating one per output read
 * would be absurd anyway.
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: a well-formed pair is one 4-byte code point.
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3; // Lone surrogate; WHATWG encodes it as U+FFFD (3 bytes).
      }
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Caps `text` at `maxLength` characters by dropping from the *front*.
 *
 * Streams are newest-interesting, so an overflowing accumulator keeps the tail. The
 * caller is expected to tell the app author this happened rather than hide it.
 */
export function truncateHead(text: string, maxLength: number): { text: string; dropped: number } {
  if (!(maxLength > 0) || text.length <= maxLength) return { text, dropped: 0 };
  return { text: text.slice(text.length - maxLength), dropped: text.length - maxLength };
}

// ============================================================================
// Reading a field out of a parsed payload
// ============================================================================

/**
 * Splits a dot/bracket path into its segments.
 *
 * `choices.0.delta.content` and `choices[0].delta.content` both give
 * `['choices','0','delta','content']`. An empty path gives `[]`.
 */
export function splitPath(path: string): string[] {
  if (!path) return [];
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
}

/**
 * Reads `path` out of `root`, or `undefined` when any step of it is missing.
 *
 * Deliberately total: an agent stream's frames are not uniform — the first frame of an
 * OpenAI-style stream carries `role` and no `content`, the last carries neither — so a
 * path that does not resolve is an ordinary outcome and must not throw. Nothing is
 * evaluated; this is plain property access on objects and arrays only, which is what
 * makes it safe to point at data that arrived over a socket.
 *
 * `__proto__`, `constructor` and `prototype` resolve to `undefined` rather than to the
 * language's own internals. Reads cannot pollute anything, but a path is a value like any
 * other and may itself arrive over a connection, so it gets no reach the author did not
 * obviously intend.
 *
 * An empty path returns `root`, so a caller can treat "no path configured" as identity.
 */
export function valueAtPath(root: unknown, path: string): unknown {
  const segments = splitPath(path);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    if (segment === '__proto__' || segment === 'constructor' || segment === 'prototype') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * The text a stream node should put on a guaranteed-string output.
 *
 * `raw` is the payload exactly as it arrived and `parsed` is the same payload after
 * `parseJsonOrText`. With no `path` the answer is `raw` — a plain-text token stream needs
 * no extraction. With a `path` the answer is that field of the parsed payload, and
 * anything that is not a primitive (a missing field, a `[DONE]` sentinel that never
 * parsed, an object) becomes `''` rather than `[object Object]`: an empty chunk is
 * something every consumer in this family already ignores, and a stringified object is
 * something none of them can recover from.
 */
export function textForPath(raw: string, parsed: unknown, path: string): string {
  if (!path) return raw;
  const value = valueAtPath(parsed, path);
  const kind = typeof value;
  if (kind === 'string') return value as string;
  if (kind === 'number' || kind === 'boolean') return String(value);
  return '';
}

/** Human-readable message from an unknown thrown value. */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return String(e);
  } catch {
    return 'Unknown error';
  }
}
