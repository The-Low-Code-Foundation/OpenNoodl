/**
 * WFA-008 — editing a trigger, against a real running service.
 *
 * The feature exists for ONE property, and it is the one a unit test over
 * `upsert` cannot state: after an edit, **the secret a sender already holds
 * still authenticates**. So the specs below do not read `secrets.json` — they
 * fire the hook. Every other rule here is a consequence of that property being
 * worth protecting:
 *
 *  - a `PUT` never carries `secret`, because sending it REPLACES it, so rotation
 *    is a verb of its own (`POST /admin/triggers/:id/secret`) whose whole point
 *    is that it breaks every existing sender;
 *  - `webhook.slug` is the other sender-visible field, and changing it moves the
 *    URL rather than the credential;
 *  - a trigger's `type` cannot change, because a webhook turned into a schedule
 *    orphans secret material a later change back silently re-uses (F58);
 *  - a `PUT` to an id the registry does not hold is a 404, not a resurrection
 *    with a fresh secret and a reset fire count (F59);
 *  - `updatedAt` moves for a configuration change and NOT for a fire, which is
 *    what makes it usable as an editor's concurrency token (§2 of the
 *    assessment) — asserted here, because that is a property of this file that
 *    an unrelated change could quietly remove.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ErrorBody } from './helpers/http';
import type { TriggerResponse } from '../src/server/admin-triggers';
import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(30000);

/** A one-step workflow, so a hook has something real to run. */
const PING_WORKFLOW_DEF = {
  version: 1,
  id: 'ping',
  name: 'Ping',
  entry: 'hold',
  concurrency: 1,
  steps: [{ id: 'hold', kind: 'wait', params: { duration: 1 } }],
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z'
};

const SECOND_WORKFLOW_DEF = { ...PING_WORKFLOW_DEF, id: 'pong', name: 'Pong' };

const ADMIN_TOKEN = 'admin-token-for-wfa008';
const BACKEND_ID = 'backend_wfa008';

