/**
 * BAK-009: a planted secret must never reach a log line.
 *
 * The value of this test is entirely in its FIXTURE: it is not a synthetic
 * `{password: 'x'}`, it is the real shape of every config object this service
 * can be asked to log — secrets.json, security config, SMTP auth, S3
 * credentials, per-hook webhook secrets, request headers. Each one carries a
 * distinct planted value, so a failure names exactly which shape leaks.
 *
 * The corresponding negative check matters just as much: redaction that eats
 * ordinary fields produces logs nobody can debug with, so the fixture also
 * asserts the innocent neighbours survive.
 */

import { Logger } from '../src/ops/logger';
import { REDACTED, redact, redactHeaders, redactToString } from '../src/ops/redact';

/** One planted secret per real config shape. Values are unique on purpose. */
const PLANTED = {
  adminToken: 'PLANTED-admin-token-1',
  readonlyToken: 'PLANTED-readonly-token-2',
  smtpPassword: 'PLANTED-smtp-pass-3',
  s3SecretKey: 'PLANTED-s3-secret-4',
  s3AccessKey: 'PLANTED-s3-access-5',
  signingKey: 'PLANTED-signing-key-6',
  webhookSecret: 'PLANTED-webhook-secret-7',
  sessionToken: 'PLANTED-session-token-8',
  apiKeyHash: 'PLANTED-api-key-hash-9',
  authorization: 'Bearer PLANTED-bearer-10',
  userPassword: 'PLANTED-user-password-11'
};

/** The shapes, as the service actually holds them. */
function loggableConfigShapes(): Record<string, unknown> {
  return {
    // config/SecretsStore — the shared secrets.json document
    secretsJson: {
      version: 1,
      adminToken: PLANTED.adminToken,
      readonlyToken: PLANTED.readonlyToken,
      email: { smtp: { pass: PLANTED.smtpPassword } },
      files: { s3: { accessKeyId: PLANTED.s3AccessKey, secretAccessKey: PLANTED.s3SecretKey }, signingKey: PLANTED.signingKey },
      triggers: { trg_abc: { webhookSecret: PLANTED.webhookSecret } }
    },
    // email/EmailConfigState — SMTP settings as the admin surface returns them
    emailConfig: {
      host: 'smtp.example.com',
      port: 587,
      secure: true,
      auth: { user: 'mailer@example.com', pass: PLANTED.smtpPassword }
    },
    // storage/FileSubsystem — driver config
    filesConfig: {
      driver: 's3',
      bucket: 'uploads',
      endpoint: 'https://s3.example.com',
      accessKeyId: PLANTED.s3AccessKey,
      secretAccessKey: PLANTED.s3SecretKey
    },
    // security/state — a resolved API-key principal and a session
    principal: { kind: 'apiKey', name: 'ci', keyHash: PLANTED.apiKeyHash, scopes: ['functions:*'] },
    session: { objectId: 'sess1', userId: 'u1', sessionToken: PLANTED.sessionToken },
    // A user record on its way through a create
    user: { username: 'ada', email: 'ada@example.com', password: PLANTED.userPassword },
    // A webhook trigger definition
    trigger: { id: 'trg_abc', slug: 'stripe', secret: PLANTED.webhookSecret, target: { kind: 'function', name: 'onPay' } }
  };
}

describe('BAK-009 redaction', () => {
  const allPlanted = Object.values(PLANTED);

  it('leaves no planted secret in any real config shape', () => {
    const serialized = JSON.stringify(redact(loggableConfigShapes()));
    for (const [name, value] of Object.entries(PLANTED)) {
      expect(`${name}: ${serialized}`).not.toContain(value);
    }
  });

  it('keeps the fields that make a log worth reading', () => {
    const out = JSON.stringify(redact(loggableConfigShapes()));
    expect(out).toContain('smtp.example.com');
    expect(out).toContain('uploads');
    expect(out).toContain('ada@example.com');
    expect(out).toContain('functions:*');
    expect(out).toContain('onPay');
  });

  it('redacts credential-bearing request headers', () => {
    const headers = redactHeaders({
      authorization: PLANTED.authorization,
      cookie: 'session=abc',
      'x-parse-session-token': PLANTED.sessionToken,
      'x-nodegx-api-key': 'PLANTED-key',
      'x-parse-master-key': PLANTED.adminToken,
      'content-type': 'application/json',
      'user-agent': 'curl/8'
    });
    expect(JSON.stringify(headers)).not.toContain('PLANTED');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['user-agent']).toBe('curl/8');
  });

  it('redacts through the logger, not just when a caller remembers to', () => {
    const lines: string[] = [];
    const log = new Logger({ level: 'debug', format: 'json', write: (l) => lines.push(l) });
    log.info('config.loaded', { config: loggableConfigShapes() });
    const written = lines.join('');
    for (const value of allPlanted) expect(written).not.toContain(value);
    expect(written).toContain(REDACTED);
  });

  it('truncates and redacts one-line renderings', () => {
    expect(redactToString({ adminToken: PLANTED.adminToken })).not.toContain(PLANTED.adminToken);
    expect(redactToString('x'.repeat(600))).toContain('[truncated]');
    expect(redactToString('short')).toBe('short');
  });

  it('survives cycles and odd values rather than throwing mid-log', () => {
    const lines: string[] = [];
    const log = new Logger({ level: 'debug', format: 'json', write: (l) => lines.push(l) });
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    expect(() => log.info('weird', { cyclic, big: BigInt(7) })).not.toThrow();
    expect(lines.join('')).toContain('loop');
  });
});
