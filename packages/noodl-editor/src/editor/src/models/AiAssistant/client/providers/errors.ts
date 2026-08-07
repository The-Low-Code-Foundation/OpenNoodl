/**
 * Reading fields off values that arrive untyped.
 *
 * A `catch` binding is `unknown` and providers throw whatever they like — the
 * SDK throws its own error classes, `fetch` throws a `DOMException` on abort,
 * and a gateway can hand back a plain string. `instanceof Error` is not enough:
 * an abort arrives as a `DOMException`, which is not an `Error` everywhere the
 * editor runs. So the fields are read structurally, and every reader returns
 * `undefined` rather than throwing when the shape is not what was expected.
 *
 * @module AiAssistant/client/providers/errors
 */

/** Narrow an untyped value — parsed JSON, a caught throwable — to something indexable. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The `name` of a caught throwable, when it has one. */
export function errorName(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.name === 'string' ? error.name : undefined;
}

/** The HTTP status a vendor SDK attached to a caught throwable, when it has one. */
export function errorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

/**
 * The most specific message available on a caught throwable.
 *
 * Vendor SDKs nest the server's own message under `error.error.message`, which
 * is the only place the actionable text lives ("model not found", "credit
 * balance too low"); `message` there is a generic status line.
 */
export function errorMessage(error: unknown): string {
  if (isRecord(error)) {
    const inner = isRecord(error.error) ? error.error.error : undefined;
    if (isRecord(inner) && typeof inner.message === 'string') return inner.message;
    if (typeof error.message === 'string') return error.message;
  }
  return String(error);
}

/**
 * Whether a caught throwable is the user cancelling.
 *
 * `AbortError` is what `fetch` raises; `APIUserAbortError` is the Anthropic
 * SDK's own. The signal is checked first because a stream can be cancelled
 * between reads, in which case nothing is thrown at all.
 */
export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const name = errorName(error);
  return name === 'AbortError' || name === 'APIUserAbortError';
}
