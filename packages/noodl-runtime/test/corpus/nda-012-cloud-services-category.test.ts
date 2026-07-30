/**
 * NDA-012 (Cloud Services) — the two defects in this category that are claims about *runtime
 * behaviour* rather than about what the source says, so a citation alone would not settle them.
 *
 * Both are `test.failing`: they reproduce a defect this task deliberately does not fix (NDA-012
 * produces verdicts, not repairs). The moment either is fixed the row FAILS loudly and must be
 * unmarked in the same commit — the corpus convention in `README.md`.
 *
 * Rows M1–M3 are the Config node's fetch latch, which is the sharpest thing this category's read
 * turned up: a config fetch that fails once can never succeed again for the life of the page, and
 * `clearCache()` — the only recovery the class offers, and what the editor calls when the schema
 * changes — does not touch the field that latched.
 *
 * Row M4 is the control that makes M1–M3 mean something: the *first* call really does reach the
 * transport, so a later call returning a rejected promise is a latch and not simply "this class
 * never works".
 */

import ConfigService = require('../../src/api/configservice');

/** The class behind `ConfigService.instance`, reached without disturbing the singleton. */
type ConfigServiceInstance = {
  configCache?: Record<string, unknown>;
  configCachePending?: Promise<Record<string, unknown>>;
  ttl?: number;
  _getConfig(): Promise<Record<string, unknown>>;
  getConfig(): Promise<Record<string, unknown>>;
  clearCache(): void;
};

/**
 * A fresh service whose transport is a counter rather than an `XMLHttpRequest`.
 *
 * `_getConfig` is the seam: it is the only thing between `getConfig`'s caching and the network,
 * and overriding it on the instance leaves every line of the caching logic under test.
 */
function makeService(outcomes: ('ok' | 'fail')[]) {
  const Ctor = ConfigService as unknown as new () => ConfigServiceInstance;
  const service = new Ctor();
  const calls: number[] = [];

  service._getConfig = () => {
    const i = calls.length;
    calls.push(i);
    const outcome = outcomes[Math.min(i, outcomes.length - 1)];
    return outcome === 'ok' ? Promise.resolve({ apiKey: 'live-' + i }) : Promise.reject({ error: 'Failed to fetch.' });
  };

  return { service, calls };
}

describe('NDA-012 Cloud Services — Config', () => {
  test.failing('M1: a config fetch that fails once fails for the life of the page', async () => {
    const { service } = makeService(['fail', 'ok']);

    await expect(service.getConfig()).rejects.toBeDefined();

    // The backend is healthy by now — the second attempt is seeded to succeed. It cannot:
    // `getConfig` returned early on `configCachePending`, which the rejected first call left
    // set because `delete this.configCachePending` sits *after* the `await` that threw
    // (`configservice.ts:120-126`).
    await expect(service.getConfig()).resolves.toEqual({ apiKey: 'live-1' });
  });

  test.failing('M2: the retry never even reaches the transport', async () => {
    const { service, calls } = makeService(['fail', 'ok']);

    await expect(service.getConfig()).rejects.toBeDefined();
    await service.getConfig().catch(() => undefined);

    // One request, not two: the second caller was handed the first one's rejected promise.
    expect(calls).toHaveLength(2);
  });

  test.failing('M3: clearCache() does not clear the thing that latched', async () => {
    const { service } = makeService(['fail', 'ok']);

    await expect(service.getConfig()).rejects.toBeDefined();
    // The only recovery the class offers, and what the editor calls on
    // `metadataChanged.dbConfigSchema` (`dbconfig.ts:194`). It deletes `configCache`, which a
    // failed fetch never populated, and leaves `configCachePending` — the rejected promise —
    // exactly where it is.
    service.clearCache();

    await expect(service.getConfig()).resolves.toEqual({ apiKey: 'live-1' });
  });

  it('M4 (control): a service whose first fetch succeeds caches it and does not re-request', async () => {
    const { service, calls } = makeService(['ok']);

    await expect(service.getConfig()).resolves.toEqual({ apiKey: 'live-0' });
    await expect(service.getConfig()).resolves.toEqual({ apiKey: 'live-0' });

    expect(calls).toHaveLength(1);
  });
});
