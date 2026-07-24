/**
 * Line-oriented stream helpers shared by the HTTP providers.
 *
 * OpenAI-shaped endpoints send SSE (`data: {...}` lines); Ollama sends NDJSON
 * (one JSON object per line). Both boil down to "decode the body, split on
 * newlines, hand me complete lines" — which is what these do, including the
 * chunk boundary case where a line arrives split across two reads.
 *
 * @module AiAssistant/client/providers/stream-utils
 */

/**
 * Yield complete lines from a byte stream. Handles CRLF, and holds back a
 * trailing partial line until the chunk that completes it arrives.
 */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
        buffer = buffer.slice(newlineIndex + 1);
        yield line;
      }
    }

    buffer += decoder.decode();
    if (buffer.length > 0) {
      yield buffer.replace(/\r$/, '');
    }
  } finally {
    // Releasing matters on abort: without it the underlying socket can be held
    // open until GC, which shows up as a stuck request after the user cancels.
    reader.releaseLock();
  }
}

/**
 * Yield the payload of each SSE `data:` line, skipping comments, other fields
 * and the `[DONE]` sentinel.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  for await (const line of readLines(body)) {
    if (!line || line.startsWith(':')) continue;
    if (!line.startsWith('data:')) continue;

    const data = line.slice('data:'.length).trim();
    if (data === '[DONE]') return;
    if (data.length === 0) continue;

    yield data;
  }
}

/** Yield each non-empty line of an NDJSON stream. */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  for await (const line of readLines(body)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) yield trimmed;
  }
}

/**
 * Parse tool-call arguments that arrived as a JSON string.
 *
 * Providers stream arguments as text fragments; a truncated or malformed
 * result must not take down the whole response, so this degrades to an empty
 * object and lets the caller decide.
 */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    console.warn('[ai] Failed to parse tool-call arguments as JSON:', raw);
    return {};
  }
}
