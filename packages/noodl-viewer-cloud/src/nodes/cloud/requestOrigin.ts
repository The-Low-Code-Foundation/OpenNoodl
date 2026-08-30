/**
 * DEF-022 (phase 80, from phase 78's D34) — the address the calling app is served from,
 * derived from the request's own headers in ONE place.
 *
 * TPL-002 measured the gap by needing this and failing to find it: an email's link must be
 * absolute, and a graph had no way to learn its own origin short of reading the raw header
 * bag off the `Request` model and re-deriving this function by hand — including the parts
 * nobody derives correctly on the first try (`Origin: null` is a real value browsers send,
 * a proxy's `x-forwarded-proto` is a comma list after two hops, and a header can arrive as
 * an array).
 *
 * The precedence is the D34 shape: the caller's `Origin` when it sent a usable one — a
 * browser sends it on every POST, and it names the page the app is actually served from,
 * which is where an emailed link should point — otherwise the backend's own address from
 * the forwarded/host headers, which is the right answer for the single-box deploy where
 * the caller sent none.
 *
 * ⚠️ Everything here is caller-supplied, like every header. That is fine for building a
 * link to send back to the person who called, and it is NOT a proof of where the request
 * came from — a flow that puts this in an email a THIRD party will click (a password
 * reset) should use the backend's configured base URL (`EmailConfigState.effectiveBaseUrl`)
 * instead, which is what the product's own reset flow does. The port description says so.
 *
 * @module noodl-viewer-cloud/nodes/cloud/requestOrigin
 */

/**
 * A header value can be a string, a joined comma list (two proxies, a duplicated header),
 * or an array (Node's shape for repeated headers). The first entry is the client-facing
 * one in every one of those forms.
 */
function firstHeaderValue(value: unknown): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  if (typeof single !== 'string') return undefined;
  const first = single.split(',')[0].trim();
  return first.length > 0 ? first : undefined;
}

/**
 * An `Origin` a link can be built on: a real scheme-and-host. The shape test is also what
 * refuses the literal string `"null"` (an opaque origin — sandboxed iframes send it) and
 * any non-web scheme a hand-made request could carry into an email; a separate `=== 'null'`
 * clause would be dead code, and a mutant proved it.
 */
function usableOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!/^https?:\/\//i.test(value)) return undefined;
  return value.replace(/\/+$/, '');
}

/** `x-forwarded-proto` sanitised to the two values a link can start with. */
function usableProto(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const proto = value.toLowerCase();
  return proto === 'http' || proto === 'https' ? proto : undefined;
}

/**
 * The one derivation. Case-insensitive over header names — Node lowercases what arrives
 * over HTTP, but `CloudRunner.run` is a public seam (the workflow engine and every test
 * call it directly) and a hand-built `Origin:` must not read as absent.
 *
 * Returns `undefined` when nothing usable is there — a workflow-step invocation carries
 * no caller address at all, and pretending otherwise would be worse than saying so.
 */
export function requestOrigin(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;

  const bag: Record<string, string> = {};
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    const value = firstHeaderValue((headers as Record<string, unknown>)[key]);
    if (value !== undefined) bag[key.toLowerCase()] = value;
  }

  const origin = usableOrigin(bag['origin']);
  if (origin) return origin;

  // Behind a proxy the client-facing address is the forwarded pair; bare `host` is the
  // direct-connection case, where this backend serves plain http.
  const host = bag['x-forwarded-host'] || bag['host'];
  if (!host) return undefined;
  const proto = usableProto(bag['x-forwarded-proto']) || 'http';
  return proto + '://' + host;
}
