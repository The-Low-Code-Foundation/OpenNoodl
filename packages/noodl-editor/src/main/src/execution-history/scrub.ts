/**
 * Redact secrets before request metadata reaches the execution-history store.
 *
 * WF-006 wires logging in at the run boundary (`WorkflowRunner.run`), which
 * only sees the raw HTTP request the client sent to `/functions/:name` —
 * headers and body, verbatim. Neither should ever be written to disk (or to
 * the in-memory fallback) unscrubbed.
 */

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'proxy-authorization'
]);

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|api[-_]?key|authorization|credential/i;

export function scrubHeaders(headers: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return out;
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : scrubValue(v, depth + 1);
    }
    return out;
  }

  return value;
}

export interface ScrubbedRequestSummary {
  headers: Record<string, unknown>;
  bodySize: number;
  body?: unknown;
}

/**
 * Build a logging-safe summary of an inbound function-call request.
 * `request.body` is the JSON-stringified body `LocalBackendServer` builds for
 * `CloudRunner`; it's re-parsed here only to scrub it, and the parsed/scrubbed
 * form (never the raw string) is what gets stored.
 */
export function scrubRequestForLogging(request: {
  body?: string;
  headers?: Record<string, unknown>;
}): ScrubbedRequestSummary {
  const bodySize = typeof request.body === 'string' ? request.body.length : 0;

  let body: unknown;
  if (request.body) {
    try {
      body = scrubValue(JSON.parse(request.body));
    } catch {
      body = '[unparsable body]';
    }
  }

  return {
    headers: scrubHeaders(request.headers),
    bodySize,
    body
  };
}
