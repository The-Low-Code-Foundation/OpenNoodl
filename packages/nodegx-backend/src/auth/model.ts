/**
 * The auth-provider config model (BAK-004).
 *
 * ## One generic OIDC implementation, one bespoke adapter
 *
 * The scope trap this task names explicitly is the provider matrix — Appwrite
 * maintains 30+ adapters and each one is a small permanent maintenance tax. We
 * refuse it. There are exactly TWO provider kinds here:
 *
 *   - `oidc`   — authorization-code + PKCE against any OpenID Connect issuer,
 *                driven entirely by the issuer's discovery document. Google,
 *                Microsoft Entra, GitLab, Keycloak, Authentik, Auth0, Okta and
 *                most of the long tail are CONFIGURATION, not code.
 *   - `github` — the one bespoke adapter, because GitHub is OAuth2 but not
 *                OIDC (no discovery document, no ID token, and the primary
 *                email lives behind a second API call). It doubles as the
 *                template if a genuinely-demanded non-OIDC provider ever earns
 *                its keep.
 *
 * "Google" and "GitHub" are presented as PRESETS over this same shape (see
 * `PROVIDER_PRESETS`) — a preset fills in issuer/scopes/display name so an
 * operator supplies only a client id and secret. A preset is not a code path.
 *
 * ## What lives where
 *
 *   `<dataDir>/auth.json`    — providers (minus secrets), magic-link policy,
 *                              the redirect allow-list, the linking toggle.
 *                              Diffable, deployable, MCP-editable.
 *   `<dataDir>/secrets.json` — each provider's client secret, under the `auth`
 *                              namespace of the shared SecretsStore.
 *
 * The backend's public origin is NOT defined here: `baseUrl` is BAK-002's
 * canonical field and this task reuses it verbatim (see EmailConfigState's
 * module doc, which reserved it for exactly this).
 *
 * @module nodegx-backend/auth/model
 */

/** The two implementations. Adding a third is a product decision, not a config change. */
export type ProviderKind = 'oidc' | 'github';

export interface AuthProvider {
  /**
   * Stable slug — it is in the URL (`/oauth/<id>/start`) and in the callback URL
   * an operator pastes into the provider's console, so renaming one breaks a
   * registered redirect URI. Lowercase alphanumerics and dashes.
   */
  id: string;
  kind: ProviderKind;
  /** What the sign-in button says. */
  displayName: string;
  enabled: boolean;
  clientId: string;
  /**
   * OIDC issuer, e.g. `https://accounts.google.com`. Its discovery document is
   * fetched from `<issuer>/.well-known/openid-configuration`. Unused (and
   * required to be empty) for `github`.
   */
  issuer: string;
  scopes: string[];
  /**
   * May a first-time subject CREATE an account? `false` = existing users only —
   * the provider can be used to sign in to an account that already exists (or
   * links by verified email) but never to enrol a stranger.
   */
  allowSignup: boolean;
}

export interface MagicLinkConfig {
  enabled: boolean;
  /** Link lifetime. Short by design: a magic link in an inbox is a live credential. */
  ttlMinutes: number;
  /** May an unknown address create an account by clicking a link? */
  allowSignup: boolean;
}

export interface AuthConfig {
  version: 1;
  providers: AuthProvider[];
  magicLink: MagicLinkConfig;
  /**
   * Absolute app origins the post-sign-in redirect may target.
   *
   * EMPTY BY DEFAULT, and empty means "relative paths only" — the sign-in
   * redirect resolves against `baseUrl` and cannot leave this backend's origin.
   * That is the safe default: an unvalidated `redirect` parameter on a callback
   * is a textbook open redirect, and an open redirect on an AUTH callback is the
   * delivery mechanism for a phishing chain that ends with a real session.
   *
   * Entries are matched by ORIGIN (scheme + host + port), so
   * `https://app.example.com` permits any path under it and nothing else.
   */
  redirectAllowList: string[];
  linking: {
    /**
     * Match a provider identity to an existing local account when the provider
     * asserts a VERIFIED email that the account already holds. See
     * `auth/identities.ts` for the full rule and the takeover vectors it closes.
     * Turning this off means every provider sign-in for an unknown subject
     * either creates a fresh account or is refused — never joins an existing one.
     */
    autoLinkVerifiedEmail: boolean;
  };
}

