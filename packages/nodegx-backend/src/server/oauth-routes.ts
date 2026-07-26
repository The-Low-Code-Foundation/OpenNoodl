/**
 * The sign-in flows an app's END USERS see (BAK-004).
 *
 *   GET  /auth/providers                    what this backend offers (public, no secrets)
 *   GET  /oauth/:provider/start?redirect=   -> 302 to the identity provider
 *   GET  /oauth/:provider/callback          <- 302 back from the provider, then 302 to the app
 *   POST /oauth/exchange   { code }         the app trades the handoff code for a session
 *   POST /auth/magic-link  { email, redirect }
 *   GET  /auth/magic-link/callback?token=   the click in the inbox
 *
 * Not to be confused with the EDITOR's `noodl://` OAuth (NodeGX cloud sign-in),
 * which is unrelated and untouched. This is plain web redirects on the deployed
 * backend's own origin.
 *
 * ## The token handoff (decision 1 of 2)
 *
 * The callback must get a session token from this server into a page on the
 * app's origin, and it only has a redirect to do it with. Putting the session
 * token itself in the URL is out — it is a long-lived credential and URLs end up
 * in history, referrers, proxy logs and screenshots.
 *
 * So the callback mints a **one-time handoff code** (2-minute TTL, single use,
 * server-side) and the app exchanges it over `POST /oauth/exchange`. The code
 * travels in the **query string**, and the runtime strips it with
 * `history.replaceState` before anything else runs.
 *
 * The fragment was the other candidate and was rejected for a reason specific to
 * this product: Noodl apps can use hash routing, where `#...` is the router's,
 * and a token pickup that fights the router is a bug that appears only in some
 * projects. The query costs a little more exposure, which the one-time,
 * two-minute code makes close to worthless.
 *
 * ## The flow-binding cookie
 *
 * `state` alone proves a callback belongs to a flow this server started. It does
 * NOT prove it belongs to THIS browser's flow — an attacker can start their own
 * flow, then feed a victim the resulting callback URL and log the victim into
 * the ATTACKER's account (login CSRF), where the victim's subsequent activity
 * lands in an account the attacker controls.
 *
 * So `/start` also sets `nodegx_oauth_flow`, an HttpOnly SameSite=Lax cookie
 * holding a random value the flow record remembers, and the callback refuses
 * unless it comes back. Both legs are top-level GET navigations on this origin,
 * which is exactly the case `SameSite=Lax` permits, so this works even when the
 * app lives on a different origin from the backend.
 *
 * @module nodegx-backend/server/oauth-routes
 */

import type * as http from 'http';

import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { AuthConfigState } from '../auth/AuthConfigState';
import type { AuthProvider } from '../auth/model';
import type { EmailConfigState } from '../email/EmailConfigState';
import type { Mailer } from '../email/Mailer';
import type { EmailTokenStore } from '../email/tokens';
import { MAGIC_LINK_DEFAULT_TTL_MS } from '../email/tokens';
import { renderTemplate } from '../email/templates';
import { FlowStore } from '../auth/FlowStore';
import { AuthLinkError, IdentityStore, isFlagSet, SignInResult } from '../auth/identities';
import {
  authorizationUrl,
  createPkce,
  discover,
  exchangeCode,
  identityFromClaims,
  ProviderIdentity,
  randomToken,
  verifyIdToken
} from '../auth/oidc';
import { completeGithubFlow, githubAuthorizationUrl } from '../auth/github';
import { resolveRedirect, withError, withHandoffCode } from '../auth/redirect';
import { logger } from '../ops/logger';
import type { RateLimiter } from '../ops/rate-limit';
import type { RateLimitPolicy } from '../ops/model';
import type { AuditLog } from '../ops/audit';
import { AUDIT_AUTH_CREDENTIALS_REVOKED, AUDIT_AUTH_SIGN_IN } from '../ops/audit-actions';
import { HttpError, readJSONBody, sendJSON } from './http-util';
import { page, sendErrorPage, sendHTML } from './mini-page';
import type { RequestContext } from './HttpServer';

