/**
 * BAK-003 security model — unit tests for the pure model, plus the twin
 * property that keeps the SQL ACL filter and the JS `canReadRecord` in lockstep.
 *
 * `canReadRecord` (model.ts) is what BAK-001's realtime delivery will call per
 * event per subscriber; the SQL predicate (QueryBuilder.buildAclPredicate) is
 * what filters queries. If they ever disagree, a record visible in a query
 * would be undeliverable over realtime (or worse, the reverse). This suite
 * runs the SAME fixtures + principals through both and asserts identical
 * verdicts across a generated matrix.
 */
import {
  Principal,
  principalKeys,
  ruleAllows,
  checkClp,
  canReadRecord,
  canAccessRecord,
  effectiveRule,
  effectiveCreatorOwns,
  defaultSecurityConfig,
  validateSecurityConfig,
  validateScopes,
  validateAclShape,
  keyAllowsFunction
} from '../src/security/model';

// The SQL twin, exercised against a real in-memory node:sqlite so the property
// test compares the ACTUAL predicate, not a re-implementation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QueryBuilder = require('../../noodl-runtime/src/api/adapters/local-sql/QueryBuilder');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveEngine } = require('../../noodl-runtime/src/api/adapters/local-sql/engine');

describe('rule evaluation', () => {
  const anon: Principal = { kind: 'anonymous' };
  const user: Principal = { kind: 'user', userId: 'u1', roles: ['editors'] };

  it('public grants everyone; nobody grants no one', () => {
    expect(ruleAllows('public', anon)).toBe(true);
    expect(ruleAllows('public', user)).toBe(true);
    expect(ruleAllows('nobody', user)).toBe(false);
    expect(ruleAllows('nobody', anon)).toBe(false);
  });

  it('authenticated grants users but not anonymous', () => {
    expect(ruleAllows('authenticated', user)).toBe(true);
    expect(ruleAllows('authenticated', anon)).toBe(false);
  });

  it('role rules match membership; arrays are OR', () => {
    expect(ruleAllows('role:editors', user)).toBe(true);
    expect(ruleAllows('role:admins', user)).toBe(false);
    expect(ruleAllows(['role:admins', 'role:editors'], user)).toBe(true);
    expect(ruleAllows(['nobody', 'authenticated'], user)).toBe(true);
  });

  it('principalKeys are * + userId + role: prefixed', () => {
    expect(principalKeys(user).sort()).toEqual(['*', 'role:editors', 'u1']);
    expect(principalKeys(anon)).toEqual(['*']);
  });
});

describe('CLP resolution', () => {
  const config = defaultSecurityConfig();
  config.collections = { Public: { permissions: { find: 'public' } } };

  it('collection entries override defaults per key; missing keys fall through', () => {
    expect(effectiveRule(config, 'Public', 'find')).toBe('public');
    expect(effectiveRule(config, 'Public', 'create')).toBe('authenticated'); // from defaults
    expect(effectiveRule(config, 'Other', 'find')).toBe('authenticated');
  });

  it('system collections are always nobody', () => {
    expect(effectiveRule(config, '_User', 'find')).toBe('nobody');
    expect(effectiveCreatorOwns(config, '_User')).toBe(false);
  });

  it('admin bypasses; anonymous is denied authenticated', () => {
    expect(checkClp(config, { kind: 'admin' }, 'Other', 'delete').allowed).toBe(true);
    expect(checkClp(config, { kind: 'anonymous' }, 'Other', 'find').allowed).toBe(false);
    expect(checkClp(config, { kind: 'user', userId: 'u', roles: [] }, 'Other', 'find').allowed).toBe(true);
  });

  it('API-key scopes decide data access', () => {
    const readKey: Principal = { kind: 'apiKey', name: 'k', scopes: ['classes:read'] };
    expect(checkClp(config, readKey, 'Other', 'find').allowed).toBe(true);
    expect(checkClp(config, readKey, 'Other', 'create').allowed).toBe(false);
    expect(keyAllowsFunction(['functions:*'], 'anything')).toBe(true);
    expect(keyAllowsFunction(['functions:a'], 'b')).toBe(false);
  });
});