/** A preset is a partial provider — the shape an operator does not have to know. */
export interface ProviderPreset {
  kind: ProviderKind;
  displayName: string;
  issuer: string;
  scopes: string[];
  /** Where the operator registers the callback URL, shown in the panel and the docs. */
  consoleUrl: string;
  /** Anything specific about this provider an operator will otherwise get wrong. */
  note: string;
}

/**
 * The two first-class configurations. `oidc` is the third entry deliberately:
 * a generic issuer is not a special case here, it is the main path, and a
 * preset that says so keeps the panel honest about that.
 */
export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  google: {
    kind: 'oidc',
    displayName: 'Google',
    issuer: 'https://accounts.google.com',
    scopes: ['openid', 'email', 'profile'],
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    note:
      'Create an "OAuth client ID" of type "Web application" and paste the callback URL below into ' +
      '"Authorized redirect URIs". Google asserts `email_verified` honestly, so accounts link by email.'
  },
  github: {
    kind: 'github',
    displayName: 'GitHub',
    issuer: '',
    // `user:email` is what makes the private-primary-email call work; without
    // it GitHub returns no usable address for most accounts.
    scopes: ['read:user', 'user:email'],
    consoleUrl: 'https://github.com/settings/developers',
    note:
      'Register an "OAuth App" (not a GitHub App) and paste the callback URL below into "Authorization ' +
      'callback URL". GitHub is not OIDC: there is no ID token, and the email comes from /user/emails, ' +
      'where only a `primary` AND `verified` address is accepted.'
  },
  oidc: {
    kind: 'oidc',
    displayName: 'Single sign-on',
    issuer: '',
    scopes: ['openid', 'email', 'profile'],
    consoleUrl: '',
    note:
      'Any OpenID Connect issuer: set the issuer URL and this backend reads its discovery document at ' +
      '<issuer>/.well-known/openid-configuration. Keycloak, Authentik, Entra ID, Auth0, Okta and GitLab ' +
      'all work by configuration alone.'
  }
};

