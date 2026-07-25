/**
 * The two public account-mail flows (BAK-002), un-501ing the WF-004 stubs:
 *
 *   POST /requestPasswordReset                       { email }
 *   GET  /apps/:appId/request_password_reset          ?token=&username=  (serves the reset FORM)
 *   POST /apps/:appId/request_password_reset          { username, token, new_password }
 *   POST /verificationEmailRequest                    { email }
 *   GET  /apps/:appId/verify_email                    ?username=&token=
 *
 * These shapes are not designed here — they are the ones `userservice.ts`
 * already emits (WF-004 wire map) and the two the client reads as an HTML
 * page rather than JSON. See that file's `resetPassword` / `requestPasswordReset`
 * / `sendEmailVerification` / `verifyEmail` methods for the exact contract.
 *
 * Two doctrines in tension, resolved deliberately:
 *
 *   - Anti-enumeration: `/requestPasswordReset` and `/verificationEmailRequest`
 *     respond IDENTICALLY (200, empty body) whether or not the address is
 *     known, and whether or not the send actually succeeded — the public,
 *     anonymous surface must never become an oracle for "does this account
 *     exist" or "is this backend's SMTP working". Failures here are logged
 *     server-side (loud to the OPERATOR) but never surfaced to the caller.
 *   - Loud failure (RUN-004): the ADMIN-authenticated surfaces — the Send
 *     Email node's execution record, and the panel/MCP test-send call — DO
 *     throw the actionable "email not configured" message verbatim. Those
 *     callers already know who they are; there is no enumeration risk.
 *
 * Rate limiting: fixed-window, keyed by client address, on both
 * *-request endpoints (the spec's "two public endpoints") plus the two
 * token-consuming endpoints as defense-in-depth against token guessing.
 *
 * @module nodegx-backend/server/email-routes
 */

import type * as http from 'http';

import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { EmailConfigState } from '../email/EmailConfigState';
import type { Mailer } from '../email/Mailer';
import { EmailTokenStore, RESET_TTL_MS, VERIFY_TTL_MS } from '../email/tokens';
import { renderTemplate } from '../email/templates';
import { RateLimiter, clientKey } from './rate-limit';
import { hashPassword } from './users';
import { HttpError, readJSONBody, sendJSON } from './http-util';

function safeLog(...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.warn('[nodegx-backend/email]', ...args);
  } catch {
    // Ignore EPIPE
  }
}

function sendHTML(res: http.ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
  res.end(html);
}

function page(title: string, body: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>body{font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:420px;margin:64px auto;' +
    'padding:0 16px;color:#1a1a1a}input{width:100%;box-sizing:border-box;padding:8px;margin:6px 0 14px;' +
    'font-size:14px}button{padding:8px 16px;font-size:14px;cursor:pointer}.err{color:#a12}.ok{color:#173}</style>' +
    `</head><body>${body}</body></html>`
  );
}

const RESET_FORM_TEMPLATE = (username: string, token: string, appId: string) =>
  page(
    'Reset your password',
    '<h2>Reset your password</h2>' +
      `<form method="POST" action="/apps/${encodeURIComponent(appId)}/request_password_reset">` +
      `<input type="hidden" name="username" value="${escapeHtml(username)}">` +
      `<input type="hidden" name="token" value="${escapeHtml(token)}">` +
      '<label>New password<input type="password" name="new_password" required minlength="1" autofocus></label>' +
      '<button type="submit">Reset password</button>' +
      '</form>' +
      // A plain HTML form POSTs as x-www-form-urlencoded; processPasswordReset
      // accepts both that and JSON so this page needs no client-side script.
      ''
  );

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export interface EmailRoutesDeps {
  facade: AdapterFacade;
  emailConfig: EmailConfigState;
  mailer: Mailer;
  tokens: EmailTokenStore;
  backendId: string;
  backendName: string;
  /** `http://<host>:<port>` of THIS running instance — the loud-warned fallback when `baseUrl` is unset. */
  getLocalUrl: () => string;
}

export class EmailRoutes {
  private readonly facade: AdapterFacade;
  private readonly emailConfig: EmailConfigState;
  private readonly mailer: Mailer;
  private readonly tokens: EmailTokenStore;
  private readonly backendId: string;
  private readonly backendName: string;
  private readonly getLocalUrl: () => string;