describe('config validation (strict — unknown keys are errors)', () => {
  it('accepts the default config', () => {
    expect(validateSecurityConfig(defaultSecurityConfig())).toEqual([]);
  });

  it('rejects unknown top-level and nested keys', () => {
    const cfg: any = defaultSecurityConfig();
    cfg.extra = true;
    cfg.collections.Doc = { permisions: {} };
    const errors = validateSecurityConfig(cfg);
    expect(errors.some((e) => e.includes('extra'))).toBe(true);
    expect(errors.some((e) => e.includes('permisions'))).toBe(true);
  });

  it('rejects CLP entries on system collections', () => {
    const cfg: any = defaultSecurityConfig();
    cfg.collections._User = { permissions: { find: 'public' } };
    expect(validateSecurityConfig(cfg).some((e) => e.includes('_User'))).toBe(true);
  });

  it('rejects unknown rule values and runAs:"caller"', () => {
    const cfg: any = defaultSecurityConfig();
    cfg.defaults.permissions.find = 'everyone';
    cfg.functions.f = { runAs: 'caller' };
    const errors = validateSecurityConfig(cfg);
    expect(errors.some((e) => e.includes('everyone'))).toBe(true);
    expect(errors.some((e) => e.includes('not yet supported'))).toBe(true);
  });

  it('validates scopes and ACL shapes', () => {
    expect(validateScopes(['classes:read', 'functions:x'])).toBeNull();
    expect(validateScopes(['admin:*'])).toMatch(/unknown scope/);
    expect(validateScopes([])).toMatch(/non-empty/);
    expect(validateAclShape({ u1: { read: true }, '*': { write: false } })).toBeNull();
    expect(validateAclShape({ u1: { admin: true } })).toMatch(/unknown flag/);
    expect(validateAclShape([])).toMatch(/must be an object/);
  });
});

// ============================================================================
// The twin property: canReadRecord (JS) === the SQL read predicate
// ============================================================================

describe('canReadRecord is the exact twin of the SQL ACL predicate', () => {
  const engine = resolveEngine();
  let db: any;

  const acls: (Record<string, { read?: boolean; write?: boolean }> | null)[] = [
    null,
    { '*': { read: true } },
    { '*': { write: true } }, // write-only public: not readable
    { u1: { read: true, write: true } },
    { u1: { write: true } }, // write-only for u1: not readable by u1
    { 'role:editors': { read: true } },
    { u2: { read: true }, '*': { write: true } },
    { u1: { read: true }, 'role:admins': { read: true } }
  ];

  const principals: Principal[] = [
    { kind: 'anonymous' },
    { kind: 'user', userId: 'u1', roles: [] },
    { kind: 'user', userId: 'u1', roles: ['editors'] },
    { kind: 'user', userId: 'u2', roles: ['admins'] },
    { kind: 'user', userId: 'u3', roles: [] }
  ];

  beforeAll(() => {
    if (!engine) throw new Error('node:sqlite required');
    db = engine.open(':memory:');
    db.exec('CREATE TABLE "Doc" ("objectId" TEXT PRIMARY KEY, "ACL" TEXT)');
    acls.forEach((acl, i) => {
      db.prepare('INSERT INTO "Doc" ("objectId", "ACL") VALUES (?, ?)').run(
        `row${i}`,
        acl === null ? null : JSON.stringify(acl)
      );
    });
  });

  afterAll(() => {
    if (db) db.close();
  });

  /** Rows the SQL predicate says this principal can read. */
  function sqlReadable(principal: Principal): Set<string> {
    const params: unknown[] = [];
    const predicate = QueryBuilder.buildAclPredicate('Doc', { access: 'read', keys: principalKeys(principal) }, params);
    const rows = db.prepare(`SELECT "objectId" FROM "Doc" WHERE ${predicate}`).all(...params) as { objectId: string }[];
    return new Set(rows.map((r) => r.objectId));
  }

  it('agrees on every (principal, row) pair', () => {
    for (const principal of principals) {
      const viaSql = sqlReadable(principal);
      acls.forEach((acl, i) => {
        const objectId = `row${i}`;
        const viaJs = canReadRecord(principal, { ACL: acl });
        expect({ principal: principal, objectId, viaJs }).toEqual({
          principal,
          objectId,
          viaJs: viaSql.has(objectId)
        });
      });
    }
  });

  it('admin and scoped keys bypass in JS the way they bypass (no acl) in SQL', () => {
    expect(canReadRecord({ kind: 'admin' }, { ACL: { u9: { read: true } } })).toBe(true);
    expect(canAccessRecord({ kind: 'apiKey', name: 'k', scopes: ['classes:*'] }, { ACL: null }, 'write')).toBe(true);
    expect(canAccessRecord({ kind: 'apiKey', name: 'k', scopes: ['functions:x'] }, { ACL: null }, 'read')).toBe(false);
  });
});
