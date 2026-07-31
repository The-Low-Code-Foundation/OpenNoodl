/**
 * The contract's own invariants.
 *
 * These are not tests of behaviour — there is no behaviour in this package.
 * They are the things that have to stay true about a table of claims for the
 * table to be worth having, and they are here because every one of them is
 * something a later task will be tempted to break while flipping a cell on.
 */

import {
  AUTH_ADAPTER_METHODS,
  BACKEND_DESCRIPTORS,
  BACKEND_TYPES,
  CAPABILITY_KEYS,
  DATA_ADAPTER_METHODS,
  DIRECTUS_OPERATOR_MIGRATION,
  FILTER_OPERATORS,
  LOWERED_OPERATORS,
  type BackendDescriptor,
  type Capability,
  type FilterOperator,
  type IAuthAdapter,
  type IDataAdapter
} from '../src';

// ── Compile-time exhaustiveness ────────────────────────────────────────────
//
// The runtime arrays are the only way a test can enumerate an interface, so
// they have to be provably complete. These two lines fail to compile — not to
// run — if a method is added to either interface and not to its array.

type MissingDataMethod = Exclude<keyof IDataAdapter, (typeof DATA_ADAPTER_METHODS)[number]>;
type MissingAuthMethod = Exclude<keyof IAuthAdapter, (typeof AUTH_ADAPTER_METHODS)[number]>;

const _dataMethodsAreExhaustive: MissingDataMethod extends never ? true : never = true;
const _authMethodsAreExhaustive: MissingAuthMethod extends never ? true : never = true;

describe('the interfaces', () => {
  it('has fourteen data methods, not the eighteen the phase spec asked for', () => {
    // Eighteen counted `_initCloudServices`, `_makeRequest` (the Parse seam
    // each adapter *replaces*) and `on`/`off` (events, not data operations).
    // BCN-001's success criterion was amended to fourteen because as written
    // it could not be met.
    expect(DATA_ADAPTER_METHODS).toHaveLength(14);
    expect(new Set(DATA_ADAPTER_METHODS).size).toBe(14);
    expect(_dataMethodsAreExhaustive).toBe(true);
  });

  it('has ten auth methods', () => {
    expect(AUTH_ADAPTER_METHODS).toHaveLength(10);
    expect(new Set(AUTH_ADAPTER_METHODS).size).toBe(10);
    expect(_authMethodsAreExhaustive).toBe(true);
  });

  it('does not carry a refresh method, because the lifecycle is declared instead', () => {
    // Parse tokens never expire, so no `refresh` was ever extracted. Adding one
    // here would push the scheduling, single-flight and cross-tab problem into
    // three separate adapters. `TokenLifecycle` is where it belongs.
    expect(AUTH_ADAPTER_METHODS).not.toContain('refresh');
    for (const type of BACKEND_TYPES) {
      expect(BACKEND_DESCRIPTORS[type].tokenLifecycle.kind).toMatch(/^(eternal|refresh)$/);
    }
  });
});

describe('every descriptor is complete', () => {
  it.each(BACKEND_TYPES)('%s declares every capability key and every filter operator', (type) => {
    const descriptor = BACKEND_DESCRIPTORS[type];
    expect(descriptor.type).toBe(type);

    for (const key of CAPABILITY_KEYS) {
      expect(descriptor.capabilities[key]).toBeDefined();
    }
    expect(Object.keys(descriptor.capabilities).sort()).toEqual([...CAPABILITY_KEYS].sort());

    for (const operator of FILTER_OPERATORS) {
      expect(descriptor.filters[operator]).toBeDefined();
    }
    expect(Object.keys(descriptor.filters).sort()).toEqual([...FILTER_OPERATORS].sort());
  });
});

/** Every cell in one descriptor, labelled, so a failure names the offender. */
function cells(descriptor: BackendDescriptor): [string, Capability][] {
  return [
    ...Object.entries(descriptor.capabilities),
    ...Object.entries(descriptor.filters).map(([k, v]): [string, Capability] => [`filter.${k}`, v])
  ];
}

