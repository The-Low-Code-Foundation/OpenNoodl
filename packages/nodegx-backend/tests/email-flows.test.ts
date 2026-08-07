/**
 * BAK-002 — end-to-end tests for the email subsystem against a real
 * BackendService (real node:sqlite, real HTTP), with only the SMTP transport
 * faked (via `Mailer.setTransportForTesting` — the one deliberate test seam;
 * see src/email/Mailer.ts). Covers:
 *
 *   - admin config / test-send / templates surface
 *   - password reset end-to-end (issue -> served form -> consume -> session
 *     invalidation), matching the exact wire shapes `userservice.ts` emits
 *   - email verification end-to-end + the per-backend login policy toggle
 *   - anti-enumeration (uniform responses) and rate limiting
 *   - the Send Email node, executed through the real WorkflowRunner/CloudRunner,
 *     both configured (success) and unconfigured (loud failure into the
 *     execution record) — the spec's "workflow sends email... with SMTP
 *     unconfigured the same workflow fails loudly" success criterion.
 *
 * Each test group uses its own `X-Forwarded-For` value so the fixed-window
 * rate limiter (keyed by client address) can't cross-contaminate unrelated
 * tests; the dedicated rate-limit test exercises the real shared limiter.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { WorkflowExecution } from '../src/execution/ExecutionStore';
import type {
  TemplateListResponse,
  TemplateMutationResponse,
  TemplatePreviewResponse
} from '../src/server/admin-email';
import { BackendService } from '../src/service';

import { adminHeaders, ErrorBody, request, UserResponse } from './helpers/http';

jest.setTimeout(30000);

/** `GET`/`PUT /admin/email/config` and `POST /admin/email/test`. */
interface EmailConfigResponse {
  success?: boolean;
  config?: Record<string, unknown>;
  configured: boolean;
  hasSmtpPassword: boolean;
  notConfiguredReason?: string | null;
  retried?: boolean;
  baseUrlWarning?: boolean;
}

interface FakeSentMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

