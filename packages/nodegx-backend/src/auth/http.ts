/**
 * The tiny outbound HTTP client the auth subsystem uses to talk to identity
 * providers (BAK-004).
 *
 * Node 22 has a global `fetch`, so this is not a client so much as a set of
 * guard rails around one. Every call to a provider is (a) time-bounded, (b)
 * size-bounded, and (c) turned into an error message that names the provider
 * and the endpoint — because when a sign-in fails, the operator is looking at a
 * browser redirect that ended somewhere unhelpful and the server log is the
 * only place the real reason can be.
 *
 * Deliberately NOT here: retries. A token exchange is single-use — the
 * authorization code is consumed by the first attempt whether or not we read
 * the response — so retrying it produces a confusing second failure rather than
 * a success.
 *
 * @module nodegx-backend/auth/http
 */

/** Providers are on the internet; 10s is generous for a token endpoint and short enough to fail visibly. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Response cap. Discovery documents and JWKS are a few KB; a token response is
 * smaller. A megabyte is three orders of magnitude of headroom and still bounds
 * what a hostile or broken endpoint can make this process allocate.
 */
const MAX_BODY_BYTES = 1024 * 1024;

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'ProviderHttpError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  /** What this call is for, in operator language: "discovery document", "token exchange". */
  what: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Form-encoded body (token endpoints speak `application/x-www-form-urlencoded`). */
  form?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * One request, returning parsed JSON.
 *
 * A non-2xx is an error carrying the body, because OAuth error responses put
 * the actionable part (`invalid_client`, `redirect_uri_mismatch`) in the body
 * and nothing useful in the status.
 */
export async function providerJson<T = Record<string, unknown>>(url: string, options: RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(options.headers || {})
      },
      body: options.form ? new URLSearchParams(options.form).toString() : undefined,
      signal: controller.signal,
      // A provider that answers a token exchange with a redirect is
      // misconfigured, and following it could send our client secret somewhere
      // it was never meant to go.
      redirect: 'error'
    });
  } catch (e) {
    const reason = e instanceof Error && e.name === 'AbortError' ? `timed out after ${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms` : e instanceof Error ? e.message : String(e);
    throw new Error(`Could not reach the identity provider for the ${options.what} (${url}): ${reason}`);
  } finally {
    clearTimeout(timeout);
  }

  const text = await readBounded(response, url, options.what);

  if (!response.ok) {
    throw new ProviderHttpError(
      `The identity provider refused the ${options.what} (${url}) with HTTP ${response.status}: ${text.slice(0, 500)}`,
      response.status,
      text
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `The identity provider's ${options.what} (${url}) was not JSON. First 200 characters: ${text.slice(0, 200)}`
    );
  }
}

/**
 * Read a response body, refusing one that exceeds the cap. Streamed rather than
 * `response.text()` so an endless body is cut off instead of buffered whole.
 */
async function readBounded(response: Response, url: string, what: string): Promise<string> {
  const declared = Number(response.headers.get('content-length') || '0');
  if (declared > MAX_BODY_BYTES) {
    throw new Error(`The identity provider's ${what} (${url}) declared ${declared} bytes, over the ${MAX_BODY_BYTES}-byte limit.`);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error(`The identity provider's ${what} (${url}) exceeded the ${MAX_BODY_BYTES}-byte response limit.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
}
