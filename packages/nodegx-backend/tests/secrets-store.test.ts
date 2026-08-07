/**
 * WF-005 SecretsStore — the shared, namespaced secrets convention.
 *
 * The load-bearing property (so BAK-002 email and WF-005 webhooks compose):
 * writing one namespace must preserve every other top-level key, including the
 * admin credential that SecurityState writes directly.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SecretsStore, WEBHOOK_SECRETS_NAMESPACE } from '../src/config/SecretsStore';

describe('SecretsStore', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-secrets-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a namespaced secret', () => {
    const store = new SecretsStore(dir);
    expect(store.get(WEBHOOK_SECRETS_NAMESPACE, 'trg_a')).toBeUndefined();
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_a', 'whsec_1');
    expect(store.get(WEBHOOK_SECRETS_NAMESPACE, 'trg_a')).toBe('whsec_1');
  });

  it('preserves a pre-existing top-level adminToken (SecurityState) when writing a namespace', () => {
    const file = path.join(dir, 'secrets.json');
    fs.writeFileSync(file, JSON.stringify({ adminToken: 'admin-xyz' }));

    const store = new SecretsStore(dir);
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_a', 'whsec_1');

    const after = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(after.adminToken).toBe('admin-xyz'); // untouched
    expect(after.webhooks.trg_a).toBe('whsec_1');
  });

  it('preserves a foreign namespace (e.g. BAK-002 email) across writes', () => {
    const store = new SecretsStore(dir);
    // Simulate BAK-002 having written its own namespace.
    fs.writeFileSync(
      path.join(dir, 'secrets.json'),
      JSON.stringify({ adminToken: 'a', email: { smtpPassword: 'p' } })
    );
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_a', 'whsec_1');
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_b', 'whsec_2');

    const after = JSON.parse(fs.readFileSync(path.join(dir, 'secrets.json'), 'utf-8'));
    expect(after.email.smtpPassword).toBe('p');
    expect(after.adminToken).toBe('a');
    expect(after.webhooks).toEqual({ trg_a: 'whsec_1', trg_b: 'whsec_2' });
  });

  it('deletes only the named key', () => {
    const store = new SecretsStore(dir);
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_a', 'x');
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_b', 'y');
    store.delete(WEBHOOK_SECRETS_NAMESPACE, 'trg_a');
    expect(store.get(WEBHOOK_SECRETS_NAMESPACE, 'trg_a')).toBeUndefined();
    expect(store.get(WEBHOOK_SECRETS_NAMESPACE, 'trg_b')).toBe('y');
  });

  it('throws loudly on a corrupt secrets file rather than silently discarding it', () => {
    fs.writeFileSync(path.join(dir, 'secrets.json'), '{ not json');
    const store = new SecretsStore(dir);
    expect(() => store.get(WEBHOOK_SECRETS_NAMESPACE, 'trg_a')).toThrow(/not valid JSON/);
  });

  it('writes the file mode 0600', () => {
    const store = new SecretsStore(dir);
    store.set(WEBHOOK_SECRETS_NAMESPACE, 'trg_a', 'x');
    const mode = fs.statSync(path.join(dir, 'secrets.json')).mode & 0o777;
    // 0600 on POSIX; skip the assertion where the platform lacks POSIX modes.
    if (process.platform !== 'win32') expect(mode).toBe(0o600);
  });
});