describe('BAK-002 email subsystem', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let sent: FakeSentMail[];

  // The admin credential rides every call unless a test overrides it. FH-024:
  // dev-open no longer relaxes the admin gate, so `/admin/email/*` wants the
  // token on a dev-open backend too — which is what the editor's Email panel
  // already sends through the supervisor.
  const req = <T = unknown>(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ) => request<T>(base, method, pathName, { body, headers: { ...adminHeaders(dataDir), ...headers } });

  async function reqText(
    method: string,
    pathName: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; text: string; contentType: string | null }> {
    const isForm = body !== undefined && typeof body === 'string';
    const res = await fetch(`${base}${pathName}`, {
      method,
      headers:
        body !== undefined
          ? { 'content-type': isForm ? 'application/x-www-form-urlencoded' : 'application/json', ...headers }
          : headers,
      body: body !== undefined ? (isForm ? body : JSON.stringify(body)) : undefined
    });
    const text = await res.text();
    return { status: res.status, text, contentType: res.headers.get('content-type') };
  }

  /** Configure SMTP as "on" and inject the fake, network-free transport. */
  function configureEmail(overrides: Record<string, unknown> = {}) {
    return req<EmailConfigResponse>('PUT', '/admin/email/config', {
      smtpPassword: 'app-password',
      config: {
        enabled: true,
        smtp: { host: 'smtp.example.com', port: 587, secure: false, username: 'apikey' },
        fromAddress: 'noreply@example.com',
        fromName: 'Test App',
        ...overrides
      }
    });
  }

  function extractUrl(text: string): string {
    const match = text.match(/https?:\/\/[^\s<"]+/);
    if (!match) throw new Error(`No URL found in mail body: ${text}`);
    return match[0];
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-email-test-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'email_test', backendName: 'Email Test Backend' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.persistence.status.persistent).toBe(true);

    sent = [];
    service.getMailerForTesting()!.setTransportForTesting({
      sendMail: async (opts: Record<string, unknown>) => {
        sent.push({ to: opts.to as string, subject: opts.subject as string, text: opts.text as string, html: opts.html as string | undefined });
      }
    });
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Admin config surface
  // ==========================================================================

  describe('admin config surface', () => {
    it('GET /admin/email/config starts unconfigured', async () => {
      const { status, json } = await req<EmailConfigResponse>('GET', '/admin/email/config');
      expect(status).toBe(200);
      expect(json.configured).toBe(false);
      expect(json.hasSmtpPassword).toBe(false);
      expect(json.notConfiguredReason).toMatch(/SMTP host\/port/);
    });

    it('PUT /admin/email/config sets config and the SMTP password separately', async () => {
      const { status, json } = await configureEmail();
      expect(status).toBe(200);
      expect(json.configured).toBe(true);
      expect(json.hasSmtpPassword).toBe(true);
      // The password is never echoed back anywhere in the config response.
      expect(JSON.stringify(json)).not.toContain('app-password');
    });

    it('PUT /admin/email/config rejects a structurally invalid config', async () => {
      const { status } = await req('PUT', '/admin/email/config', { config: { smtp: { port: 'not-a-number' } } });
      expect(status).toBe(400);
    });

    it('persists across a fresh EmailConfigState load (same dataDir)', async () => {
      // Indirect check: re-reading config still reports configured (already
      // proven at the unit level in email-config.test.ts; here it's the HTTP
      // surface that must reflect the same persisted state after other tests
      // run against this same service instance).
      const { json } = await req<EmailConfigResponse>('GET', '/admin/email/config');
      expect(json.configured).toBe(true);
    });
  });

  // ==========================================================================
  // Test send
  // ==========================================================================

  describe('test send', () => {
    it('fails loudly (503) when unconfigured', async () => {
      // A throwaway service instance so this test doesn't depend on ordering
      // relative to the "admin config surface" group above.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-email-unconfigured-'));
      const svc = new BackendService({ dataDir: dir, port: 0, backendId: 'unconf', backendName: 'Unconfigured' });
      const started = await svc.start();
      try {
        const res = await fetch(`${started.listen.url}/admin/email/test`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...adminHeaders(dir) },
          body: JSON.stringify({ to: 'someone@example.com' })
        });
        expect(res.status).toBe(503);
        const json = (await res.json()) as ErrorBody;
        expect(json.error).toMatch(/not configured/i);
      } finally {
        await svc.stop();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('succeeds and actually reaches the (fake) transport once configured', async () => {
      await configureEmail();
      const before = sent.length;
      const { status, json } = await req<EmailConfigResponse>('POST', '/admin/email/test', { to: 'operator@example.com' });
      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(sent.length).toBe(before + 1);
      expect(sent[sent.length - 1].to).toBe('operator@example.com');
    });

    it('reports the baseUrl fallback warning when no baseUrl is configured', async () => {
      const { json } = await req<EmailConfigResponse>('POST', '/admin/email/test', { to: 'operator@example.com' });
      expect(json.baseUrlWarning).toBe(true); // no baseUrl set anywhere in this suite
    });
  });

  // ==========================================================================
  // Templates
  // ==========================================================================

  describe('templates', () => {
    it('GET /admin/email/templates enumerates the shipped set, none overridden yet', async () => {
      const { status, json } = await req<TemplateListResponse>('GET', '/admin/email/templates');
      expect(status).toBe(200);
      const ids = json.templates.map((t) => t.id).sort();
      // `magicLink` joined the shipped set in BAK-004: passwordless sign-in
      // reuses this template system rather than growing a second one.
      expect(ids).toEqual(['magicLink', 'passwordReset', 'verifyEmail']);
      expect(json.templates.every((t) => t.isOverridden === false)).toBe(true);
    });

    it('PUT sets an override, GET reflects it as overridden, preview renders it', async () => {
      const put = await req('PUT', '/admin/email/templates/passwordReset', { subject: 'Custom subject {{username}}' });
      expect(put.status).toBe(200);

      const get = await req<TemplateListResponse>('GET', '/admin/email/templates');
      const entry = get.json.templates.find((t) => t.id === 'passwordReset');
      expect(entry?.isOverridden).toBe(true);
      expect(entry?.effective.subject).toBe('Custom subject {{username}}');
      // The other fields fall back to the shipped default (merge, not replace).
      expect(entry?.effective.text).toContain('{{resetUrl}}');

      const preview = await req<TemplatePreviewResponse>('GET', '/admin/email/templates/passwordReset/preview');
      expect(preview.json.preview.subject).toBe('Custom subject jane.doe');
    });

    it('DELETE reverts to the shipped default', async () => {
      const del = await req<TemplateMutationResponse>('DELETE', '/admin/email/templates/passwordReset');
      expect(del.status).toBe(200);
      expect(del.json.removed).toBe(true);

      const get = await req<TemplateListResponse>('GET', '/admin/email/templates');
      const entry = get.json.templates.find((t) => t.id === 'passwordReset');
      expect(entry?.isOverridden).toBe(false);
    });

    it('404s on an unknown template id', async () => {
      const { status } = await req('PUT', '/admin/email/templates/bogus', { subject: 'x' });
      expect(status).toBe(404);
    });
  });

  // ==========================================================================
  // Password reset — end to end
  // ==========================================================================

  describe('password reset flow', () => {
    const ip = { 'x-forwarded-for': 'reset-flow-client' };

    beforeAll(async () => {
      await configureEmail();
      await req('POST', '/users', { username: 'alice', password: 'orig-password', email: 'alice@example.com' });
    });

    it('is indistinguishable for a known vs. unknown address (anti-enumeration)', async () => {
      const known = await req('POST', '/requestPasswordReset', { email: 'alice@example.com' }, ip);
      const unknown = await req('POST', '/requestPasswordReset', { email: 'nobody@example.com' }, ip);
      expect(known.status).toBe(unknown.status);
      expect(known.json).toEqual(unknown.json);
      expect(known.status).toBe(200);
    });

    it('goes end-to-end: email -> served form -> new password -> old session dead -> new password works', async () => {
      // A session that must die when the reset completes.
      const login = await req<UserResponse>('POST', '/login', { username: 'alice', password: 'orig-password', _method: 'GET' });
      expect(login.status).toBe(200);
      const oldToken = login.json.sessionToken;
      if (!oldToken) throw new Error('login returned no sessionToken');

      sent.length = 0;
      const initiate = await req('POST', '/requestPasswordReset', { email: 'alice@example.com' }, ip);
      expect(initiate.status).toBe(200);
      // Fire-and-forget: give the async send a tick to land.
      await new Promise((r) => setTimeout(r, 50));
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('alice@example.com');

      const resetUrl = extractUrl(sent[0].text);
      const parsed = new URL(resetUrl);
      expect(parsed.pathname).toBe('/apps/email_test/request_password_reset');
      const token = parsed.searchParams.get('token')!;
      const username = parsed.searchParams.get('username')!;
      expect(username).toBe('alice');

      // The served form itself.
      const form = await reqText('GET', `${parsed.pathname}${parsed.search}`);
      expect(form.status).toBe(200);
      expect(form.contentType).toContain('text/html');
      expect(form.text).toContain(`value="${token}"`);
      expect(form.text).toContain('name="new_password"');

      // Process it (the shape userservice.ts#resetPassword posts).
      const processed = await reqText('POST', '/apps/email_test/request_password_reset', {
        username,
        token,
        new_password: 'new-password-123'
      });
      expect(processed.status).toBe(200);
      expect(processed.text).toContain('Password successfully reset');

      // Old session is dead.
      const me = await req<UserResponse>('GET', '/users/me', undefined, { 'X-Parse-Session-Token': oldToken });
      expect(me.json.code).toBe(209);

      // New password works; old one doesn't.
      const loginOld = await req('POST', '/login', { username: 'alice', password: 'orig-password', _method: 'GET' });
      expect(loginOld.status).toBe(404);
      const loginNew = await req('POST', '/login', { username: 'alice', password: 'new-password-123', _method: 'GET' });
      expect(loginNew.status).toBe(200);
    });

    it('rejects a reused token (single-use)', async () => {
      sent.length = 0;
      await req('POST', '/requestPasswordReset', { email: 'alice@example.com' }, ip);
      await new Promise((r) => setTimeout(r, 50));
      const parsed = new URL(extractUrl(sent[0].text));
      const token = parsed.searchParams.get('token')!;

      const first = await reqText('POST', '/apps/email_test/request_password_reset', {
        username: 'alice',
        token,
        new_password: 'another-password'
      });
      expect(first.text).toContain('Password successfully reset');

      const second = await reqText('POST', '/apps/email_test/request_password_reset', {
        username: 'alice',
        token,
        new_password: 'yet-another-password'
      });
      expect(second.status).toBe(400);
      expect(second.text).toContain('Invalid Link');
    });

    it('rejects a garbage token with the served failure page', async () => {
      const res = await reqText('POST', '/apps/email_test/request_password_reset', {
        username: 'alice',
        token: 'not-a-real-token',
        new_password: 'whatever123'
      });
      expect(res.status).toBe(400);
      expect(res.text).toContain('Invalid Link');
    });

    it('the served GET form 400s on a link missing token/username', async () => {
      const res = await reqText('GET', '/apps/email_test/request_password_reset');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // Email verification + login policy
  // ==========================================================================

  describe('email verification + login policy', () => {
    const ip = { 'x-forwarded-for': 'verify-flow-client' };

    beforeAll(async () => {
      await configureEmail({ verification: { sendOnSignup: true, requireForLogin: true } });
    });

    afterAll(async () => {
      // Leave the policy off so it doesn't affect any test file order.
      await configureEmail({ verification: { sendOnSignup: false, requireForLogin: false } });
    });

    it('signup best-effort sends a verification email, and login is blocked until verified', async () => {
      sent.length = 0;
      const signup = await req('POST', '/users', { username: 'bob', password: 'pw123456', email: 'bob@example.com' });
      expect(signup.status).toBe(201);
      await new Promise((r) => setTimeout(r, 50));
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toMatch(/Verify your email/);

      const blocked = await req<UserResponse>('POST', '/login', { username: 'bob', password: 'pw123456', _method: 'GET' });
      expect(blocked.status).toBe(403);
      expect(blocked.json.code).toBe(205);

      const verifyUrl = extractUrl(sent[0].text);
      const parsed = new URL(verifyUrl);
      expect(parsed.pathname).toBe('/apps/email_test/verify_email');
      const token = parsed.searchParams.get('token')!;
      const username = parsed.searchParams.get('username')!;
      expect(username).toBe('bob');

      const verified = await reqText('GET', `${parsed.pathname}?username=${username}&token=${token}`);
      expect(verified.status).toBe(200);
      expect(verified.text).toContain('Successfully verified your email');

      const allowed = await req('POST', '/login', { username: 'bob', password: 'pw123456', _method: 'GET' });
      expect(allowed.status).toBe(200);
    });

    it('re-request (/verificationEmailRequest) is uniform for known vs unknown addresses', async () => {
      const known = await req('POST', '/verificationEmailRequest', { email: 'bob@example.com' }, ip);
      const unknown = await req('POST', '/verificationEmailRequest', { email: 'nobody@example.com' }, ip);
      expect(known.status).toBe(200);
      expect(known.json).toEqual(unknown.json);
    });

    it('rejects an invalid verify token with the served failure page', async () => {
      const res = await reqText('GET', '/apps/email_test/verify_email?username=bob&token=garbage');
      expect(res.status).toBe(400);
      expect(res.text).toContain('Invalid Verification Link');
    });
  });

  // ==========================================================================
  // Rate limiting
  // ==========================================================================

  describe('rate limiting', () => {
    it('the 6th /requestPasswordReset from the same client within the window is 429', async () => {
      const headers = { 'x-forwarded-for': 'rate-limit-test-client' };
      const results: number[] = [];
      for (let i = 0; i < 6; i++) {
        const { status } = await req('POST', '/requestPasswordReset', { email: `x${i}@example.com` }, headers);
        results.push(status);
      }
      expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(results[5]).toBe(429);
    });

    it('a different client is unaffected by another client\'s limit', async () => {
      const { status } = await req('POST', '/requestPasswordReset', { email: 'fresh@example.com' }, {
        'x-forwarded-for': 'a-totally-different-client'
      });
      expect(status).toBe(200);
    });
  });

  // ==========================================================================
  // The Send Email node, via the real WorkflowRunner/CloudRunner
  // ==========================================================================

  describe('Send Email node (WorkflowRunner integration)', () => {
    const NOTIFY_WORKFLOW = {
      components: [
        {
          name: '/#__cloud__/notify',
          nodes: [
            { id: 'req1', type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth: true, params: 'to' }, ports: [], children: [] },
            {
              id: 'mail1',
              type: 'noodl.cloud.sendemail',
              x: 0,
              y: 100,
              parameters: { subject: 'Notification', text: 'Hello from a workflow' },
              ports: [],
              children: []
            },
            { id: 'res1', type: 'noodl.cloud.response', x: 0, y: 200, parameters: {}, ports: [], children: [] },
            {
              id: 'resFail',
              type: 'noodl.cloud.response',
              x: 200,
              y: 200,
              parameters: { status: 'failure' },
              ports: [],
              children: []
            }
          ],
          connections: [
            { sourceId: 'req1', sourcePort: 'receive', targetId: 'mail1', targetPort: 'send' },
            { sourceId: 'req1', sourcePort: 'pm-to', targetId: 'mail1', targetPort: 'to' },
            // ⚠️ `done`/`failure`, not `sent`/`failed`. ERG-001 §4 renamed this node's outcome
            // ports to the shared `outcomeOutputs` set, and this fixture kept the old names — which
            // `addConnection` accepts in silence, because it never checks that a port exists. Both
            // wires went nowhere, no Response node was ever reached, and the two specs below hung
            // to jest's 30s limit instead of failing. Red for days, and read as "flaky email tests".
            { sourceId: 'mail1', sourcePort: 'done', targetId: 'res1', targetPort: 'send' },
            { sourceId: 'mail1', sourcePort: 'failure', targetId: 'resFail', targetPort: 'send' },
            { sourceId: 'mail1', sourcePort: 'error', targetId: 'resFail', targetPort: 'errorMessage' }
          ],
          roots: []
        }
      ],
      settings: {},
      metadata: {}
    };

    let notifyDir: string;
    let notifySvc: BackendService;
    let notifyBase: string;
    let notifySent: FakeSentMail[];

    beforeAll(async () => {
      notifyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-backend-sendemail-test-'));
      fs.mkdirSync(path.join(notifyDir, 'workflows'), { recursive: true });
      fs.writeFileSync(path.join(notifyDir, 'workflows', 'notify.workflow.json'), JSON.stringify(NOTIFY_WORKFLOW));
      notifySvc = new BackendService({ dataDir: notifyDir, port: 0, backendId: 'notify_test', backendName: 'Notify Test' });
      const started = await notifySvc.start();
      notifyBase = started.listen.url;
      notifySent = [];
    });

    afterAll(async () => {
      await notifySvc.stop();
      fs.rmSync(notifyDir, { recursive: true, force: true });
    });

    it('fails loudly through the node when SMTP is unconfigured — recorded, not silently dropped', async () => {
      const res = await fetch(`${notifyBase}/functions/notify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'someone@example.com' })
      });
      // Response node (failure) answers 400 with the error message.
      expect(res.status).toBe(400);
      const json = (await res.json()) as ErrorBody;
      expect(json.error).toMatch(/not configured/i);

      // `/executions` is an admin route (on a path that does not start with
      // `admin/`), so since FH-024 it wants the credential even here.
      const list = await fetch(`${notifyBase}/executions?limit=1`, { headers: adminHeaders(notifyDir) });
      const executions = (await list.json()) as WorkflowExecution[];
      expect(executions[0].status).toBe('error');
    });

    it('sends for real (fake transport) once configured, and the execution records success', async () => {
      notifySvc.getMailerForTesting()!.setTransportForTesting({
        sendMail: async (opts: Record<string, unknown>) => {
          notifySent.push({ to: opts.to as string, subject: opts.subject as string, text: opts.text as string });
        }
      });
      await fetch(`${notifyBase}/admin/email/config`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...adminHeaders(notifyDir) },
        body: JSON.stringify({
          smtpPassword: 'x',
          config: {
            enabled: true,
            smtp: { host: 'smtp.example.com', port: 587, secure: false, username: 'apikey' },
            fromAddress: 'noreply@example.com',
            fromName: 'Notify Test'
          }
        })
      });

      const res = await fetch(`${notifyBase}/functions/notify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'someone@example.com' })
      });
      expect(res.status).toBe(200);
      expect(notifySent).toHaveLength(1);
      expect(notifySent[0].to).toBe('someone@example.com');
      expect(notifySent[0].subject).toBe('Notification');

      const list = await fetch(`${notifyBase}/executions?limit=1`, { headers: adminHeaders(notifyDir) });
      const executions = (await list.json()) as WorkflowExecution[];
      expect(executions[0].status).toBe('success');
    });
  });
});