export function defaultAuthConfig(): AuthConfig {
  return {
    version: 1,
    providers: [],
    magicLink: { enabled: false, ttlMinutes: 15, allowSignup: true },
    redirectAllowList: [],
    linking: { autoLinkVerifiedEmail: true }
  };
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Provider ids that would collide with a route segment or a reserved path. */
const RESERVED_IDS = new Set(['exchange', 'magic-link', 'callback', 'start', 'providers']);

function validateProvider(p: unknown, index: number, seenIds: Set<string>): string[] {
  const errors: string[] = [];
  const at = `providers[${index}]`;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return [`${at} must be an object`];
  const provider = p as Partial<AuthProvider>;

  if (typeof provider.id !== 'string' || !ID_PATTERN.test(provider.id)) {
    errors.push(`${at}.id must be a lowercase slug (a-z, 0-9, dashes; max 32 chars)`);
  } else if (RESERVED_IDS.has(provider.id)) {
    errors.push(`${at}.id "${provider.id}" is reserved — it would collide with an /oauth route`);
  } else if (seenIds.has(provider.id)) {
    errors.push(`${at}.id "${provider.id}" is used more than once; provider ids must be unique`);
  } else {
    seenIds.add(provider.id);
  }

  if (provider.kind !== 'oidc' && provider.kind !== 'github') {
    errors.push(`${at}.kind must be "oidc" or "github"`);
  }
  if (provider.displayName !== undefined && typeof provider.displayName !== 'string') {
    errors.push(`${at}.displayName must be a string`);
  }
  if (provider.enabled !== undefined && typeof provider.enabled !== 'boolean') {
    errors.push(`${at}.enabled must be a boolean`);
  }
  if (provider.clientId !== undefined && typeof provider.clientId !== 'string') {
    errors.push(`${at}.clientId must be a string`);
  }
  if (provider.allowSignup !== undefined && typeof provider.allowSignup !== 'boolean') {
    errors.push(`${at}.allowSignup must be a boolean`);
  }
  if (provider.scopes !== undefined) {
    if (!Array.isArray(provider.scopes) || provider.scopes.some((s) => typeof s !== 'string')) {
      errors.push(`${at}.scopes must be an array of strings`);
    }
  }

  if (provider.kind === 'oidc') {
    // An enabled OIDC provider with no issuer cannot discover anything, and
    // failing at the first sign-in attempt (in a browser redirect, where the
    // error is hardest to see) is exactly the wrong place to find out.
    if (typeof provider.issuer !== 'string' || !provider.issuer) {
      if (provider.enabled !== false) errors.push(`${at}.issuer is required for an enabled oidc provider`);
    } else if (!/^https?:\/\//.test(provider.issuer)) {
      errors.push(`${at}.issuer must be an absolute http(s) URL`);
    }
    if (Array.isArray(provider.scopes) && !provider.scopes.includes('openid')) {
      errors.push(`${at}.scopes must include "openid" for an oidc provider`);
    }
  } else if (provider.kind === 'github' && provider.issuer) {
    errors.push(`${at}.issuer must be empty for a github provider (GitHub has no OIDC discovery document)`);
  }

  return errors;
}

/** Structural validation — the same "refuse rather than misbehave quietly" posture as email.json / ops.json. */
export function validateAuthConfig(candidate: unknown): string[] {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return ['auth config must be an object'];
  }
  const c = candidate as Partial<AuthConfig>;
  const errors: string[] = [];

  if (c.providers !== undefined) {
    if (!Array.isArray(c.providers)) {
      errors.push('providers must be an array');
    } else {
      const seen = new Set<string>();
      c.providers.forEach((p, i) => errors.push(...validateProvider(p, i, seen)));
    }
  }

  if (c.magicLink !== undefined) {
    if (!c.magicLink || typeof c.magicLink !== 'object') {
      errors.push('magicLink must be an object');
    } else {
      const m = c.magicLink as Partial<MagicLinkConfig>;
      if (m.enabled !== undefined && typeof m.enabled !== 'boolean') errors.push('magicLink.enabled must be a boolean');
      if (m.allowSignup !== undefined && typeof m.allowSignup !== 'boolean') {
        errors.push('magicLink.allowSignup must be a boolean');
      }
      if (m.ttlMinutes !== undefined) {
        if (typeof m.ttlMinutes !== 'number' || !Number.isFinite(m.ttlMinutes) || m.ttlMinutes <= 0) {
          errors.push('magicLink.ttlMinutes must be a positive number');
        } else if (m.ttlMinutes > 24 * 60) {
          errors.push('magicLink.ttlMinutes must be at most 1440 (24h) — a long-lived magic link is a long-lived credential');
        }
      }
    }
  }

  if (c.redirectAllowList !== undefined) {
    if (!Array.isArray(c.redirectAllowList)) {
      errors.push('redirectAllowList must be an array of absolute origins');
    } else {
      c.redirectAllowList.forEach((entry, i) => {
        if (typeof entry !== 'string' || !/^https?:\/\//.test(entry)) {
          errors.push(`redirectAllowList[${i}] must be an absolute http(s) origin, e.g. "https://app.example.com"`);
        }
      });
    }
  }

  if (c.linking !== undefined) {
    if (!c.linking || typeof c.linking !== 'object') {
      errors.push('linking must be an object');
    } else if (
      (c.linking as { autoLinkVerifiedEmail?: unknown }).autoLinkVerifiedEmail !== undefined &&
      typeof (c.linking as { autoLinkVerifiedEmail?: unknown }).autoLinkVerifiedEmail !== 'boolean'
    ) {
      errors.push('linking.autoLinkVerifiedEmail must be a boolean');
    }
  }

  return errors;
}

/** Fill a partial provider from its preset, if it names one. Config always wins over the preset. */
export function applyPreset(partial: Partial<AuthProvider> & { preset?: string }): Partial<AuthProvider> {
  const preset = partial.preset ? PROVIDER_PRESETS[partial.preset] : undefined;
  if (!preset) return partial;
  return {
    ...partial,
    kind: partial.kind || preset.kind,
    displayName: partial.displayName || preset.displayName,
    issuer: partial.issuer !== undefined ? partial.issuer : preset.issuer,
    scopes: partial.scopes && partial.scopes.length ? partial.scopes : [...preset.scopes]
  };
}

/** A whole provider from a partial, defaulting every field a caller may omit. */
export function completeProvider(id: string, partial: Partial<AuthProvider>): AuthProvider {
  return {
    id,
    kind: partial.kind || 'oidc',
    displayName: partial.displayName || id,
    enabled: partial.enabled !== undefined ? partial.enabled : false,
    clientId: partial.clientId || '',
    issuer: partial.issuer || '',
    scopes: partial.scopes && partial.scopes.length ? [...partial.scopes] : ['openid', 'email', 'profile'],
    allowSignup: partial.allowSignup !== undefined ? partial.allowSignup : true
  };
}
