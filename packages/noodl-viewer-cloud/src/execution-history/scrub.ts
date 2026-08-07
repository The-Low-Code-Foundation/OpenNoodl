/**
 * Redact secrets before request metadata reaches the execution-history store.
 *
 * WF-006 wires logging in at the run boundary (`WorkflowRunner.run`), which
 * only sees the raw HTTP request the client sent to `/functions/:name` —
 * headers and body, verbatim. Neither should ever be written to disk (or to
 * the in-memory fallback) unscrubbed.
 *
 * BAK-009 made this the ONE redaction rule for the whole backend rather than
 * writing a second one: `nodegx-backend/ops/redact` is a thin entry point over
 * `scrubValue`, so the structured request log, the audit trail and the
 * execution history all agree on what a secret looks like by construction. The
 * key pattern below therefore has to cover CONFIG shapes as well as request
 * bodies — S3 credentials, the signed-URL HMAC, the admin credential, SMTP
 * auth, per-hook webhook secrets. `nodegx-backend/tests/ops-redaction.test.ts`
 * plants a secret in each of those real shapes; narrowing this pattern fails
 * that test.
 */

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-nodegx-api-key',
  'x-parse-master-key',
  'x-parse-session-token',
  'proxy-authorization'
]);

/**
 * A key whose VALUE is a secret. Matched case-insensitively against key names
 * anywhere in the object graph.
 *
 * `key` on its own is deliberately absent — it appears in far too many
 * innocent shapes (`keys: [...]`, `sortKey`) and redacting all of them would
 * make logs useless, which is its own failure mode. The credential-bearing
 * spellings are enumerated instead: accessKeyId/secretAccessKey (S3),
 * signingKey/hmac (signed URLs), keyHash (a hashed API key — still not
 * something to print).
 */
export const SENSITIVE_KEY_PATTERN =
  /pass(word|wd)?|secret|token|api[-_]?key|access[-_]?key|signing[-_]?key|private[-_]?key|key[-_]?hash|hmac|authorization|credential|salt/i;

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
