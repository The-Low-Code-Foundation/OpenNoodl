/**
 * The shared secrets.json convention seen from the email side — that
 * EmailConfigState's `email` namespace composes, through the one `SecretsStore`
 * (config/SecretsStore), with SecurityState's top-level `adminToken` and
 * WF-005's `webhooks` namespace without any of them clobbering the others.
 * (SecretsStore's own unit coverage lives in secrets-store.test.ts.)
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SecretsStore } from '../src/config/SecretsStore';

describe('secrets.json convention (email namespace composition)', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-secrets-test-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('reads undefined when the file does not exist yet', () => {
    expect(new SecretsStore(dataDir).get('email', 'smtpPassword')).toBeUndefined();
  });

  it('writes and reads back a namespaced value', () => {
    new SecretsStore(dataDir).set('email', 'smtpPassword', 'hunter2');
    expect(new SecretsStore(dataDir).get('email', 'smtpPassword')).toBe('hunter2');
  });

  it('preserves a foreign top-level key (SecurityState adminToken) written outside the store', () => {
    // SecurityState writes adminToken at the top level; simulate that, then
    // prove the store's namespaced write leaves it intact.
    fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ adminToken: 'admin-secret' }), { mode: 0o600 });
    new SecretsStore(dataDir).set('email', 'smtpPassword', 'mail-secret');
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    expect(raw.adminToken).toBe('admin-secret');
    expect(raw.email).toEqual({ smtpPassword: 'mail-secret' });
  });

  it('email and webhooks (WF-005) namespaces round-trip side by side', () => {
    const store = new SecretsStore(dataDir);
    store.set('email', 'smtpPassword', 'mail-secret');
    store.set('webhooks', 'hook1', 'whsec_abc');
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    expect(raw.email).toEqual({ smtpPassword: 'mail-secret' });
    expect(raw.webhooks).toEqual({ hook1: 'whsec_abc' });
  });

  it('is written at file mode 0600', () => {
    new SecretsStore(dataDir).set('email', 'smtpPassword', 'x');
    const mode = fs.statSync(path.join(dataDir, 'secrets.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('throws loudly on invalid JSON rather than silently resetting', () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'secrets.json'), '{ not json');
    expect(() => new SecretsStore(dataDir).get('email', 'smtpPassword')).toThrow(/not valid JSON/);
  });
});