describe('every claim that takes something away says why', () => {
  it.each(BACKEND_TYPES)('%s', (type) => {
    for (const [key, capability] of cells(BACKEND_DESCRIPTORS[type])) {
      if (capability.state === 'supported') continue;
      expect(`${key}: ${capability.reason ?? ''}`.length).toBeGreaterThan(key.length + 20);
      expect(capability.reason.trim()).not.toBe('');
    }
  });

  it.each(BACKEND_TYPES)('%s settles every conditional cell with a probe', (type) => {
    for (const [key, capability] of cells(BACKEND_DESCRIPTORS[type])) {
      if (capability.state !== 'conditional') continue;
      // `conditional` means "ask the instance". A conditional cell with no way
      // to ask is just `unsupported` wearing a nicer word, and would be treated
      // as unsupported forever with no path to becoming true.
      expect(capability.probe).toBeDefined();
      expect(capability.probe.expect.length).toBeGreaterThan(10);
      expect(capability.probe.path.startsWith('/')).toBe(true);
    }
  });
});

describe('the reason strings are product voice, not error messages', () => {
  // The rules Richard signed off: name the backend and the thing rather than
  // the key; say what to do instead where there is something; never describe
  // someone else's product limitation as our backlog.
  const BACKLOG_LANGUAGE = /not implemented|coming soon|todo|unimplemented|not yet supported by nodegx/i;

  it.each(BACKEND_TYPES)('%s', (type) => {
    for (const [key, capability] of cells(BACKEND_DESCRIPTORS[type])) {
      if (capability.state === 'supported') continue;
      const reason = capability.reason;

      expect(`${key} → ${reason}`).not.toMatch(BACKLOG_LANGUAGE);

      // A reason that quotes its own capability key has described the code, not
      // the product. `data.aggregate` must never appear in a sentence a
      // hobbyist reads off a disabled port.
      expect(reason).not.toContain(key.replace(/^filter\./, ''));
      expect(reason).not.toMatch(/\bcapability\b/i);

      // Sentence, not label.
      expect(reason.length).toBeGreaterThan(25);
      expect(reason.trimEnd()).toMatch(/[.!]$/);
    }
  });
});

describe('the filter model', () => {
  it('never gates an operator that can be lowered', () => {
    // `contains` has no Parse operator but is `$regex`; `between` is two
    // comparisons. Declaring those unsupported on the Parse-family backends
    // would grey out half the string operators on our OWN backend, which reads
    // as the product being broken rather than as a backend limitation.
    for (const type of ['nodegx', 'parse'] as const) {
      for (const operator of LOWERED_OPERATORS) {
        expect([type, operator, BACKEND_DESCRIPTORS[type].filters[operator].state]).not.toContain('unsupported');
      }
    }
  });

  it('maps all 24 saved BYOB operators onto the neutral vocabulary', () => {
    // BCN-003's migration is only worth doing because it is total. If an
    // operator the builder can emit has no mapping, saved filters using it lose
    // their meaning silently on migration — which is worse than the break the
    // migration exists to avoid.
    const mappings = Object.entries(DIRECTUS_OPERATOR_MIGRATION);
    expect(mappings).toHaveLength(24);

    for (const [directus, target] of mappings) {
      expect(directus.startsWith('_')).toBe(true);
      expect(FILTER_OPERATORS).toContain(target.operator as FilterOperator);
    }
  });

  it('turns the two nullary Directus operators into a boolean-valued one', () => {
    // The only rows in the migration that are not a plain rename. `_null` is
    // nullary; `exists` takes a boolean. A migration that renamed the key and
    // kept the value would produce `{exists: undefined}` and match everything.
    expect(DIRECTUS_OPERATOR_MIGRATION._null).toEqual({ operator: 'exists', value: 'false' });
    expect(DIRECTUS_OPERATOR_MIGRATION._nnull).toEqual({ operator: 'exists', value: 'true' });
  });
});