describe('WFA-008 — editing a trigger', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const http = httpClient(() => base);
  const req = <T = unknown>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
    http.request<T>(method, p, { body, headers: { authorization: `Bearer ${ADMIN_TOKEN}`, ...headers } });

  const hookUrl = (slug: string) => `${base}/hooks/${BACKEND_ID}/${slug}`;

  /** Fire a token-scheme hook with a secret, and report only the status. */
  async function fire(slug: string, secret: string): Promise<number> {
    const res = await fetch(hookUrl(slug), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-token': secret },
      body: '{"n":1}'
    });
    return res.status;
  }

  /** A token-scheme webhook on `ping`, with its one-time secret. */
  async function tokenHook(slug: string) {
    const created = await req<TriggerResponse>('POST', '/admin/triggers', {
      type: 'webhook',
      name: `hook ${slug}`,
      target: { kind: 'workflow', name: 'ping' },
      webhook: { slug, scheme: 'token' }
    });
    expect(created.status).toBe(201);
    if (!created.json.secret) throw new Error(`hook "${slug}" was created without a secret`);
    return { id: created.json.trigger.id, secret: created.json.secret, def: created.json.trigger };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wfa008-'));
    fs.mkdirSync(path.join(dataDir, 'workflow-defs'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflow-defs', 'ping.workflow-def.json'), JSON.stringify(PING_WORKFLOW_DEF));
    fs.writeFileSync(path.join(dataDir, 'workflow-defs', 'pong.workflow-def.json'), JSON.stringify(SECOND_WORKFLOW_DEF));
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: BACKEND_ID,
      backendName: 'WFA-008',
      authToken: ADMIN_TOKEN
    });
    const started = await service.start();
    base = started.listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // The property the whole feature rests on
  // ==========================================================================

  describe('an edit does not break senders', () => {
    /**
     * The criterion, stated the only way it can be honestly stated: fire the
     * hook with the ORIGINAL secret after the configuration changed. Reading
     * `secrets.json` would assert that the value is still on disk, which is a
     * weaker claim than "the sender still gets a 200".
     */
    it('a webhook keeps working with its original secret after its target and cron-side config change', async () => {
      const { id, secret } = await tokenHook('keeps-secret');
      expect(await fire('keeps-secret', secret)).toBe(200);

      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        name: 'renamed, retargeted',
        target: { kind: 'workflow', name: 'pong' },
        webhook: { slug: 'keeps-secret', scheme: 'token' }
      });

      expect(put.status).toBe(200);
      expect(put.json.trigger.target.name).toBe('pong');
      // No secret in the response: nothing was minted, so there is nothing to
      // show once. A `secret` here would mean the sender's copy is now stale.
      expect(put.json.secret).toBeUndefined();
      expect(await fire('keeps-secret', secret)).toBe(200);
    });

    it('createdAt survives an edit and updatedAt moves', async () => {
      const { id, def } = await tokenHook('timestamps');
      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        name: 'edited',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'timestamps', scheme: 'token' }
      });
      expect(put.json.trigger.createdAt).toBe(def.createdAt);
      expect(put.json.trigger.updatedAt).not.toBe(def.updatedAt);
    });

    /**
     * `enabled` is deliberately absent from what an edit sends, so a trigger
     * someone turned off while a form was open cannot be re-enabled by saving
     * that form. The registry's rule ("absent means keep") is what makes the
     * editor's omission correct, so it is asserted here rather than assumed.
     */
    it('a PUT that omits `enabled` leaves a disabled trigger disabled', async () => {
      const { id } = await tokenHook('stays-off');
      await req('POST', `/admin/triggers/${id}/enabled`, { enabled: false });

      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        name: 'edited while disabled',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'stays-off', scheme: 'token' }
      });
      expect(put.json.trigger.enabled).toBe(false);
      expect(put.json.trigger.name).toBe('edited while disabled');
    });

    /** Status is the running service's, and an edit is not a reset. */
    it('an edit preserves the fire count and last result', async () => {
      const { id, secret } = await tokenHook('keeps-status');
      expect(await fire('keeps-status', secret)).toBe(200);

      const before = await req<TriggerResponse>('GET', `/admin/triggers/${id}`);
      expect(before.json.trigger.status.fireCount).toBe(1);

      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'keeps-status', scheme: 'token' }
      });
      expect(put.json.trigger.status.fireCount).toBe(1);
      expect(put.json.trigger.status.lastResult?.ok).toBe(true);
    });

    /**
     * The editor compares `updatedAt` to decide whether the trigger changed
     * under an open form (assessment §2). That only works because a FIRE is not
     * a configuration change — a hook firing every minute must not read as
     * somebody editing it.
     */
    it('a fire does not move updatedAt, and an enable/disable does', async () => {
      const { id, secret, def } = await tokenHook('token-stability');

      expect(await fire('token-stability', secret)).toBe(200);
      const afterFire = await req<TriggerResponse>('GET', `/admin/triggers/${id}`);
      expect(afterFire.json.trigger.updatedAt).toBe(def.updatedAt);
      expect(afterFire.json.trigger.status.fireCount).toBe(1);

      const toggled = await req<TriggerResponse>('POST', `/admin/triggers/${id}/enabled`, { enabled: false });
      expect(toggled.json.trigger.updatedAt).not.toBe(def.updatedAt);
    });
  });

  // ==========================================================================
  // The two sender-visible changes, each of which must be deliberate
  // ==========================================================================

  describe('the changes that DO break senders', () => {
    it('changing the slug moves the URL and carries the secret with it', async () => {
      const { id, secret } = await tokenHook('old-slug');
      expect(await fire('old-slug', secret)).toBe(200);

      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'new-slug', scheme: 'token' }
      });
      expect(put.status).toBe(200);

      // The old URL is gone — this is the break the editor has to warn about.
      const stale = await fetch(hookUrl('old-slug'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-webhook-token': secret },
        body: '{}'
      });
      expect(stale.status).toBe(404);
      // The credential itself is untouched at the new address.
      expect(await fire('new-slug', secret)).toBe(200);
    });

    it('a slug that clashes with another trigger is refused, and the trigger is unchanged', async () => {
      const a = await tokenHook('clash-a');
      await tokenHook('clash-b');

      const put = await req<ErrorBody>('PUT', `/admin/triggers/${a.id}`, {
        type: 'webhook',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'clash-b', scheme: 'token' }
      });
      expect(put.status).toBe(400);
      expect(put.json.error).toMatch(/already used by trigger/);
      expect(await fire('clash-a', a.secret)).toBe(200);
    });

    it('rotating a secret rejects the old one and accepts the new one', async () => {
      const { id, secret } = await tokenHook('rotate-me');
      expect(await fire('rotate-me', secret)).toBe(200);

      const rotated = await req<TriggerResponse>('POST', `/admin/triggers/${id}/secret`);
      expect(rotated.status).toBe(200);
      expect(rotated.json.secret).toMatch(/^whsec_/);
      expect(rotated.json.secret).not.toBe(secret);
      // The response has to say what just happened to every sender.
      expect(rotated.json.secretNote).toMatch(/previous secret/);

      expect(await fire('rotate-me', secret)).toBe(401);
      expect(await fire('rotate-me', rotated.json.secret as string)).toBe(200);
    });

    it('rotation is webhook-only, and says which of the two problems it is', async () => {
      const sched = await req<TriggerResponse>('POST', '/admin/triggers', {
        type: 'schedule',
        target: { kind: 'workflow', name: 'ping' },
        schedule: { cron: '0 5 * * *', missedFirePolicy: 'skip' }
      });
      const notWebhook = await req<ErrorBody>('POST', `/admin/triggers/${sched.json.trigger.id}/secret`);
      expect(notWebhook.status).toBe(400);
      expect(notWebhook.json.error).toMatch(/not a webhook/);

      const missing = await req<ErrorBody>('POST', '/admin/triggers/trg_nothere/secret');
      expect(missing.status).toBe(404);
    });
  });

  // ==========================================================================
  // F58 — the type is not editable
  // ==========================================================================

  describe('F58 — a trigger`s type cannot be changed', () => {
    it('refuses the change, names the two-step alternative, and leaves the webhook working', async () => {
      const { id, secret } = await tokenHook('no-morph');

      const put = await req<ErrorBody>('PUT', `/admin/triggers/${id}`, {
        type: 'schedule',
        target: { kind: 'workflow', name: 'ping' },
        schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' }
      });

      expect(put.status).toBe(400);
      expect(put.json.error).toMatch(/type cannot be changed/);
      expect(put.json.error).toMatch(/create the new one, then delete this one/);

      // Nothing was stored: still a webhook, still authenticating the original
      // secret. A refusal that half-applied would be the worse failure.
      const after = await req<TriggerResponse>('GET', `/admin/triggers/${id}`);
      expect(after.json.trigger.type).toBe('webhook');
      expect(after.json.trigger.webhook?.slug).toBe('no-morph');
      expect(await fire('no-morph', secret)).toBe(200);
    });

    it('the same type is not a change — an ordinary edit is unaffected', async () => {
      const { id } = await tokenHook('same-type');
      const put = await req<TriggerResponse>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        name: 'still a webhook',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'same-type', scheme: 'token' }
      });
      expect(put.status).toBe(200);
    });
  });

  // ==========================================================================
  // F59 — a PUT is not a create
  // ==========================================================================

  describe('F59 — a PUT to an unknown id', () => {
    it('is a 404 that stores nothing, rather than a resurrection with a new secret', async () => {
      const before = await req<{ triggers: unknown[] }>('GET', '/admin/triggers');

      const put = await req<ErrorBody>('PUT', '/admin/triggers/trg_deleted_under_you', {
        type: 'webhook',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'resurrected', scheme: 'token' }
      });

      expect(put.status).toBe(404);
      expect(put.json.error).toMatch(/may have been deleted/);
      expect(put.json.error).toMatch(/Nothing was changed/);

      const after = await req<{ triggers: unknown[] }>('GET', '/admin/triggers');
      expect(after.json.triggers.length).toBe(before.json.triggers.length);

      // And the URL it would have claimed is not routable.
      const res = await fetch(hookUrl('resurrected'), { method: 'POST', body: '{}' });
      expect(res.status).toBe(404);
    });

    it('a deleted trigger cannot be edited back into existence', async () => {
      const { id } = await tokenHook('deleted-then-put');
      await req('DELETE', `/admin/triggers/${id}`);

      const put = await req<ErrorBody>('PUT', `/admin/triggers/${id}`, {
        type: 'webhook',
        target: { kind: 'workflow', name: 'ping' },
        webhook: { slug: 'deleted-then-put', scheme: 'token' }
      });
      expect(put.status).toBe(404);
    });
  });
});
