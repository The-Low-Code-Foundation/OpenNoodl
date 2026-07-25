/**
 * WF-005 TriggerRegistry — strict validation, persistence, secret handling,
 * slug uniqueness, and status survival across a reload (== restart).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SecretsStore, WEBHOOK_SECRETS_NAMESPACE } from '../src/config/SecretsStore';
import { TriggerRegistry, TriggerConfigError, validateTriggerDef } from '../src/triggers/registry';

function makeRegistry(dir: string): TriggerRegistry {
  return new TriggerRegistry(dir, new SecretsStore(dir));
}

describe('validateTriggerDef', () => {
  it('rejects unknown keys and wrong types', () => {
    expect(validateTriggerDef({ id: 't', type: 'schedule', target: { kind: 'function', name: 'f' }, bogus: 1, schedule: { cron: '* * * * *', missedFirePolicy: 'skip' } }))
      .toContain('unknown key "bogus"');
    expect(validateTriggerDef({ id: 't', type: 'nope', target: { kind: 'function', name: 'f' } }).join('\n')).toMatch(/type must be one of/);
  });

  it('rejects a schedule with an invalid cron', () => {
    const errs = validateTriggerDef({
      id: 't',
      type: 'schedule',
      target: { kind: 'function', name: 'f' },
      schedule: { cron: '99 * * * *', missedFirePolicy: 'skip' }
    });
    expect(errs.join('\n')).toMatch(/schedule.cron/);
  });

  it('rejects a webhook with a bad slug or scheme', () => {
    const errs = validateTriggerDef({
      id: 't',
      type: 'webhook',
      target: { kind: 'function', name: 'f' },
      webhook: { slug: 'Bad Slug!', scheme: 'md5', maxBodyBytes: 1000 }
    });
    expect(errs.join('\n')).toMatch(/slug must match/);
    expect(errs.join('\n')).toMatch(/scheme must be/);
  });
});

describe('TriggerRegistry', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-registry-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a schedule trigger with defaults and persists to triggers.json', () => {
    const reg = makeRegistry(dir);
    const { trigger } = reg.upsert({
      type: 'schedule',
      target: { kind: 'function', name: 'digest' },
      schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' }
    });
    expect(trigger.id).toMatch(/^trg_/);
    expect(trigger.enabled).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'triggers.json'), 'utf-8'));
    expect(onDisk.version).toBe(1);
    expect(onDisk.triggers).toHaveLength(1);
    expect(onDisk.triggers[0].target.name).toBe('digest');
  });

  it('mints a webhook secret once and stores it in secrets.json, not triggers.json', () => {
    const reg = makeRegistry(dir);
    const { trigger, secret } = reg.upsert({
      type: 'webhook',
      target: { kind: 'function', name: 'onPush' },
      webhook: { slug: 'gh' }
    });
    expect(secret).toMatch(/^whsec_/);
    // The secret must not be in the diffable/deployable triggers.json.
    const triggersRaw = fs.readFileSync(path.join(dir, 'triggers.json'), 'utf-8');
    expect(triggersRaw).not.toContain(secret!);
    // It lives in secrets.json under the webhooks namespace.
    expect(new SecretsStore(dir).get(WEBHOOK_SECRETS_NAMESPACE, trigger.id)).toBe(secret);
    // And the registry can read it back for verification.
    expect(reg.getWebhookSecret(trigger.id)).toBe(secret);
  });

  it('rejects duplicate webhook slugs', () => {
    const reg = makeRegistry(dir);
    reg.upsert({ type: 'webhook', target: { kind: 'function', name: 'a' }, webhook: { slug: 'dup' } });
    expect(() =>
      reg.upsert({ type: 'webhook', target: { kind: 'function', name: 'b' }, webhook: { slug: 'dup' } })
    ).toThrow(TriggerConfigError);
  });

  it('enable/disable and delete work and persist', () => {
    const reg = makeRegistry(dir);
    const { trigger } = reg.upsert({
      type: 'db-change',
      target: { kind: 'function', name: 'onWrite' },
      dbChange: { collection: 'Orders', actions: ['create'] }
    });
    reg.setEnabled(trigger.id, false);
    expect(reg.get(trigger.id)!.enabled).toBe(false);
    expect(reg.delete(trigger.id)).toBe(true);
    expect(reg.get(trigger.id)).toBeNull();
    expect(reg.delete(trigger.id)).toBe(false);
  });

  it('status (last fired / next fire) survives a reload — the restart contract', () => {
    const reg = makeRegistry(dir);
    const { trigger } = reg.upsert({
      type: 'schedule',
      target: { kind: 'function', name: 'digest' },
      schedule: { cron: '0 * * * *', missedFirePolicy: 'skip' }
    });
    reg.recordFire(trigger.id, { firedAt: '2026-07-25T10:00:00.000Z', result: { ok: true, at: '2026-07-25T10:00:00.001Z', statusCode: 200 } });
    reg.setNextFire(trigger.id, '2026-07-25T11:00:00.000Z');

    // A fresh registry over the same dir == a service restart.
    const reloaded = makeRegistry(dir);
    const t = reloaded.get(trigger.id)!;
    expect(t.status.lastFiredAt).toBe('2026-07-25T10:00:00.000Z');
    expect(t.status.fireCount).toBe(1);
    expect(t.status.lastResult!.ok).toBe(true);
    expect(t.status.nextFireAt).toBe('2026-07-25T11:00:00.000Z');
  });

  it('refuses to load an invalid triggers.json (loud failure)', () => {
    fs.writeFileSync(
      path.join(dir, 'triggers.json'),
      JSON.stringify({ version: 1, triggers: [{ id: 'x', type: 'schedule', target: { kind: 'function', name: 'f' }, schedule: { cron: 'nope', missedFirePolicy: 'skip' } }] })
    );
    expect(() => makeRegistry(dir)).toThrow(TriggerConfigError);
  });
});