  // Fixed-window: 5 requests / 15 minutes per client address, per bucket.
  private readonly requestLimiter = new RateLimiter(5, 15 * 60 * 1000);
  private readonly consumeLimiter = new RateLimiter(20, 15 * 60 * 1000);

  constructor(deps: EmailRoutesDeps) {
    this.facade = deps.facade;
    this.emailConfig = deps.emailConfig;
    this.mailer = deps.mailer;
    this.tokens = deps.tokens;
    this.backendId = deps.backendId;
    this.backendName = deps.backendName;
    this.getLocalUrl = deps.getLocalUrl;
  }

  private baseUrl(): string {
    return this.emailConfig.effectiveBaseUrl(this.getLocalUrl()).url;
  }

  private async findUserBy(field: 'email' | 'username', value: string): Promise<Record<string, unknown> | null> {
    if (!value) return null;
    const { results } = await this.facade.rawQuery('_User', { where: { [field]: value }, limit: 1 });
    return results[0] || null;
  }

  private async deleteAllSessions(userId: string): Promise<void> {
    const { results } = await this.facade.rawQuery('_Session', { where: { userId } });
    for (const session of results) {
      await this.facade.rawDelete('_Session', session.objectId as string);
    }
  }

  // ==========================================================================
  // Password reset — initiate
  // ==========================================================================

  /** POST /requestPasswordReset — always 200/{} (anti-enumeration; see module doc). */
  async requestPasswordReset(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.requestLimiter.allow('reset:' + clientKey(req))) {
      throw new HttpError(429, 'Too many password reset requests. Try again later.');
    }
    const body = await readJSONBody(req);
    const email = String(body.email || '');