/** The query parameter the runtime looks for on load. Also in docs and in the node's help text. */
export const HANDOFF_PARAM = 'nodegx_auth';
/** How a failed sign-in is reported to an app that gave us a redirect target. */
export const ERROR_PARAM = 'nodegx_auth_error';

const FLOW_COOKIE = 'nodegx_oauth_flow';
const FLOW_COOKIE_MAX_AGE_SECONDS = 600;

/**
 * Where a sign-in goes when the caller named nowhere.
 *
 * Not `/`, which 404s on a backend that serves an API: an operator checking
 * whether their Google client id works would land on "Not found" and have no
 * idea whether the sign-in succeeded. This path serves a page that says it did.
 */
const DEFAULT_REDIRECT_PATH = '/auth/signed-in';

function newSessionToken(): string {
  return 'r:' + randomToken(24);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

function redirectTo(res: http.ServerResponse, url: string): void {
  res.writeHead(302, { Location: url, 'Cache-Control': 'no-store' });
  res.end();
}

export interface OAuthRoutesDeps {
  facade: AdapterFacade;
  auth: AuthConfigState;
  emailConfig: EmailConfigState;
  mailer: Mailer;
  tokens: EmailTokenStore;
  backendName: string;
  /** `http://<host>:<port>` — the loud-warned fallback when `baseUrl` is unset (BAK-002 owns the field). */
  getLocalUrl: () => string;
  /** Is signup allowed at all on this backend? BAK-003's `signup` rule, evaluated for an anonymous principal. */
  signupAllowedForAnonymous: () => boolean;
  limiter: RateLimiter;
  clientAddress: (req: http.IncomingMessage) => string;
  audit: AuditLog;
}

export class OAuthRoutes {
  private readonly deps: OAuthRoutesDeps;
  private readonly flows = new FlowStore();
  private readonly identities: IdentityStore;

  /**
   * Budgets stricter than the `auth` route class, for the same reason BAK-002's
   * mail endpoints are: starting a sign-in costs this server an outbound
   * request to a third party, and asking for a magic link sends mail to an
   * address the caller merely named.
   */
  private static readonly START_POLICY: RateLimitPolicy = { ratePerMinute: 20, burst: 20 };
  private static readonly MAGIC_SEND_POLICY: RateLimitPolicy = { ratePerMinute: 5 / 15, burst: 5 };
  private static readonly EXCHANGE_POLICY: RateLimitPolicy = { ratePerMinute: 30, burst: 30 };

  constructor(deps: OAuthRoutesDeps) {
    this.deps = deps;
    this.identities = new IdentityStore(deps.facade);
  }

  /** Live counters for the metrics endpoint. */
  get pendingFlowCount(): number {
    return this.flows.pendingFlows;
  }

  private baseUrl(): string {
    return this.deps.emailConfig.effectiveBaseUrl(this.deps.getLocalUrl()).url;
  }

  /** The URL an operator pastes into the provider's console. Displayed by the panel, the dashboard and MCP. */
  callbackUrl(providerId: string): string {
    return `${this.baseUrl()}/oauth/${encodeURIComponent(providerId)}/callback`;
  }

  /**
   * Refuse with the same 429 shape the dispatcher's limiter sends — including
   * the `Retry-After` header, which is the part a well-behaved client reads and
   * the part that is easy to leave off when the message already says the number.
   */
  private enforce(ctx: RequestContext, bucket: string, policy: RateLimitPolicy): void {
    const decision = this.deps.limiter.checkPolicy(bucket, this.deps.clientAddress(ctx.req), policy);
    if (decision.allowed) return;
    ctx.res.setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw new HttpError(429, `Too many requests. Try again in ${decision.retryAfterSeconds}s.`);
  }

  // ==========================================================================
  // Discovery for the app: what can I sign in with?
  // ==========================================================================

  /**
   * `GET /auth/providers` — public and deliberately thin: an id, a label, and
   * the start URL for each usable provider, plus whether magic links are on.
   * A provider that is enabled but not fully configured is ABSENT rather than
   * listed-and-broken, so a sign-in page never renders a button that dead-ends.
   */
  listProviders(ctx: RequestContext): void {
    const base = this.baseUrl();
    const providers = this.deps.auth.usableProviders().map((p) => ({
      id: p.id,
      kind: p.kind,
      displayName: p.displayName,
      startUrl: `${base}/oauth/${encodeURIComponent(p.id)}/start`
    }));
    sendJSON(ctx.res, 200, {
      providers,
      magicLink: {
        enabled: this.deps.auth.config.magicLink.enabled && this.deps.emailConfig.isConfigured(),
        requestUrl: `${base}/auth/magic-link`
      },
      handoffParam: HANDOFF_PARAM,
      errorParam: ERROR_PARAM
    });
  }

  // ==========================================================================
  // Start
  // ==========================================================================

  /** `GET /oauth/:provider/start?redirect=<app path or allowed URL>`. */
  async start(ctx: RequestContext): Promise<void> {
    this.enforce(ctx, 'auth:oauth-start', OAuthRoutes.START_POLICY);

    const providerId = ctx.params.provider;
    const provider = this.deps.auth.provider(providerId);
    if (!provider || !provider.enabled) {
      // 404 rather than 403: an operator who has not configured a provider has
      // not created that URL, and saying "disabled" would enumerate config.
      sendErrorPage(ctx.res, 404, 'Sign-in unavailable', `This backend has no enabled sign-in provider called "${providerId}".`);
      return;
    }
    const notReady = this.deps.auth.notConfiguredReason(provider);
    if (notReady) {
      // Loud failure: the operator's message, not the provider's. Logged too,
      // because the person who can fix this is not the one looking at the page.
      logger.warn('auth.provider-not-configured', { provider: providerId, detail: notReady });
      sendErrorPage(ctx.res, 503, 'Sign-in unavailable', notReady);
      return;
    }

    const decision = resolveRedirect(
      ctx.query.redirect || DEFAULT_REDIRECT_PATH,
      this.baseUrl(),
      this.deps.auth.config.redirectAllowList
    );
    if (!decision.ok) {
      logger.warn('auth.redirect-refused', { provider: providerId, detail: decision.reason });
      sendErrorPage(ctx.res, 400, 'Sign-in cannot continue', decision.reason as string);
      return;
    }

    const binding = randomToken();
    const redirectUri = this.callbackUrl(providerId);

    let target: string;
    let state: string;
    try {
      if (provider.kind === 'github') {
        state = this.flows.begin({
          providerId,
          codeVerifier: '',
          nonce: '',
          redirectUrl: decision.url as string,
          binding
        });
        target = githubAuthorizationUrl({
          clientId: provider.clientId,
          redirectUri,
          scopes: provider.scopes,
          state
        });
      } else {
        const discovery = await discover(provider.issuer);
        const pkce = createPkce();
        const nonce = randomToken();
        state = this.flows.begin({
          providerId,
          codeVerifier: pkce.verifier,
          nonce,
          redirectUrl: decision.url as string,
          binding
        });
        target = authorizationUrl({
          discovery,
          clientId: provider.clientId,
          redirectUri,
          scopes: provider.scopes,
          state,
          nonce,
          pkce
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('auth.start-failed', { provider: providerId, detail: message });
      sendErrorPage(
        ctx.res,
        502,
        'Sign-in unavailable',
        `This backend could not reach the "${provider.displayName}" identity provider to begin sign-in. ${message}`
      );
      return;
    }

    ctx.res.setHeader('Set-Cookie', this.flowCookie(binding));
    redirectTo(ctx.res, target);
  }

  /**
   * `Secure` is conditional on the deployed origin actually being https —
   * hard-coding it would silently break every local http dev setup (the browser
   * drops the cookie, the callback refuses, and nothing says why).
   */
  private flowCookie(value: string, clear = false): string {
    const secure = this.baseUrl().startsWith('https://') ? '; Secure' : '';
    const age = clear ? 0 : FLOW_COOKIE_MAX_AGE_SECONDS;
    return `${FLOW_COOKIE}=${clear ? '' : encodeURIComponent(value)}; Path=/oauth; HttpOnly; SameSite=Lax; Max-Age=${age}${secure}`;
  }

  // ==========================================================================
  // Callback
  // ==========================================================================

  /** `GET /oauth/:provider/callback?code=&state=` — the provider sends the browser here. */
  async callback(ctx: RequestContext): Promise<void> {
    const providerId = ctx.params.provider;
    // Always clear the binding cookie: this flow is over either way.
    ctx.res.setHeader('Set-Cookie', this.flowCookie('', true));

    const state = ctx.query.state || '';
    const flow = state ? this.flows.take(state) : null;
    if (!flow || flow.providerId !== providerId) {
      // No flow means no authorised redirect target, so this has to be a page.
      sendErrorPage(
        ctx.res,
        400,
        'Sign-in expired',
        'This sign-in link is no longer valid — it may have already been used, or taken too long. Start again from the app.'
      );
      return;
    }

    // The login-CSRF check. See the module doc.
    const cookie = parseCookies(ctx.req.headers.cookie)[FLOW_COOKIE];
    if (!cookie || cookie !== flow.binding) {
      logger.warn('auth.flow-binding-mismatch', {
        provider: providerId,
        ip: ctx.clientIp,
        detail: cookie
          ? 'the flow-binding cookie did not match the flow — this callback was completed in a different browser'
          : 'no flow-binding cookie was presented — the sign-in did not start in this browser'
      });
      sendErrorPage(
        ctx.res,
        400,
        'Sign-in cannot continue',
        'This sign-in did not start in this browser, so it will not be completed. Start again from the app.'
      );
      return;
    }

    // The provider can refuse before we ever see a code (user pressed Cancel,
    // consent withheld). That is a normal outcome, and the app should hear it.
    if (ctx.query.error) {
      const description = ctx.query.error_description || ctx.query.error;
      redirectTo(ctx.res, withError(flow.redirectUrl, ERROR_PARAM, `Sign-in was not completed: ${description}`));
      return;
    }

    const code = ctx.query.code || '';
    if (!code) {
      redirectTo(ctx.res, withError(flow.redirectUrl, ERROR_PARAM, 'The identity provider returned no authorization code.'));
      return;
    }

    const provider = this.deps.auth.provider(providerId);
    if (!provider) {
      redirectTo(ctx.res, withError(flow.redirectUrl, ERROR_PARAM, 'This sign-in provider is no longer configured.'));
      return;
    }

    let identity: ProviderIdentity;
    try {
      identity =
        provider.kind === 'github'
          ? await completeGithubFlow({
              providerId,
              clientId: provider.clientId,
              clientSecret: this.deps.auth.getClientSecret(providerId),
              code,
              redirectUri: this.callbackUrl(providerId)
            })
          : await this.completeOidcFlow(provider, flow.codeVerifier, flow.nonce, code);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The operator needs the real reason; the user gets a shorter one, because
      // provider errors quote our own client id back at us.
      logger.error('auth.callback-failed', { provider: providerId, ip: ctx.clientIp, detail: message });
      redirectTo(
        ctx.res,
        withError(flow.redirectUrl, ERROR_PARAM, `Sign-in with ${provider.displayName} could not be completed.`)
      );
      return;
    }

    await this.finishSignIn(ctx, identity, provider.displayName, provider.allowSignup, flow.redirectUrl);
  }

  private async completeOidcFlow(
    provider: AuthProvider,
    codeVerifier: string,
    nonce: string,
    code: string
  ): Promise<ProviderIdentity> {
    const discovery = await discover(provider.issuer);
    const tokens = await exchangeCode({
      discovery,
      clientId: provider.clientId,
      clientSecret: this.deps.auth.getClientSecret(provider.id),
      code,
      redirectUri: this.callbackUrl(provider.id),
      codeVerifier
    });
    if (!tokens.id_token) {
      throw new Error(
        'The token response contained no id_token. Check that the "openid" scope is configured for this provider.'
      );
    }
    const claims = await verifyIdToken(tokens.id_token, { discovery, clientId: provider.clientId, nonce });
    return identityFromClaims(provider.id, claims);
  }

  /**
   * The shared tail of every sign-in: apply the linking rule, issue an ordinary
   * BAK-003 session, and hand the app a one-time code.
   */
  private async finishSignIn(
    ctx: RequestContext,
    identity: ProviderIdentity,
    displayLabel: string,
    providerAllowsSignup: boolean,
    redirectUrl: string
  ): Promise<void> {
    let result: SignInResult;
    try {
      result = await this.identities.resolveSignIn(identity, {
        autoLinkVerifiedEmail: this.deps.auth.config.linking.autoLinkVerifiedEmail,
        // BOTH gates must allow it: the backend's own signup rule (BAK-003) and
        // this provider's. Either one saying no means no.
        allowSignup: providerAllowsSignup && this.deps.signupAllowedForAnonymous(),
        displayLabel
      });
    } catch (e) {
      if (e instanceof AuthLinkError) {
        logger.warn('auth.link-refused', { provider: identity.providerId, code: e.code, detail: e.message });
        redirectTo(ctx.res, withError(redirectUrl, ERROR_PARAM, e.message));
        return;
      }
      throw e;
    }

    const sessionToken = newSessionToken();
    await this.deps.facade.rawCreate('_Session', { sessionToken, userId: result.userId });

    void this.deps.audit.record({
      action: result.outcome === 'linked-credentials-revoked' ? AUDIT_AUTH_CREDENTIALS_REVOKED : AUDIT_AUTH_SIGN_IN,
      actorKind: 'user',
      actor: result.userId,
      target: { provider: identity.providerId },
      detail: { outcome: result.outcome, emailVerified: identity.emailVerified },
      outcome: 'success',
      status: 302,
      ip: ctx.clientIp,
      requestId: ctx.requestId,
      method: ctx.req.method || 'GET',
      route: 'oauth/:provider/callback'
    });

    logger.info('auth.signed-in', {
      requestId: ctx.requestId,
      provider: identity.providerId,
      outcome: result.outcome
    });

    const handoff = this.flows.issueHandoff({
      userId: result.userId,
      sessionToken,
      outcome: result.outcome,
      notice: result.notice
    });
    redirectTo(ctx.res, withHandoffCode(redirectUrl, HANDOFF_PARAM, handoff));
  }

  // ==========================================================================
  // Exchange
  // ==========================================================================

  /**
   * `POST /oauth/exchange { code }` — the app trades the one-time code for the
   * session. The response is deliberately the SAME shape `/login` returns (the
   * `_User` record plus `sessionToken`), so the client stores it through the
   * one code path it already has.
   */
  async exchange(ctx: RequestContext): Promise<void> {
    this.enforce(ctx, 'auth:oauth-exchange', OAuthRoutes.EXCHANGE_POLICY);
    const body = await readJSONBody(ctx.req);
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code) throw new HttpError(400, 'code is required', 101);

    const handoff = this.flows.redeemHandoff(code);
    if (!handoff) {
      // One answer for expired, already-used and never-existed — no oracle for
      // code guessing, which is the only thing this endpoint is guessable for.
      throw new HttpError(400, 'This sign-in code is not valid. It may have expired or already been used.', 101);
    }

    const user = await this.deps.facade.rawFetch('_User', handoff.userId);
    const wire = await this.deps.facade.wireRecord('_User', user);
    sendJSON(ctx.res, 200, {
      ...wire,
      sessionToken: handoff.sessionToken,
      /** How the account was resolved — `created`, `linked`, `linked-credentials-revoked`, `signed-in`. */
      authOutcome: handoff.outcome,
      /** A message worth showing the user, or null. Rule 5 is the case that sets it. */
      authNotice: handoff.notice
    });
  }

  // ==========================================================================
  // Magic links
  // ==========================================================================

  /**
   * `POST /auth/magic-link { email, redirect }` — ALWAYS 200/{}.
   *
   * Same anti-enumeration posture as BAK-002's password reset, and for the same
   * reason: this is an anonymous public endpoint, and a different answer for a
   * known address turns it into an account-existence oracle. Failures are loud
   * in the server log, silent to the caller.
   */
  async requestMagicLink(ctx: RequestContext): Promise<void> {
    this.enforce(ctx, 'auth:magic-link', OAuthRoutes.MAGIC_SEND_POLICY);
    const body = await readJSONBody(ctx.req);
    const email = String(body.email || '').trim().toLowerCase();
    const redirect = typeof body.redirect === 'string' ? body.redirect : undefined;

    void this.tryIssueMagicLink(email, redirect).catch((e) =>
      logger.error('auth.magic-link-failed', { detail: e instanceof Error ? e.message : String(e) })
    );
    sendJSON(ctx.res, 200, {});
  }

  private async tryIssueMagicLink(email: string, redirect: string | undefined): Promise<void> {
    if (!email || !email.includes('@')) return;

    const config = this.deps.auth.config.magicLink;
    if (!config.enabled) {
      logger.warn('auth.magic-link-disabled', {
        detail: 'A magic link was requested but magicLink.enabled is false in auth.json. No mail was sent.'
      });
      return;
    }
    if (!this.deps.emailConfig.isConfigured()) {
      logger.warn('auth.magic-link-no-email', { detail: this.deps.emailConfig.notConfiguredReason() });
      return;
    }

    // Authorise the destination NOW, at request time, so the click cannot carry
    // a destination nobody vetted.
    const decision = resolveRedirect(
      redirect || DEFAULT_REDIRECT_PATH,
      this.baseUrl(),
      this.deps.auth.config.redirectAllowList
    );
    if (!decision.ok) {
      logger.warn('auth.redirect-refused', { flow: 'magic-link', detail: decision.reason });
      return;
    }

    const { results } = await this.deps.facade.rawQuery('_User', { where: { email }, limit: 1 });
    const user = results[0];
    if (!user && !(config.allowSignup && this.deps.signupAllowedForAnonymous())) {
      logger.warn('auth.magic-link-unknown-address', {
        detail: 'A magic link was requested for an unknown address and signup is not allowed. No mail was sent.'
      });
      return;
    }

    const ttlMs = config.ttlMinutes > 0 ? config.ttlMinutes * 60_000 : MAGIC_LINK_DEFAULT_TTL_MS;
    const token = await this.deps.tokens.issue(user ? (user.objectId as string) : '', 'magic', ttlMs, {
      email,
      redirectUrl: decision.url
    });
    const linkUrl = `${this.baseUrl()}/auth/magic-link/callback?token=${encodeURIComponent(token)}`;

    const rendered = renderTemplate(this.deps.emailConfig.effectiveTemplate('magicLink'), {
      appName: this.deps.backendName,
      magicLinkUrl: linkUrl,
      expiresIn: `${Math.round(ttlMs / 60_000)} minutes`
    });
    const result = await this.deps.mailer.send({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html
    });
    if (!result.success) logger.error('auth.magic-link-send-failed', { detail: result.error });
  }

  /**
   * `GET /auth/magic-link/callback?token=` — the click.
   *
   * Runs through the SAME linking rule as an OIDC sign-in, by presenting itself
   * as a verified-email assertion from a provider called `magic-link`. That is
   * not a shortcut: a magic link IS proof of inbox control, so it should carry
   * exactly the weight (including rule 5's credential revocation) that a
   * provider's verified email does. One rule, one set of tests, no second path
   * for an attacker to find the gap in.
   */
  async magicLinkCallback(ctx: RequestContext): Promise<void> {
    this.enforce(ctx, 'auth:magic-consume', { ratePerMinute: 20 / 15, burst: 20 });

    const token = ctx.query.token || '';
    const row = token ? await this.deps.tokens.consumeRow(token, 'magic') : null;
    if (!row) {
      sendErrorPage(
        ctx.res,
        400,
        'Sign-in link expired',
        'This sign-in link is invalid, expired, or has already been used. Request a new one from the app.'
      );
      return;
    }

    const email = String(row.email || '').toLowerCase();
    const redirectUrl = String(row.redirectUrl || `${this.baseUrl()}/`);
    if (!email) {
      sendErrorPage(ctx.res, 400, 'Sign-in link invalid', 'This sign-in link carries no address.');
      return;
    }

    const identity: ProviderIdentity = {
      providerId: 'magic-link',
      // The address IS the identity here, namespaced so it can never collide
      // with an OIDC `sub` (and prefixed for the same reason GitHub's is).
      subject: `email:${email}`,
      email,
      emailVerified: true,
      displayName: null,
      raw: {}
    };

    await this.finishSignIn(ctx, identity, 'magic link', this.deps.auth.config.magicLink.allowSignup, redirectUrl);
  }

  // ==========================================================================
  // Identities on the current user
  // ==========================================================================

  /** `GET /users/me/identities` — what this account can sign in with. */
  async listIdentities(ctx: RequestContext, userId: string): Promise<void> {
    const rows = await this.identities.listForUser(userId);
    const user = await this.deps.facade.rawFetch('_User', userId);
    sendJSON(ctx.res, 200, {
      hasPassword: typeof user._hashed_password === 'string' && (user._hashed_password as string).length > 0,
      identities: rows.map((row) => ({
        objectId: row.objectId,
        provider: row.provider,
        displayName: this.providerLabel(row.provider),
        email: row.email,
        emailVerified: isFlagSet(row.emailVerified),
        createdAt: row.createdAt,
        lastLoginAt: row.lastLoginAt
      }))
    });
  }

  private providerLabel(providerId: string): string {
    if (providerId === 'magic-link') return 'Magic link';
    const provider = this.deps.auth.provider(providerId);
    return provider ? provider.displayName : providerId;
  }

  /** `DELETE /users/me/identities/:id` — unlink, unless it is the last way in. */
  async unlinkIdentity(ctx: RequestContext, userId: string, identityId: string): Promise<void> {
    try {
      await this.identities.unlink(userId, identityId);
    } catch (e) {
      if (e instanceof AuthLinkError) {
        throw new HttpError(e.code === 'IDENTITY_NOT_FOUND' ? 404 : 400, e.message, 101);
      }
      throw e;
    }
    sendJSON(ctx.res, 200, { ok: true });
  }

  // ==========================================================================
  // The "did it work" page, for an operator testing a provider by hand
  // ==========================================================================

  /**
   * When the redirect target is this backend's own root — the default when an
   * app passes no `redirect` — there is no app to consume the handoff code, and
   * a bare 302 to `/` gives an operator testing a provider console nothing to
   * look at. This is not used by apps; it exists so "does my Google client id
   * work" is answerable in a browser with no app deployed.
   */
  serveHandoffLanding(ctx: RequestContext): void {
    sendHTML(
      ctx.res,
      200,
      page(
        'Signed in',
        '<h2 class="ok">Sign-in completed</h2>' +
          '<p>This backend completed the provider round-trip and issued a one-time code. An app would now ' +
          `exchange it at <code>POST /oauth/exchange</code>.</p><p>Pass <code>?redirect=</code> to ` +
          '<code>/oauth/&lt;provider&gt;/start</code> to send the browser to your app instead.</p>'
      )
    );
  }
}
