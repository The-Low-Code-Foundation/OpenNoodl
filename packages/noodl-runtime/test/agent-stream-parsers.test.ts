/**
 * AGENT-007 — the pure stream parser layer.
 *
 * Everything here is a total function, so the interesting cases are the ones where a
 * chunk boundary lands somewhere awkward: mid-line, mid-frame, inside a JSON string,
 * between the CR and the LF. Those are exactly the cases a happy-path test misses and
 * a real stream hits within seconds.
 */

import {
  extractPattern,
  parseJsonOrText,
  parseSseChunk,
  scanJsonValues,
  splitDelimited,
  truncateHead,
  tryParseJson,
  utf8ByteLength
} from '../src/nodes/std-library/agent/stream-parsers';

/** Feeds `text` one character at a time, to prove every boundary is safe. */
function drip(text: string) {
  let buffer = '';
  const frames = [];
  for (const ch of text) {
    buffer += ch;
    const result = parseSseChunk(buffer);
    buffer = result.rest;
    frames.push(...result.frames);
  }
  return { frames, rest: buffer };
}

describe('parseSseChunk', () => {
  it('dispatches an event on a blank line and joins multiple data lines', () => {
    const { frames, rest } = parseSseChunk('data: one\ndata: two\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'one\ntwo', id: '' }]);
    expect(rest).toBe('');
  });

  it('reads event, id and retry fields', () => {
    const { frames } = parseSseChunk('event: token\nid: 42\nretry: 2500\ndata: hi\n\n');
    expect(frames).toEqual([{ event: 'token', data: 'hi', id: '42', retry: 2500 }]);
  });

  it('keeps a partial event in rest and completes it on the next chunk', () => {
    const first = parseSseChunk('data: par');
    expect(first.frames).toEqual([]);
    expect(first.rest).toBe('data: par');

    const second = parseSseChunk(first.rest + 'tial\n\n');
    expect(second.frames).toEqual([{ event: 'message', data: 'partial', id: '' }]);
    expect(second.rest).toBe('');
  });

  it('survives being fed one character at a time', () => {
    const stream = 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\n';
    const { frames, rest } = drip(stream);
    expect(frames).toEqual([
      { event: 'a', data: '1', id: '' },
      { event: 'b', data: '2', id: '' }
    ]);
    expect(rest).toBe('');
  });

  it('does not consume a trailing lone CR, which may be half a CRLF', () => {
    const first = parseSseChunk('data: x\r');
    expect(first.frames).toEqual([]);
    expect(first.rest).toBe('data: x\r');

    const second = parseSseChunk(first.rest + '\n\r\n');
    expect(second.frames).toEqual([{ event: 'message', data: 'x', id: '' }]);
  });

  it('accepts CRLF and bare CR line endings', () => {
    expect(parseSseChunk('data: crlf\r\n\r\n').frames).toEqual([{ event: 'message', data: 'crlf', id: '' }]);

    // With bare CRs the dispatching blank line is `\r\r`, and the *second* CR is only
    // known to be a line ending once a following character rules out a CRLF — so this
    // dispatches while the trailing CR of the next event still waits.
    const bareCr = parseSseChunk('data: cr\r\rdata: next\r');
    expect(bareCr.frames).toEqual([{ event: 'message', data: 'cr', id: '' }]);
    expect(bareCr.rest).toBe('data: next\r');
  });

  it('ignores comment lines, which is how servers keep a connection alive', () => {
    const { frames } = parseSseChunk(': ping\n: ping\ndata: real\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'real', id: '' }]);
  });

  it('strips exactly one space after the colon and handles a field with no colon', () => {
    expect(parseSseChunk('data:  two spaces\n\n').frames[0].data).toBe(' two spaces');
    // A bare `data` line is a data field with an empty value.
    expect(parseSseChunk('data\n\n').frames[0].data).toBe('');
  });

  it('does not dispatch an event that carried no data field', () => {
    const { frames } = parseSseChunk('event: nothing\n\ndata: something\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'something', id: '' }]);
  });

  it('carries the last event id forward across events within a chunk', () => {
    const { frames } = parseSseChunk('id: 7\ndata: a\n\ndata: b\n\n');
    expect(frames.map((f) => f.id)).toEqual(['7', '7']);
  });

  it('strips a leading byte-order mark', () => {
    const { frames } = parseSseChunk('﻿data: bom\n\n');
    expect(frames).toEqual([{ event: 'message', data: 'bom', id: '' }]);
  });

  it('handles a data payload containing blank-looking JSON without splitting it', () => {
    const { frames } = parseSseChunk('data: {"text":"line1\\nline2"}\n\n');
    expect(JSON.parse(frames[0].data)).toEqual({ text: 'line1\nline2' });
  });
});

describe('splitDelimited', () => {
  it('splits on the delimiter and holds the incomplete tail', () => {
    expect(splitDelimited('a\nb\nc', '\n')).toEqual({ messages: ['a', 'b'], rest: 'c' });
  });

  it('treats an empty delimiter as "no boundaries" so everything accumulates', () => {
    expect(splitDelimited('abc', '')).toEqual({ messages: [], rest: 'abc' });
  });

  it('yields an empty message for a repeated delimiter rather than swallowing it', () => {
    expect(splitDelimited('a\n\nb\n', '\n')).toEqual({ messages: ['a', '', 'b'], rest: '' });
  });
});

describe('scanJsonValues', () => {
  it('extracts concatenated objects with no separator', () => {
    const result = scanJsonValues('{"a":1}{"b":2}');
    expect(result.values).toEqual([{ a: 1 }, { b: 2 }]);
    expect(result.rest).toBe('');
  });

  it('yields array elements as they complete when array framing is on', () => {
    const result = scanJsonValues('[{"a":1},{"b":2}');
    expect(result.values).toEqual([{ a: 1 }, { b: 2 }]);
    expect(result.rest).toBe('');
  });

  it('returns the whole array as one value when array framing is off', () => {
    const result = scanJsonValues('[1,2,3]', { arrayFraming: false });
    expect(result.values).toEqual([[1, 2, 3]]);
  });

  it('holds an incomplete object in rest', () => {
    const result = scanJsonValues('{"a":1}{"b":');
    expect(result.values).toEqual([{ a: 1 }]);
    expect(result.rest).toBe('{"b":');
  });

  it('is not fooled by braces or brackets inside strings', () => {
    const result = scanJsonValues('{"a":"}{[]"}{"b":2}');
    expect(result.values).toEqual([{ a: '}{[]' }, { b: 2 }]);
  });

  it('is not fooled by an escaped quote inside a string', () => {
    const result = scanJsonValues('{"a":"say \\"hi\\""}');
    expect(result.values).toEqual([{ a: 'say "hi"' }]);
  });

  it('reassembles a value split across arbitrary chunk boundaries', () => {
    const doc = '{"role":"assistant","content":"a }{ b"}\n{"role":"user","content":"x"}\n';
    for (let cut = 1; cut < doc.length; cut++) {
      const first = scanJsonValues(doc.slice(0, cut));
      const second = scanJsonValues(first.rest + doc.slice(cut));
      expect(first.values.concat(second.values)).toEqual([
        { role: 'assistant', content: 'a }{ b' },
        { role: 'user', content: 'x' }
      ]);
    }
  });

  it('waits for a scalar to be terminated before accepting it', () => {
    // `12` at the end of a buffer might still become `123`.
    expect(scanJsonValues('12')).toEqual({ values: [], rest: '12', errors: [] });
    expect(scanJsonValues('12 ').values).toEqual([12]);

    // Same rule for keywords: the final `null` has nothing after it, so it waits.
    const partial = scanJsonValues('true,false,null');
    expect(partial.values).toEqual([true, false]);
    expect(partial.rest).toBe('null');
    expect(scanJsonValues('true,false,null\n').values).toEqual([true, false, null]);
  });

  it('reports a complete-but-invalid value and moves past it instead of stalling', () => {
    const result = scanJsonValues('{"a":}{"b":2}');
    expect(result.errors.length).toBe(1);
    expect(result.values).toEqual([{ b: 2 }]);
  });

  it('handles a deeply nested value', () => {
    const nested = JSON.stringify({ a: { b: { c: [1, { d: 'e' }] } } });
    expect(scanJsonValues(nested, { arrayFraming: false }).values).toEqual([JSON.parse(nested)]);
  });
});

describe('tryParseJson / parseJsonOrText', () => {
  it('reports rather than throws', () => {
    expect(tryParseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    const bad = tryParseJson('{oops');
    expect(bad.ok).toBe(false);
    expect(typeof bad.error).toBe('string');
  });

  it('hands back plain text unchanged, including agent sentinels', () => {
    expect(parseJsonOrText('[DONE]')).toBe('[DONE]');
    expect(parseJsonOrText('hello world')).toBe('hello world');
    expect(parseJsonOrText('')).toBe('');
  });

  it('parses JSON payloads', () => {
    expect(parseJsonOrText(' {"a":1} ')).toEqual({ a: 1 });
    expect(parseJsonOrText('42')).toBe(42);
    expect(parseJsonOrText('true')).toBe(true);
  });

  it('falls back to text when something JSON-shaped does not parse', () => {
    expect(parseJsonOrText('{"a":')).toBe('{"a":');
  });
});

describe('extractPattern', () => {
  it('extracts the first match and its capture groups', () => {
    const result = extractPattern('Processing... 45% complete', '(\\d+)%');
    expect(result.ok).toBe(true);
    expect(result.match).toBe('45%');
    expect(result.groups).toEqual(['45']);
  });

  it('extracts every match when asked', () => {
    const result = extractPattern('a1 b2 c3', '[a-z](\\d)', { all: true });
    expect(result.matches).toEqual(['a1', 'b2', 'c3']);
    expect(result.groups).toEqual(['1']);
  });

  it('returns named capture groups', () => {
    const result = extractPattern('tool=search status=ok', 'tool=(?<tool>\\w+)');
    expect(result.namedGroups).toEqual({ tool: 'search' });
  });

  it('turns an unmatched optional group into an empty string, not a hole', () => {
    const result = extractPattern('ab', '(a)(z)?(b)');
    expect(result.groups).toEqual(['a', '', 'b']);
  });

  it('reports an invalid pattern instead of throwing', () => {
    const result = extractPattern('anything', '([unclosed');
    expect(result.ok).toBe(false);
    expect(result.match).toBeNull();
    expect(typeof result.error).toBe('string');
  });

  it('honours extra flags and ignores a user-supplied g', () => {
    expect(extractPattern('ABC', 'abc', { flags: 'i' }).match).toBe('ABC');
    // A stray `g` would make `exec` stateful across calls; it is stripped.
    const result = extractPattern('aa', 'a', { flags: 'g' });
    expect(result.matches).toEqual(['a']);
  });

  it('reports no match without erroring', () => {
    const result = extractPattern('nothing here', '\\d+');
    expect(result.ok).toBe(true);
    expect(result.match).toBeNull();
    expect(result.matches).toEqual([]);
  });
});

describe('buffer housekeeping', () => {
  it('counts UTF-8 bytes, including astral characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
    expect(utf8ByteLength('')).toBe(0);
  });

  it('truncates from the front, keeping the newest text', () => {
    expect(truncateHead('abcdef', 3)).toEqual({ text: 'def', dropped: 3 });
    expect(truncateHead('abc', 10)).toEqual({ text: 'abc', dropped: 0 });
    expect(truncateHead('abc', 0)).toEqual({ text: 'abc', dropped: 0 });
  });
});