    void this.tryInitiatePasswordReset(email).catch((e) => safeLog('requestPasswordReset failed:', e));
    sendJSON(res, 200, {});
  }

  private async tryInitiatePasswordReset(email: string): Promise<void> {
    if (!email) return;
    const user = await this.findUserBy('email', email);
    if (!user) {
      safeLog(`Password reset requested for unknown email (no mail sent).`);
      return;
    }
    if (!this.emailConfig.isConfigured()) {
      safeLog(`Password reset requested for a known account, but ${this.emailConfig.notConfiguredReason()}`);
      return;
    }
    const token = await this.tokens.issue(user.objectId as string, 'reset', RESET_TTL_MS);
    const resetUrl = `${this.baseUrl()}/apps/${encodeURIComponent(this.backendId)}/request_password_reset?token=${encodeURIComponent(token)}&username=${encodeURIComponent(String(user.username))}`;
    const rendered = renderTemplate(this.emailConfig.effectiveTemplate('passwordReset'), {
      appName: this.backendName,
      username: String(user.username || ''),
      resetUrl,
      expiresIn: '1 hour'
    });
    const result = await this.mailer.send({ to: String(user.email), subject: rendered.subject, text: rendered.text, html: rendered.html });
    if (!result.success) safeLog(`Password reset email failed to send: ${result.error}`);
  }

  // ==========================================================================
  // Password reset — the served form + processing
  // ==========================================================================

  /** GET /apps/:appId/request_password_reset?token=&username= — the minimal served page. */
  servePasswordResetForm(res: http.ServerResponse, query: Record<string, string>, appId: string): void {
    const { token, username } = query;
    if (!token || !username) {
      sendHTML(res, 400, page('Invalid link', '<h2 class="err">Invalid Link</h2><p>This password reset link is incomplete.</p>'));
      return;
    }
    sendHTML(res, 200, RESET_FORM_TEMPLATE(username, token, appId));
  }

  /** POST /apps/:appId/request_password_reset — the shape `userservice.ts#resetPassword` posts, and the form above. */
  async processPasswordReset(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.consumeLimiter.allow('reset-consume:' + clientKey(req))) {
      sendHTML(res, 429, page('Too many attempts', '<h2 class="err">Invalid Link</h2><p>Too many attempts. Try again later.</p>'));
      return;
    }
    const body = await this.readBody(req);
    const username = String(body.username || '');
    const token = String(body.token || '');
    const newPassword = String(body.new_password || body.newPassword || '');

    if (!username || !token || !newPassword) {
      sendHTML(res, 400, page('Invalid link', '<h2 class="err">Invalid Link</h2><p>Missing username, token, or new password.</p>'));
      return;
    }

    const user = await this.findUserBy('username', username);
    const userId = user ? await this.tokens.consume(token, 'reset', user.objectId as string) : null;
    if (!user || !userId) {
      sendHTML(
        res,
        400,
        page('Invalid link', '<h2 class="err">Invalid Link</h2><p>This reset link is invalid, expired, or already used.</p>')
      );
      return;
    }

    await this.facade.rawSave('_User', userId, { _hashed_password: hashPassword(newPassword) });
    // Reset invalidates EVERY session for the user — there is no "current"
    // session to preserve during an out-of-band reset (BAK-002 scope item).
    await this.deleteAllSessions(userId);

    sendHTML(res, 200, page('Password reset', '<h2 class="ok">Password successfully reset</h2><p>You can now log in with your new password.</p>'));
  }

  /** Accept both a JSON body (direct API callers, e.g. userservice.ts) and an HTML form POST. */
  private async readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const params = new URLSearchParams(Buffer.concat(chunks).toString('utf-8'));
      const out: Record<string, unknown> = {};
      for (const [key, value] of params) out[key] = value;
      return out;
    }
    return readJSONBody(req);
  }

  // ==========================================================================
  // Email verification
  // ==========================================================================

  /** POST /verificationEmailRequest — always 200/{} (same anti-enumeration posture as password reset). */
  async requestEmailVerification(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!this.requestLimiter.allow('verify:' + clientKey(req))) {
      throw new HttpError(429, 'Too many verification requests. Try again later.');
    }
    const body = await readJSONBody(req);
    const email = String(body.email || '');

    void this.tryInitiateVerification(email).catch((e) => safeLog('requestEmailVerification failed:', e));
    sendJSON(res, 200, {});
  }

  private async tryInitiateVerification(email: string): Promise<void> {
    if (!email) return;
    const user = await this.findUserBy('email', email);
    if (!user) {
      safeLog('Verification requested for unknown email (no mail sent).');
      return;
    }
    if (user.emailVerified === true) return;
    if (!this.emailConfig.isConfigured()) {
      safeLog(`Verification requested for a known account, but ${this.emailConfig.notConfiguredReason()}`);
      return;
    }
    await this.sendVerificationEmail(user);
  }

  /** Shared by the re-request endpoint and (best-effort, opt-in) signup. */
  async sendVerificationEmail(user: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (!this.emailConfig.isConfigured()) {
      return { success: false, error: this.emailConfig.notConfiguredReason() };
    }
    const token = await this.tokens.issue(user.objectId as string, 'verify', VERIFY_TTL_MS);
    const verifyUrl = `${this.baseUrl()}/apps/${encodeURIComponent(this.backendId)}/verify_email?username=${encodeURIComponent(String(user.username))}&token=${encodeURIComponent(token)}`;
    const rendered = renderTemplate(this.emailConfig.effectiveTemplate('verifyEmail'), {
      appName: this.backendName,
      username: String(user.username || ''),
      verifyUrl
    });
    const result = await this.mailer.send({ to: String(user.email), subject: rendered.subject, text: rendered.text, html: rendered.html });
    if (!result.success) safeLog(`Verification email failed to send: ${result.error}`);
    return result;
  }

  /** GET /apps/:appId/verify_email?username=&token= */
  async verifyEmail(res: http.ServerResponse, query: Record<string, string>): Promise<void> {
    if (!this.consumeLimiter.allow('verify-consume:' + (query.username || 'anon'))) {
      sendHTML(res, 429, page('Too many attempts', '<h2 class="err">Invalid Verification Link</h2><p>Too many attempts. Try again later.</p>'));
      return;
    }
    const username = String(query.username || '');
    const token = String(query.token || '');
    const user = username ? await this.findUserBy('username', username) : null;
    const userId = user && token ? await this.tokens.consume(token, 'verify', user.objectId as string) : null;

    if (!user || !userId) {
      sendHTML(
        res,
        400,
        page('Invalid link', '<h2 class="err">Invalid Verification Link</h2><p>This verification link is invalid, expired, or already used.</p>')
      );
      return;
    }

    await this.facade.rawSave('_User', userId, { emailVerified: true });
    sendHTML(res, 200, page('Email verified', '<h2 class="ok">Successfully verified your email</h2>'));
  }
}
