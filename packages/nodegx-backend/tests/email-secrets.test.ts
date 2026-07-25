/**
 * The shared secrets.json convention (BAK-002/BAK-003) — the read-modify-write
 * helper other subsystems (SecurityState's adminToken, EmailConfigState's
 * smtpPassword, and — per the module doc — a future WF-005 webhook-secrets
 * module) share so they never clobber each other's keys.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { readSecretsFile, writeSecretsFile, SecretsFileInvalidError } from '../src/security/secrets';

describe('secrets.json convention', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-secrets-test-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('reads {} when the file does not exist yet', () => {
    expect(readSecretsFile(dataDir)).toEqual({});
  });

  it('writes and reads back a namespaced value', () => {
    writeSecretsFile(dataDir, (s) => {
      s.email = { smtpPassword: 'hunter2' };
    });
    expect(readSecretsFile(dataDir)).toEqual({ email: { smtpPassword: 'hunter2' } });
  });

  it('is a read-modify-write: writing one namespace never clobbers another', () => {
    writeSecretsFile(dataDir, (s) => {
      s.adminToken = 'admin-secret';
    });
    writeSecretsFile(dataDir, (s) => {
      s.email = { smtpPassword: 'mail-secret' };
    });
    const secrets = readSecretsFile(dataDir);
    expect(secrets.adminToken).toBe('admin-secret');
    expect(secrets.email).toEqual({ smtpPassword: 'mail-secret' });
  });

  it('a hypothetical webhooks namespace round-trips the same way (WF-005 shape)', () => {
    writeSecretsFile(dataDir, (s) => {
      s.adminToken = 'admin-secret';
      s.email = { smtpPassword: 'mail-secret' };
    });
    writeSecretsFile(dataDir, (s) => {
      s.webhooks = { ...(s.webhooks || {}), hook1: 'whsec_abc' };
    });
    const secrets = readSecretsFile(dataDir);
    expect(secrets.adminToken).toBe('admin-secret');
    expect(secrets.email).toEqual({ smtpPassword: 'mail-secret' });
    expect(secrets.webhooks).toEqual({ hook1: 'whsec_abc' });
  });

  it('is written at file mode 0600', () => {
    writeSecretsFile(dataDir, (s) => {
      s.adminToken = 'x';
    });
    const mode = fs.statSync(path.join(dataDir, 'secrets.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('throws a labeled error on invalid JSON rather than silently resetting', () => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'secrets.json'), '{ not json');
    expect(() => readSecretsFile(dataDir)).toThrow(SecretsFileInvalidError);
  });
});
