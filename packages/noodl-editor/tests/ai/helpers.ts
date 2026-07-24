/**
 * Fixture helpers for the AI provider specs.
 *
 * Everything here is offline: no spec in this folder makes a network call.
 */

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
  body: TSFixme;
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

  const fetchImpl = (async (input: TSFixme, init?: RequestInit) => {
    let body: TSFixme;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
    } catch {
      body = init?.body;
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
