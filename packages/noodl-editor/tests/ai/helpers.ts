/**
 * Fixture helpers for the AI provider specs.
 *
 * Everything here is offline: no spec in this folder makes a network call.
 */

import { AiClientError } from '../../src/editor/src/models/AiAssistant/client/types';

/** Build a `Response` whose body streams the given chunks, in order. */
export function streamingResponse(chunks: string[], init?: { status?: number; headers?: HeadersInit }): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });

  return new Response(body, {
    status: init?.status ?? 200,
    headers: init?.headers ?? { 'Content-Type': 'text/event-stream' }
  });
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function textResponse(text: string, status: number): Response {
  return new Response(text, { status });
}

export interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
  /**
   * The request body, JSON-parsed. Every provider under test sends JSON, so an
   * unparsable body means the spec is asserting against something unintended
   * and is left `undefined` rather than smuggled through as text.
   */
  body: Record<string, unknown> | undefined;
}

/**
 * A `fetch` stand-in that records what it was called with and replays queued
 * responses in order.
 */
export function recordingFetch(responses: Response[]): {
  fetchImpl: typeof fetch;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const queue = [...responses];

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let body: Record<string, unknown> | undefined;
    try {
      const parsed = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (parsed && typeof parsed === 'object') body = parsed;
    } catch {
      body = undefined;
    }

    requests.push({ url: String(input), init, body });

    const next = queue.shift();
    if (!next) throw new Error('recordingFetch: no queued response left');
    return next;
  }) as unknown as typeof fetch;

  return { fetchImpl, requests };
}

/** Wrap an array of events as the async iterable the Anthropic SDK returns. */
export async function* asyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

/**
 * Run a call that must reject with an `AiClientError`, and hand the error back
 * typed so the assertions that follow can read `status` and `message` without
 * a cast. Fails loudly when the call resolves, which a bare try/catch does not.
 */
export async function expectAiClientError(call: () => Promise<unknown>): Promise<AiClientError> {
  try {
    await call();
  } catch (error) {
    if (error instanceof AiClientError) return error;
    throw new Error(`Expected an AiClientError, but got: ${String(error)}`);
  }
  throw new Error('Expected an AiClientError, but the call resolved.');
}
