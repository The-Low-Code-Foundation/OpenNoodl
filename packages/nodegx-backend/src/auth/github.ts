/**
 * The one bespoke provider adapter (BAK-004).
 *
 * GitHub is OAuth2 but not OpenID Connect, so the generic path in ./oidc cannot
 * carry it: there is no discovery document, no ID token to verify, and no email
 * claim — the address lives behind a second API call and is often private. It
 * is here on purpose and it is the ONLY one: the scope decision is "generic OIDC
 * plus GitHub", and this file doubles as the template if a genuinely-demanded
 * non-OIDC provider ever earns the same treatment.
 *
 * Three GitHub-specific facts, each of which costs an afternoon to rediscover:
 *
 *   1. The token endpoint answers **HTTP 200 with an `error` field** when the
 *      exchange fails. Checking the status alone gets you an undefined access
 *      token and a confusing crash three frames later.
 *   2. Every api.github.com call **requires a User-Agent**; without one the API
 *      answers 403.
 *   3. `GET /user` returns the *public profile* email, which is usually null.
 *      The real address comes from `GET /user/emails` (needs `user:email`), and
 *      only entries GitHub marks `verified` may be treated as verified — that
 *      flag is what the account-linking rule turns on.
 *
 * PKCE is not sent. GitHub OAuth Apps do not implement it, and sending an
 * unsupported `code_challenge` is at best ignored. The flow is still protected
 * by `state`, by the flow-binding cookie (see ../server/oauth-routes), and by
 * the client secret on a confidential, server-side exchange.
 *
 * @module nodegx-backend/auth/github
 */

import { providerJson } from './http';
import type { ProviderIdentity } from './oidc';

/**
 * GitHub's four endpoints, in one place.
 *
 * They are a mutable object rather than four constants for exactly one reason:
 * this is the only provider whose URLs are hard-coded (a generic OIDC provider
 * gets them from its discovery document), which would otherwise make it the
 * only provider that cannot be tested against a real server. The GitHub suite
 * points these at a local stand-in and exercises the actual code path,
 * including the three GitHub-specific traps above. Nothing in production
 * writes to this object; it is the same kind of deliberate, documented seam as
 * `Mailer.setTransportForTesting`.
 */
export const GITHUB_ENDPOINTS = {
  authorize: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
  user: 'https://api.github.com/user',
  emails: 'https://api.github.com/user/emails'
};

/** GitHub rejects requests without one (fact 2 above). */
const USER_AGENT = 'nodegx-backend';

export function githubAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const url = new URL(GITHUB_ENDPOINTS.authorize);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scopes.join(' '));
  url.searchParams.set('state', params.state);
  // Without this, GitHub silently reuses an existing grant and a user can never
  // switch accounts — they just get signed straight back in as whoever the
  // browser last authorized.
  url.searchParams.set('allow_signup', 'true');
  return url.toString();
}

interface GithubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GithubUser {
  id?: number;
  login?: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
}

interface GithubEmail {
  email?: string;
  primary?: boolean;
  verified?: boolean;
}

async function exchangeGithubCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const response = await providerJson<GithubTokenResponse>(GITHUB_ENDPOINTS.token, {
    what: 'GitHub token exchange',
    method: 'POST',
    // Without an explicit JSON Accept, GitHub answers form-encoded.
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    form: {
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri
    }
  });

  // Fact 1: the failure arrives as a 200.
  if (response.error) {
    throw new Error(
      `GitHub refused the token exchange: ${response.error}${response.error_description ? ` — ${response.error_description}` : ''}`
    );
  }
  if (!response.access_token) {
    throw new Error('GitHub returned no access token and no error, which should not happen; the sign-in cannot continue.');
  }
  return response.access_token;
}

/**
 * Pick the address to treat as this account's, and say honestly whether GitHub
 * verified it.
 *
 * Preference order is verified-primary, then any verified address, then the
 * primary one marked unverified. `primary` is a display preference; `verified`
 * is the security property, so a verified non-primary address outranks an
 * unverified primary one.
 */
export function selectGithubEmail(emails: GithubEmail[], profileEmail: string | null): { email: string | null; verified: boolean } {
  const usable = emails.filter((e) => typeof e.email === 'string' && e.email);
  const verifiedPrimary = usable.find((e) => e.primary && e.verified);
  if (verifiedPrimary) return { email: String(verifiedPrimary.email).toLowerCase(), verified: true };

  const anyVerified = usable.find((e) => e.verified);
  if (anyVerified) return { email: String(anyVerified.email).toLowerCase(), verified: true };

  const primary = usable.find((e) => e.primary);
  if (primary) return { email: String(primary.email).toLowerCase(), verified: false };

  return { email: profileEmail ? profileEmail.toLowerCase() : null, verified: false };
}

/** Complete a GitHub sign-in: exchange the code, then read the profile and the addresses. */
export async function completeGithubFlow(params: {
  providerId: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<ProviderIdentity> {
  const accessToken = await exchangeGithubCode(params);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT
  };

  const user = await providerJson<GithubUser>(GITHUB_ENDPOINTS.user, { what: 'GitHub user profile', headers });
  if (user.id === undefined || user.id === null) {
    throw new Error('GitHub returned a user profile with no id, so there is no stable identity to key on.');
  }

  // A token without `user:email` gets a 403 here. That is a configuration
  // problem an operator can fix, so it must not be swallowed into "no email" —
  // silently proceeding would create an unlinkable account.
  let emails: GithubEmail[] = [];
  try {
    emails = await providerJson<GithubEmail[]>(GITHUB_ENDPOINTS.emails, { what: 'GitHub email addresses', headers }) as unknown as GithubEmail[];
    if (!Array.isArray(emails)) emails = [];
  } catch (e) {
    throw new Error(
      `Could not read the GitHub account's email addresses (${e instanceof Error ? e.message : e}). ` +
        'The "user:email" scope is required — add it to the provider\'s scopes in the Auth section.'
    );
  }

  const { email, verified } = selectGithubEmail(emails, user.email ?? null);

  return {
    providerId: params.providerId,
    // Namespaced by kind rather than bare, so a numeric GitHub id can never
    // collide with an OIDC `sub` that happens to be the same digits.
    subject: `github:${user.id}`,
    email,
    emailVerified: verified,
    displayName: user.name || user.login || null,
    raw: {
      ...(user.login ? { login: user.login } : {}),
      ...(user.avatar_url ? { picture: user.avatar_url } : {})
    }
  };
}
