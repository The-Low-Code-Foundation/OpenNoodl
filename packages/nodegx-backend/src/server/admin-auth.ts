/**
 * Admin auth surface (BAK-004): configuring who can sign in.
 *
 *   GET    /admin/auth                    providers (redacted), policy, callback URLs, presets
 *   PUT    /admin/auth                    magic-link policy, redirect allow-list, linking toggle
 *   PUT    /admin/auth/providers/:id      add or update one provider (+ its client secret)
 *   DELETE /admin/auth/providers/:id      remove a provider and forget its secret
 *
 * This is the ONE model behind three fronts — the editor's Backend Services
 * panel, the served admin dashboard's Auth tab, and the MCP auth tools — for
 * the same reason BAK-005 gave: they are all HTTP clients of this surface, so
 * there is no second implementation to drift from.
 *
 * Two things this surface does that a thin CRUD wrapper would not:
 *
 *   - **It never returns a client secret.** Reads report `hasClientSecret`.
 *     A write may set one; nothing can read one back. Same posture as BAK-003's
 *     API keys and BAK-002's SMTP password.
 *   - **It computes the callback URL** and puts it in every response. The
 *     redirect-URI mismatch is the single most expensive mistake in setting up
 *     an OAuth client, and the fix is to never make the operator assemble that
 *     string themselves.
 *
 * @module nodegx-backend/server/admin-auth
 */

import type { AuthConfigState } from '../auth/AuthConfigState';
import type { EmailConfigState } from '../email/EmailConfigState';
import { applyPreset, AuthConfig, completeProvider, PROVIDER_PRESETS, validateAuthConfig } from '../auth/model';
import { clearDiscoveryCache } from '../auth/oidc';
import type { RequestContext } from './HttpServer';
import { HttpError, readJSONBody, sendJSON } from './http-util';

export interface AdminAuthDeps {
  auth: AuthConfigState;
  emailConfig: EmailConfigState;
  /** How the OAuth routes compute a provider's callback URL — reused verbatim so the two cannot disagree. */
  callbackUrl: (providerId: string) => string;
  getLocalUrl: () => string;
}

export class AdminAuthRoutes {
  constructor(private readonly deps: AdminAuthDeps) {}

  /** `GET /admin/auth`. */
  getConfig(ctx: RequestContext): void {
    const redacted = this.deps.auth.redacted();
    const baseUrl = this.deps.emailConfig.effectiveBaseUrl(this.deps.getLocalUrl());

    sendJSON(ctx.res, 200, {
      config: {
        ...redacted,
        providers: redacted.providers.map((p) => ({ ...p, callbackUrl: this.deps.callbackUrl(p.id) }))
      },
      /** The presets a UI offers when adding a provider. Data, so the panel and the dashboard agree. */
      presets: PROVIDER_PRESETS,
      baseUrl: {
        url: baseUrl.url,
        /**
         * A callback URL built on the local fallback is registered in a
         * provider console and then never works from anywhere else. Worth
         * saying out loud rather than letting an operator discover it after
         * pasting `http://127.0.0.1:8577/...` into Google.
         */
        usedFallback: baseUrl.usedFallback,
        warning: baseUrl.usedFallback
          ? 'No baseUrl is configured for this backend, so callback URLs below use the local address. Set the ' +
            "Base URL in the Email section (it is the backend's one canonical public origin) before registering " +
            'these URLs with a provider.'
          : null
      },
      /** Magic links need BOTH their own switch and working SMTP; report the compound state, not just the flag. */
      magicLinkReady: this.deps.auth.config.magicLink.enabled && this.deps.emailConfig.isConfigured(),
      magicLinkNotReadyReason: this.magicLinkNotReadyReason()
    });
  }

  private magicLinkNotReadyReason(): string | null {
    if (!this.deps.auth.config.magicLink.enabled) {
      return 'Magic-link sign-in is turned off for this backend (auth.json: magicLink.enabled).';
    }
    if (!this.deps.emailConfig.isConfigured()) return this.deps.emailConfig.notConfiguredReason();
    return null;
  }

