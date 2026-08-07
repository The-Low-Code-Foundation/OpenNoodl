/**
 * BAK-009 audit trail.
 *
 * The coverage test is the important one: it walks the LIVE route table and
 * fails when a state-changing privileged route has no declared action. That is
 * the same shape as BAK-003's route-walk, and for the same reason — "did anyone
 * remember to record this?" is not a question a reviewer answers reliably.
 *
 * The rest drives real privileged actions over real sockets and reads the trail
 * back through its own admin route, because an audit trail that records into a
 * table nobody can query is not an audit trail.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { auditActionFor, auditExemptionFor, requiresAuditAction, declaredAuditActions } from '../src/ops/audit-actions';
import { checkClp } from '../src/security/model';
import type { AuditEntry, AuditQueryResult } from '../src/ops/audit';

import { ErrorBody, request } from './helpers/http';

/** `GET /admin/audit` — the query result plus the log's own settings. */
interface AuditResponse extends AuditQueryResult {
  enabled: boolean;
  retentionDays: number;
  actions: string[];
}

jest.setTimeout(30000);

describe('BAK-009 audit trail', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  const req = <T = unknown>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
    request<T>(base, method, p, { body, headers });

  function asAdmin() {
    return { authorization: `Bearer ${adminToken}` };
  }

  const audit = (query = '') =>
    req<AuditResponse>('GET', `/admin/audit${query ? '?' + query : ''}`, undefined, asAdmin());

  async function entries(query = ''): Promise<AuditEntry[]> {
    return (await audit(query)).json.entries;
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-ops-audit-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'backend_audit', backendName: 'Audit Test' });
    const started = await service.start();
    base = started.listen.url;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    if (service) await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('every state-changing privileged route declares an action', () => {
    const missing = service
      .getRouteTable()
      .filter((r) => requiresAuditAction(r.method, r.access.kind))
      .filter((r) => auditActionFor(r.method, r.pattern) === null)
      // An exemption is a declaration too — it just says "considered, and this
      // one changes nothing". A route that is neither declared nor exempt fails.
      .filter((r) => auditExemptionFor(r.method, r.pattern) === null)
      .map((r) => `${r.method} ${r.pattern}`);
    // If this fails: add the route to ops/audit-actions with a name that reads
    // like the act it performs, or explain why the act is not worth recording.
    expect(missing).toEqual([]);
  });

  it('does not declare actions for reads — dashboard polling must not bury the trail', () => {
    const readsWithActions = service
      .getRouteTable()
      .filter((r) => r.method === 'GET')
      .filter((r) => auditActionFor(r.method, r.pattern) !== null);
    expect(readsWithActions).toEqual([]);
  });

  it('records a permission change with actor, origin and request id', async () => {
    const res = await req(
      'PUT',
      '/admin/permissions/collections/Widget',
      { permissions: { find: 'public', get: 'public' } },
      asAdmin()
    );
    expect(res.status).toBe(200);

    const found = (await entries('action=permissions.collection.update'))[0];
    expect(found).toMatchObject({
      action: 'permissions.collection.update',
      actorKind: 'admin',
      outcome: 'success',
      status: 200,
      method: 'PUT',
      route: 'admin/permissions/collections/:name',
      ip: '127.0.0.1'
    });
    expect(found.requestId).toBe(res.headers.get('x-request-id'));
    // The target names WHAT was changed, and the handler's enrichment says how.
    expect(found.target).toMatchObject({ name: 'Widget' });
    expect((found.detail?.rules as { permissions: unknown }).permissions).toMatchObject({ find: 'public' });
  });

  it('records a failed admin login, which is the entry an operator actually looks for', async () => {
    const res = await req('GET', '/admin/status', undefined, { authorization: 'Bearer not-the-token' });
    expect(res.status).toBe(401);

    const found = (await entries('action=admin.login.failed'))[0];
    expect(found).toMatchObject({ action: 'admin.login.failed', outcome: 'failure', status: 401, ip: '127.0.0.1' });
    // Never the credential that was tried.
    expect(JSON.stringify(found)).not.toContain('not-the-token');
  });

  it('records a successful dashboard login', async () => {
    await req('GET', '/_admin/whoami', undefined, asAdmin());
    const found = (await entries('action=admin.login'))[0];
    expect(found).toMatchObject({ action: 'admin.login', actorKind: 'admin', outcome: 'success' });
  });

  it('records a backup, including where it came from', async () => {
    const res = await req('POST', '/admin/backups', {}, asAdmin());
    expect([200, 201]).toContain(res.status);
    const found = (await entries('action=backup.create'))[0];
    expect(found).toMatchObject({ action: 'backup.create', outcome: 'success', actorKind: 'admin' });
  });

  it('records a REFUSED privileged action as a failure, not as nothing', async () => {
    // The honesty fix: a body that sets nothing recognised is now a 400…
    const res = await req<ErrorBody>('PUT', '/admin/permissions/collections/Widget', { find: 'public' }, asAdmin());
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/Unknown field/);

    // …and the attempt is still recorded, because "someone tried to change
    // permissions and it did not take" is exactly what a trail is for.
    const failed = (await entries('action=permissions.collection.update&outcome=failure'))[0];
    expect(failed).toMatchObject({ outcome: 'failure', status: 400 });
  });

  it('never records a secret, even when the action creates one', async () => {
    const res = await req<{ secret: string }>('POST', '/admin/keys', { name: 'ci-key', scopes: ['functions:*'] }, asAdmin());
    expect(res.status).toBe(201);
    const secret = res.json.secret;
    expect(typeof secret).toBe('string');

    const found = (await entries('action=apikey.create'))[0];
    expect(found.detail).toMatchObject({ key: 'ci-key' });
    expect(JSON.stringify(found)).not.toContain(secret);
  });

  it('is a system collection: no CLP can open it to ordinary callers', () => {
    // On an enforcing backend `_Audit` is refused at the permission layer like
    // every other `_`-prefixed table. An ADMIN can read and even edit it
    // through /api — that is the documented stance, not an oversight: whoever
    // holds the admin credential already owns the database file.
    const decision = checkClp(
      { collections: {}, defaults: {} } as never,
      { kind: 'anonymous' },
      '_Audit',
      'find'
    );
    expect(decision.allowed).toBe(false);
  });

  it('exposes its own vocabulary, so a UI filter cannot drift from the code', async () => {
    const { json } = await audit();
    expect(json.actions).toEqual(declaredAuditActions());
    expect(json.actions).toContain('backup.restore');
  });

  it('honours retention when it prunes', async () => {
    const { json: before } = await audit();
    expect(before.count).toBeGreaterThan(0);

    // Retention of 0 days means "everything older than now", so a prune with a
    // one-day-ahead clock removes the lot. (0 in the config means keep forever;
    // this uses a real positive window and moves the clock instead.)
    await req('PUT', '/admin/ops', { audit: { retentionDays: 1 } }, asAdmin());
    const auditLog = (service as unknown as { audit: { prune(now: number): Promise<number> } }).audit;
    const removed = await auditLog.prune(Date.now() + 3 * 86_400_000);
    expect(removed).toBeGreaterThan(0);

    const { json: after } = await audit();
    // Only the entries from this very test survive (the ops.config update).
    expect(after.count).toBeLessThan(before.count);
  });

  it('can be switched off, and then records nothing', async () => {
    await req('PUT', '/admin/ops', { audit: { enabled: false } }, asAdmin());
    const { json: before } = await audit();
    await req('POST', '/admin/roles', { name: 'unrecorded' }, asAdmin());
    const { json: after } = await audit();
    expect(after.count).toBe(before.count);

    await req('PUT', '/admin/ops', { audit: { enabled: true } }, asAdmin());
  });
});
