/**
 * BAK-009 ops.json: strict validation, first-run write, live patching, and the
 * warnings an internet-facing backend gets at startup.
 *
 * The strictness cases matter more than they look: "unknown keys are errors"
 * is the rule that makes a config field impossible to accept-and-ignore, which
 * is the failure this task fixed on the permissions route and must not
 * reintroduce here.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { OpsState, OpsStartupError } from '../src/ops/OpsState';
import { defaultOpsConfig, mergeOpsConfig, validateOpsConfig } from '../src/ops/model';
import { Logger, logger } from '../src/ops/logger';
import { BackendService } from '../src/service';

jest.setTimeout(30000);

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-ops-config-'));
}

describe('BAK-009 ops config validation', () => {
  it('accepts the defaults it ships', () => {
    expect(validateOpsConfig(defaultOpsConfig())).toEqual([]);
  });

  it('refuses unknown keys rather than ignoring them', () => {
    expect(validateOpsConfig({ version: 1, nonsense: true })).toContain('unknown key "nonsense" in ops config');
    expect(validateOpsConfig({ version: 1, logging: { level: 'info', verbose: true } })).toContain(
      'unknown key "verbose" in logging'
    );
    expect(validateOpsConfig({ version: 1, rateLimit: { policies: { nope: { ratePerMinute: 1, burst: 1 } } } })).toContain(
      'unknown key "nope" in rateLimit.policies'
    );
  });

  it('refuses values that would not work', () => {
    expect(validateOpsConfig({ version: 1, logging: { level: 'chatty' } })[0]).toMatch(/logging.level/);
    expect(validateOpsConfig({ version: 1, rateLimit: { policies: { auth: { ratePerMinute: -1, burst: 1 } } } })[0]).toMatch(
      /ratePerMinute/
    );
    expect(validateOpsConfig({ version: 1, audit: { retentionDays: -5 } })[0]).toMatch(/retentionDays/);
    // The combination browsers reject outright.
    expect(validateOpsConfig({ version: 1, cors: { origins: ['*'], credentials: true } })[0]).toMatch(/credentials/);
    expect(validateOpsConfig({ version: 1, cors: { origins: [] } })[0]).toMatch(/at least one origin/);
  });

  it('fills a partial document from the defaults', () => {
    const merged = mergeOpsConfig({ version: 1, logging: { level: 'debug' } });
    expect(merged.logging.level).toBe('debug');
    expect(merged.logging.format).toBe('auto');
    expect(merged.rateLimit.policies.data).toEqual(defaultOpsConfig().rateLimit.policies.data);
  });
});

describe('BAK-009 OpsState on disk', () => {
  it('writes a default ops.json on first run so there is something to edit', () => {
    const dir = tmpDir();
    try {
      const state = new OpsState(dir);
      expect(state.migratedThisStart).toBe(true);
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'ops.json'), 'utf-8'));
      expect(onDisk).toEqual(defaultOpsConfig());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses to start on an invalid file rather than running a config that is not what is on disk', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, 'ops.json'), JSON.stringify({ version: 1, logging: { level: 'loud' } }));
      expect(() => new OpsState(dir)).toThrow(OpsStartupError);

      fs.writeFileSync(path.join(dir, 'ops.json'), '{not json');
      expect(() => new OpsState(dir)).toThrow(/not valid JSON/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('patches one field without resetting its neighbours', () => {
    const dir = tmpDir();
    try {
      const state = new OpsState(dir);
      state.update({ rateLimit: { trustedProxies: ['private'] } });
      state.update({ rateLimit: { enabled: false } });
      // The proxy list set by the FIRST patch must survive the second.
      expect(state.config.rateLimit.trustedProxies).toEqual(['private']);
      expect(state.config.rateLimit.enabled).toBe(false);
      expect(state.config.rateLimit.policies.auth).toEqual(defaultOpsConfig().rateLimit.policies.auth);

      // And it is persisted, not just in memory.
      expect(new OpsState(dir).config.rateLimit.trustedProxies).toEqual(['private']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a patch that would make the whole document invalid', () => {
    const dir = tmpDir();
    try {
      const state = new OpsState(dir);
      expect(() => state.update({ cors: { origins: ['*'], credentials: true } })).toThrow(/credentials/);
      // Nothing was persisted.
      expect(new OpsState(dir).config.cors.credentials).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('BAK-009 startup warnings', () => {
  let dataDir: string;
  let service: BackendService | null = null;
  let lines: Record<string, unknown>[] = [];
  const original = { ...logger };

  afterEach(async () => {
    if (service) await service.stop();
    service = null;
    Object.assign(logger, original);
    process.env.NODEGX_LOG_LEVEL = 'silent';
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  });

  async function startWith(host: string, ops?: Record<string, unknown>): Promise<void> {
    dataDir = tmpDir();
    if (ops) fs.writeFileSync(path.join(dataDir, 'ops.json'), JSON.stringify(mergeOpsConfig(ops)));
    // BAK-003's deploy interlock refuses a non-loopback bind while dev-open is
    // on, so an enforcing security.json is a prerequisite for testing anything
    // about a public bind at all.
    fs.writeFileSync(
      path.join(dataDir, 'security.json'),
      JSON.stringify({
        version: 1,
        devOpen: false,
        defaults: {
          permissions: {
            find: 'authenticated',
            get: 'authenticated',
            create: 'authenticated',
            update: 'authenticated',
            delete: 'authenticated'
          },
          creatorOwns: true
        },
        collections: {},
        functions: {},
        files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
        signup: 'public'
      })
    );
    lines = [];
    // The suite-wide `NODEGX_LOG_LEVEL=silent` (tests/setup-logging.js) beats
    // ops.json inside `logger.configure`, which is the product behaviour an
    // operator relies on — and which would silence the very warnings under test
    // here, since the service configures the logger during start(). So this one
    // file drops the override for the duration.
    delete process.env.NODEGX_LOG_LEVEL;
    Object.assign(logger, new Logger({ level: 'debug', format: 'json', write: (l) => lines.push(JSON.parse(l)) }));
    service = new BackendService({ dataDir, port: 0, host, authToken: 'test-admin-token' });
    await service.start();
  }

  function warned(event: string): boolean {
    return lines.some((l) => l.event === event);
  }

  it('warns that an internet-facing backend is answering every origin', async () => {
    await startWith('0.0.0.0');
    expect(warned('cors.wildcard-on-public-bind')).toBe(true);
  });

  it('says nothing about CORS on a loopback bind — a warning nobody needs is noise', async () => {
    await startWith('127.0.0.1');
    expect(warned('cors.wildcard-on-public-bind')).toBe(false);
  });

  it('warns when the proxy trust list would let any client choose its own address', async () => {
    await startWith('0.0.0.0', { rateLimit: { trustedProxies: ['*'] }, cors: { origins: ['https://app.example.com'] } });
    expect(warned('proxy.trust-everything')).toBe(true);
    // …and stays quiet about the origins, which this operator has set properly.
    expect(warned('cors.wildcard-on-public-bind')).toBe(false);
  });

  it('warns when rate limiting is off on a public bind', async () => {
    await startWith('0.0.0.0', { rateLimit: { enabled: false } });
    expect(warned('ratelimit.disabled-on-public-bind')).toBe(true);
  });
});