  /**
   * `PUT /admin/auth` — the non-provider policy.
   *
   * Providers are deliberately NOT settable here: they have their own route so
   * that editing one cannot silently drop the others, which is exactly what a
   * whole-array PUT from a UI that loaded a stale copy does.
   */
  async putConfig(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const known = ['magicLink', 'redirectAllowList', 'linking'];
    const given = Object.keys(body).filter((k) => k !== 'version');
    if (given.length === 0 || given.some((k) => !known.includes(k))) {
      throw new HttpError(
        400,
        `Nothing to update. Send one or more of: ${known.join(', ')}. ` +
          `Received: ${given.length ? given.join(', ') : '(empty body)'}. ` +
          'Providers are edited one at a time via PUT /admin/auth/providers/:id.'
      );
    }

    // Validate the MERGED document under the same rules a file on disk gets, so
    // a patch that would produce an invalid whole is refused before anything is
    // persisted (the shape BAK-009's PUT /admin/ops established).
    const allowList = body.redirectAllowList as AuthConfig['redirectAllowList'] | undefined;
    const candidate: AuthConfig = {
      ...this.deps.auth.config,
      ...(body.magicLink ? { magicLink: { ...this.deps.auth.config.magicLink, ...(body.magicLink as object) } } : {}),
      ...(allowList ? { redirectAllowList: allowList } : {}),
      ...(body.linking ? { linking: { ...this.deps.auth.config.linking, ...(body.linking as object) } } : {})
    };
    const errors = validateAuthConfig(candidate);
    if (errors.length > 0) {
      throw new HttpError(400, `Invalid auth config:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }

    if (body.magicLink) Object.assign(this.deps.auth.config.magicLink, body.magicLink);
    if (allowList) this.deps.auth.config.redirectAllowList = candidate.redirectAllowList;
    if (body.linking) Object.assign(this.deps.auth.config.linking, body.linking);
    this.deps.auth.save();

    ctx.audit({ sections: given });
    this.getConfig(ctx);
  }

  /**
   * `PUT /admin/auth/providers/:id` — add or update one provider.
   *
   * Accepts a `preset` ("google" | "github" | "oidc") that fills in kind,
   * display name, issuer and scopes, and a `clientSecret` that is written to
   * secrets.json and never echoed. Any explicit field beats the preset.
   */
  async putProvider(ctx: RequestContext): Promise<void> {
    const id = ctx.params.id;
    const body = await readJSONBody(ctx.req);

    const existing = this.deps.auth.provider(id);
    const merged = applyPreset({
      ...(existing || {}),
      ...(body as Record<string, unknown>),
      preset: typeof body.preset === 'string' ? body.preset : undefined
    });
    if (typeof body.preset === 'string' && !PROVIDER_PRESETS[body.preset]) {
      throw new HttpError(400, `Unknown preset "${body.preset}". Known presets: ${Object.keys(PROVIDER_PRESETS).join(', ')}.`);
    }
    const provider = completeProvider(id, merged);

    // Validate the WHOLE config with this provider substituted in, so an id
    // clash or a bad issuer is caught under the same rules a file on disk is.
    const others = this.deps.auth.config.providers.filter((p) => p.id !== id);
    const errors = validateAuthConfig({ ...this.deps.auth.config, providers: [...others, provider] });
    if (errors.length > 0) {
      throw new HttpError(400, `Invalid provider:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }

    // The secret first: a provider saved as `enabled` whose secret write then
    // failed would be advertised as usable and refuse every sign-in.
    if (typeof body.clientSecret === 'string' && body.clientSecret) {
      this.deps.auth.setClientSecret(id, body.clientSecret);
    }
    this.deps.auth.upsertProvider(provider);
    // An issuer change invalidates every cached discovery document and JWKS.
    clearDiscoveryCache();

    ctx.audit({ provider: id, enabled: provider.enabled, kind: provider.kind, secretSet: Boolean(body.clientSecret) });

    const reason = this.deps.auth.notConfiguredReason(provider);
    sendJSON(ctx.res, 200, {
      success: true,
      provider: {
        ...provider,
        hasClientSecret: Boolean(this.deps.auth.getClientSecret(id)),
        ready: reason === null,
        notReadyReason: reason,
        callbackUrl: this.deps.callbackUrl(id)
      }
    });
  }

  /** `DELETE /admin/auth/providers/:id`. Existing identities are kept — see the note below. */
  deleteProvider(ctx: RequestContext): void {
    const id = ctx.params.id;
    const removed = this.deps.auth.deleteProvider(id);
    if (!removed) throw new HttpError(404, `No auth provider "${id}" is configured.`);
    clearDiscoveryCache();
    ctx.audit({ provider: id });
    sendJSON(ctx.res, 200, {
      success: true,
      provider: id,
      /**
       * `_UserIdentity` rows survive on purpose. Deleting them would silently
       * destroy the link between real accounts and a provider an operator may
       * be re-adding in a minute (a rotated client secret, a typo in the
       * issuer) — and if the provider is gone for good, the rows are inert.
       */
      note:
        'The provider is removed and its client secret forgotten. Existing linked identities are kept, so ' +
        're-adding this provider id restores sign-in for those accounts. Users with no password and no other ' +
        'linked provider cannot sign in while it is absent.'
    });
  }
}
