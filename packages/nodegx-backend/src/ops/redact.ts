/**
 * The service's one redaction entry point (BAK-009).
 *
 * There is exactly ONE rule for what counts as a secret, and it does not live
 * here: it is `SENSITIVE_KEY_PATTERN` in the shared execution-history scrubber
 * (`@cloud-runtime/execution-history`), which WF-004 already established as
 * "shared by the editor and the standalone backend service so both log with the
 * same redaction rules". This module is the backend-facing door to it, not a
 * second implementation — a second one would drift, and the drift would be
 * invisible until a credential turned up in a log.
 *
 * The convention this task adds is greppable and enforced:
 *
 *   * anything reaching a log line, an audit entry, or an error body goes
 *     through `redact()` first;
 *   * `tests/ops-redaction.test.ts` plants a distinct secret in EVERY real
 *     loggable config shape (security, secrets.json, SMTP, S3, webhook
 *     secrets, request headers) and asserts none of them survive.
 *
 * @module nodegx-backend/ops/redact
 */

// Bundled from noodl-viewer-cloud/src by esbuild (test-time: jest mapper) —
// same black-box treatment as ExecutionStore's require of the same package.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const scrub = require('@cloud-runtime/execution-history') as {
  scrubValue(value: unknown, depth?: number): unknown;
  scrubHeaders(headers: Record<string, unknown> | undefined | null): Record<string, unknown>;
};

export const REDACTED = '[REDACTED]';

/**
 * A logging-safe copy of `value`: any property whose NAME says it holds a
 * credential is replaced, at any depth.
 *
 * Key-based, not value-based, and that is a deliberate limit worth stating: a
 * secret stored under an innocent name (`{ note: "the password is hunter2" }`)
 * is not caught. The mitigation is that nothing constructs log fields out of
 * arbitrary user text without naming them — and the planted-secret test covers
 * every shape the service itself logs.
 */
export function redact<T>(value: T): unknown {
  return scrub.scrubValue(value);
}

/** A logging-safe copy of request headers (Authorization, cookies, API keys). */
export function redactHeaders(headers: Record<string, unknown> | undefined | null): Record<string, unknown> {
  return scrub.scrubHeaders(headers);
}

/**
 * A one-line, logging-safe rendering of an arbitrary value — used where a log
 * field must be a string (error messages, CLI notices). Long values are
 * truncated, because a log line that scrolls a terminal is a log line nobody
 * reads.
 */
export function redactToString(value: unknown, maxLength = 500): string {
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(redact(value));
  } catch {
    text = String(value);
  }
  if (text === undefined) text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…[truncated]` : text;
}
