/**
 * Where a sign-in flow is allowed to send the browser afterwards (BAK-004).
 *
 * An unvalidated `redirect` parameter on an authentication callback is not a
 * minor hygiene issue: it is the delivery mechanism for a phishing chain whose
 * final hop is a *genuine* login on a *genuine* domain, which is precisely what
 * makes it convincing. So this module exists, it is the only way a redirect
 * target is computed, and its default is closed.
 *
 * The rule, in full:
 *
 *   - No `redirect` given            → the backend's own origin, `/`.
 *   - A path beginning with a single `/`
 *                                    → resolved against `baseUrl`. Always allowed:
 *                                      it cannot leave this backend's origin.
 *   - An absolute http(s) URL whose ORIGIN is in `redirectAllowList`
 *                                    → allowed verbatim (path and query kept).
 *   - Anything else                  → refused, naming what to add to the list.
 *
 * `//evil.example` is deliberately in the "anything else" bucket. It looks like
 * a path and is a protocol-relative URL; treating it as a path is the single
 * most common way this check is written wrong.
 *
 * @module nodegx-backend/auth/redirect
 */

export interface RedirectDecision {
  ok: boolean;
  /** The absolute URL to send the browser to (present when `ok`). */
  url?: string;
  /** Why it was refused, phrased for the operator who has to fix it (present when not `ok`). */
  reason?: string;
}

/** Scheme + host + port, or null when `value` is not an absolute http(s) URL. */
function originOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve and authorise a post-sign-in redirect target.
 *
 * `baseUrl` is BAK-002's canonical deployed origin (EmailConfigState.baseUrl),
 * already resolved through its local-dev fallback.
 */
export function resolveRedirect(requested: string | undefined, baseUrl: string, allowList: string[]): RedirectDecision {
  const base = baseUrl.replace(/\/+$/, '');
  const value = (requested || '').trim();

  if (!value) return { ok: true, url: `${base}/` };

  // A same-origin path. The `//` guard is the point of this branch: a
  // protocol-relative URL starts with a slash and goes anywhere.
  if (value.startsWith('/') && !value.startsWith('//')) {
    return { ok: true, url: `${base}${value}` };
  }

  const origin = originOf(value);
  if (!origin) {
    return {
      ok: false,
      reason:
        `Refused redirect target "${value}": it is neither a path beginning with "/" nor an absolute http(s) URL. ` +
        'Pass an app path (e.g. "/signed-in") or a full URL whose origin is in auth.json\'s redirectAllowList.'
    };
  }

  const permitted = allowList.some((entry) => {
    const entryOrigin = originOf(entry);
    return entryOrigin !== null && entryOrigin === origin;
  });
  if (permitted) return { ok: true, url: value };

  // Same origin as the backend itself is always fine even when spelled absolutely.
  if (origin === originOf(base)) return { ok: true, url: value };

  return {
    ok: false,
    reason:
      `Refused redirect target "${value}": the origin ${origin} is not allowed. Add it to redirectAllowList in ` +
      "auth.json (or via PUT /admin/auth) if this is your app's origin. This check is what stops an auth callback " +
      'from being used as an open redirect.'
  };
}

/**
 * Append the one-time handoff code to a resolved redirect URL.
 *
 * The code rides in the QUERY, not the fragment. See BAK-004-NOTES for the
 * decision; the short version is that Noodl apps may use hash routing, where a
 * fragment would fight the router, and the code is single-use and short-lived
 * so the query's extra exposure buys an attacker nothing.
 */
export function withHandoffCode(url: string, param: string, code: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(param, code);
  return parsed.toString();
}

/** Append an error the app can show, when the flow failed after we had a redirect target. */
export function withError(url: string, param: string, message: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(param, message);
  return parsed.toString();
}