describe('the cells BCN-001 was sent to resolve', () => {
  it('marks Supabase aggregate conditional, with the probe that settles it', () => {
    const capability = BACKEND_DESCRIPTORS.supabase.capabilities['data.aggregate'];
    expect(capability.state).toBe('conditional');
    // Probing with an embedded-relation count instead would report `supported`
    // on an instance that cannot sum anything — PostgREST answers those with
    // aggregates disabled. The probe has to be the exact question.
    expect(capability.state === 'conditional' && capability.probe.path).toContain('select=count()');
    expect(capability.evidence).toContain('PGRST123');
  });

  it('marks PocketBase aggregate unsupported, and records that it fails silently', () => {
    const capability = BACKEND_DESCRIPTORS.pocketbase.capabilities['data.aggregate'];
    expect(capability.state).toBe('unsupported');
    // The reason this cell cannot be left to runtime: nothing throws.
    expect(capability.evidence).toContain('200');
  });

  it('keeps count separate from aggregate, because the probes disagree', () => {
    expect(BACKEND_DESCRIPTORS.supabase.capabilities['data.count'].state).toBe('supported');
    expect(BACKEND_DESCRIPTORS.pocketbase.capabilities['data.count'].state).toBe('supported');
    expect(BACKEND_DESCRIPTORS.pocketbase.capabilities['data.aggregate'].state).toBe('unsupported');
  });

  it('gives nodegx and parse different aggregate answers despite the shared wire', () => {
    // The reason they are two descriptors and not one. Our backend serves
    // /aggregate under ordinary find permission and the read ACL; upstream
    // Parse restricts it to the master key, which cannot be in a browser.
    expect(BACKEND_DESCRIPTORS.nodegx.capabilities['data.aggregate'].state).toBe('supported');
    expect(BACKEND_DESCRIPTORS.parse.capabilities['data.aggregate'].state).toBe('unsupported');
  });
});

describe('custom is a declared backend', () => {
  it('is the only declarable one', () => {
    for (const type of BACKEND_TYPES) {
      expect([type, BACKEND_DESCRIPTORS[type].declarable === true]).toEqual([type, type === 'custom']);
    }
  });

  it('ships a floor rather than a guess', () => {
    // Only the five operations the custom preset form requires by name are
    // claimed. Everything else waits for the user to declare it.
    const { capabilities } = BACKEND_DESCRIPTORS.custom;
    const claimed = Object.entries(capabilities)
      .filter(([, c]) => c.state !== 'unsupported')
      .map(([k]) => k)
      .sort();
    expect(claimed).toEqual(['data.create', 'data.delete', 'data.fetch', 'data.query', 'data.save']);
  });
});

describe('the three Parse cells BCN-002 measured and found wrong', () => {
  // These are here because the correction is the argument for the phase, not a
  // footnote to it. BCN-001 wrote all three from Parse Server's own
  // documentation, carefully, and got all three wrong — in the direction that
  // only surfaces in a user's app. A real server was the only way to know.

  const { capabilities } = BACKEND_DESCRIPTORS.parse;

  it('will not claim a Parse Server takes file uploads, because a new one does not', () => {
    // Parse Server disables uploads for public, anonymous AND authenticated
    // clients by default. Measured: 400, code 130, "File upload by public is
    // disabled." It depends on the deployment, so it carries a probe.
    const upload = capabilities['files.upload'];
    expect(upload.state).toBe('conditional');
    // Narrowed rather than asserted: `probe` only exists on the conditional
    // member of the union, which is the point — a `conditional` cell that could
    // not carry a probe would be a hedge rather than a question.
    if (upload.state === 'conditional') expect(upload.probe).toBeDefined();
  });

  it('will not offer a signed file link, because the route is ours', () => {
    // `GET /files/:name/sign` is BAK-006's. Parse answers 403 code 119 with the
    // master key as readily as without — a missing route, seen from behind
    // Parse's router. The old cell was `conditional` on a probe that asked a
    // different and unanswerable question.
    expect(capabilities['files.sign'].state).toBe('unsupported');
  });

  it('will not let an app delete a Parse file, which the old cell said it could', () => {
    // The worst of the three to be confidently wrong about. Measured: 403,
    // "unauthorized: master key is required"; 200 with the master key.
    expect(capabilities['files.delete'].state).toBe('unsupported');
  });

  it('records the aggregate refusal in the server’s own words', () => {
    // BCN-001 §0.2's separate-columns argument, now a measurement rather than
    // a reading. This is the sentence the descriptor is entitled to stand on.
    expect(capabilities['data.aggregate'].evidence).toContain('master key is required');
  });
});
