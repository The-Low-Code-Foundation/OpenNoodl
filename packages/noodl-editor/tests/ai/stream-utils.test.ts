/**
 * AIX-001: line/SSE/NDJSON stream parsing.
 *
 * The chunk-boundary cases are the ones that bite in production: a provider is
 * free to split a line anywhere, and losing the tail silently truncates
 * generated code.
 */

import {
  parseToolArguments,
  readLines,
  readNdjson,
  readSseData
} from '../../src/editor/src/models/AiAssistant/client/providers/stream-utils';

import { streamingResponse } from './helpers';

async function collect<T>(iterator: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterator) out.push(item);
  return out;
}

function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  return streamingResponse(chunks).body;
}

describe('readLines', () => {
  it('splits on newlines', async () => {
    expect(await collect(readLines(bodyOf(['a\nb\nc\n'])))).toEqual(['a', 'b', 'c']);
  });

  it('reassembles a line split across chunk boundaries', async () => {
    expect(await collect(readLines(bodyOf(['hel', 'lo\nwor', 'ld\n'])))).toEqual(['hello', 'world']);
  });

  it('yields a trailing line that has no newline', async () => {
    expect(await collect(readLines(bodyOf(['a\nb'])))).toEqual(['a', 'b']);
  });

  it('strips carriage returns', async () => {
    expect(await collect(readLines(bodyOf(['a\r\nb\r\n'])))).toEqual(['a', 'b']);
  });
});

describe('readSseData', () => {
  it('yields data payloads and skips comments and blank lines', async () => {
    const chunks = [': keepalive\n', 'data: {"a":1}\n', '\n', 'data: {"a":2}\n'];
    expect(await collect(readSseData(bodyOf(chunks)))).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('stops at the [DONE] sentinel', async () => {
    const chunks = ['data: {"a":1}\n', 'data: [DONE]\n', 'data: {"a":2}\n'];
    expect(await collect(readSseData(bodyOf(chunks)))).toEqual(['{"a":1}']);
  });

  it('handles a data line split mid-JSON', async () => {
    expect(await collect(readSseData(bodyOf(['data: {"te', 'xt":"hi"}\n'])))).toEqual(['{"text":"hi"}']);
  });
});

describe('readNdjson', () => {
  it('yields one entry per non-empty line', async () => {
    expect(await collect(readNdjson(bodyOf(['{"a":1}\n', '\n', '{"a":2}\n'])))).toEqual(['{"a":1}', '{"a":2}']);
  });
});

describe('parseToolArguments', () => {
  it('parses a JSON object', () => {
    expect(parseToolArguments('{"city":"Malmo"}')).toEqual({ city: 'Malmo' });
  });

  it('returns an empty object for empty input', () => {
    expect(parseToolArguments('')).toEqual({});
    expect(parseToolArguments('   ')).toEqual({});
  });

  it('degrades to an empty object rather than throwing on truncated JSON', () => {
    // A stream cut short must not take down the whole response.
    expect(parseToolArguments('{"city":"Mal')).toEqual({});
  });

  it('rejects non-object JSON', () => {
    expect(parseToolArguments('"a string"')).toEqual({});
    expect(parseToolArguments('42')).toEqual({});
  });
});
