/**
 * BCN-010 — the gate, and the one invariant the whole phase rests on.
 *
 * > **A disabled port with no reason is a bug in this task**, not a cosmetic
 * > gap — it converts "this backend cannot do that" into "this is broken."
 *
 * That sentence is a property of a table with 6 × 27 capability cells and
 * 6 × 31 filter cells in it, so it is checked as one — over every cell of every
 * descriptor, rather than over the handful a spec happened to name. Phase 30's
 * own lesson, applied to a different table.
 */

import {
  BACKEND_DESCRIPTORS,
  BACKEND_TYPES,
  CAPABILITY_KEYS,
  CapabilityProbeCache,
  DELIBERATELY_UNBOUND,
  FILTER_OPERATORS,
  NODE_CAPABILITIES,
  POSITIVE_PROBE_TTL_MS,
  boundCapabilityKeys,
  descriptorFor,
  filterGateFor,
  gateFor,
  nodeCapabilityKey,
  portCapabilityKey,
  resolveGate,
  type BackendType,
  type Capability,
  type CapabilityKey,
  type ProbeOutcome
} from '../src';

const T0 = 1_700_000_000_000;

// ── The invariant ──────────────────────────────────────────────────────────

describe('every gate that takes something away says why', () => {
  it('over every capability cell of every backend', () => {
    const offenders: string[] = [];

    for (const type of BACKEND_TYPES) {
      for (const key of CAPABILITY_KEYS) {
        // Both readings of a `conditional` cell have to hold: unprobed (which
        // renders as unsupported) and probed-negative.
        const unprobed = gateFor(type, key);
        const negative = gateFor(type, key, {
          probes: { [key]: { verdict: 'unsupported', at: T0 } },
          now: T0
        });

        for (const [label, gate] of [
          ['unprobed', unprobed],
          ['probed-negative', negative]
        ] as const) {
          const owes = !gate.isUsable || gate.effective === 'degraded';
          if (owes && !nonEmpty(gate.reason)) {
            offenders.push(`${type}.${key} (${label}) is ${gate.effective} with no reason`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('over every filter operator of every backend', () => {
    const offenders: string[] = [];

    for (const type of BACKEND_TYPES) {
      for (const operator of FILTER_OPERATORS) {
        const gate = filterGateFor(type, operator);
        const owes = !gate.isUsable || gate.effective === 'degraded';
        if (owes && !nonEmpty(gate.reason)) {
          offenders.push(`${type}.filters.${operator} is ${gate.effective} with no reason`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('and a supported gate says nothing, so a caller can render on presence alone', () => {
    // The mirror of the rule above, and the reason a view can be written as
    // `gate.reason && <Caveat/>` rather than as a state machine.
    for (const type of BACKEND_TYPES) {
      for (const key of CAPABILITY_KEYS) {
        const gate = gateFor(type, key, {
          probes: { [key]: { verdict: 'supported', at: T0 } },
          now: T0
        });
        if (gate.effective === 'supported') expect(gate.reason).toBeUndefined();
      }
    }
  });
});

// ── The four states ────────────────────────────────────────────────────────

describe('resolveGate', () => {
  const supported: Capability = { state: 'supported' };
  const degraded: Capability = { state: 'degraded', reason: 'rounds oddly' };
  const unsupported: Capability = { state: 'unsupported', reason: 'not a thing here' };
  const conditional: Capability = {
    state: 'conditional',
    reason: 'depends on your instance',
    probe: { method: 'GET', path: '/x', expect: 'a 200' }
  };
  const key: CapabilityKey = 'realtime.subscribe';

  it('supported is usable and silent', () => {
    expect(resolveGate(supported, key)).toEqual({
      declared: 'supported',
      effective: 'supported',
      isUsable: true,
      isUnprobed: false
    });
  });

  it('degraded is usable AND carries a caveat — the state most easily collapsed into the other three', () => {
    const gate = resolveGate(degraded, key);
    expect(gate.isUsable).toBe(true);
    expect(gate.effective).toBe('degraded');
    expect(gate.reason).toBe('rounds oddly');
  });

  it('unsupported is not usable and carries the reason', () => {
    const gate = resolveGate(unsupported, key);
    expect(gate.isUsable).toBe(false);
    expect(gate.reason).toBe('not a thing here');
  });

  it('an UNPROBED conditional is unsupported — the rule that makes the editor claim safe', () => {
    const gate = resolveGate(conditional, key);
    expect(gate.declared).toBe('conditional');
    expect(gate.effective).toBe('unsupported');
    expect(gate.isUsable).toBe(false);
    expect(gate.isUnprobed).toBe(true);
    expect(gate.reason).toBe('depends on your instance');
    expect(gate.probe).toBeDefined();
  });

  it('a positive probe opens it', () => {
    const gate = resolveGate(conditional, key, {
      probes: { [key]: { verdict: 'supported', at: T0 } },
      now: T0
    });
    expect(gate.effective).toBe('supported');
    expect(gate.isUsable).toBe(true);
    expect(gate.isUnprobed).toBe(false);
  });

  it('a negative probe closes it, and the probe detail joins the reason', () => {
    const gate = resolveGate(conditional, key, {
      probes: { [key]: { verdict: 'unsupported', at: T0, detail: 'no upgrade in 3000ms' } },
      now: T0
    });
    expect(gate.isUsable).toBe(false);
    expect(gate.reason).toBe('depends on your instance (no upgrade in 3000ms)');
  });

  it('a probe result for ANOTHER capability does not settle this one', () => {
    const gate = resolveGate(conditional, key, {
      probes: { 'data.aggregate': { verdict: 'supported', at: T0 } },
      now: T0
    });
    expect(gate.isUnprobed).toBe(true);
  });

  // ── The staleness rule — the spec's own trap ─────────────────────────────

  it('a STALE POSITIVE is not believed: a Directus with WebSockets switched off after the probe cannot claim realtime works', () => {
    const probes = { [key]: { verdict: 'supported' as const, at: T0 } };

    expect(resolveGate(conditional, key, { probes, now: T0 + POSITIVE_PROBE_TTL_MS }).isUsable).toBe(true);

    const stale = resolveGate(conditional, key, { probes, now: T0 + POSITIVE_PROBE_TTL_MS + 1 });
    expect(stale.isUsable).toBe(false);
    expect(stale.isUnprobed).toBe(true);
    expect(stale.reason).toBe('depends on your instance');
  });

  it('a stale NEGATIVE is still believed — prefer a fast negative over a cached positive', () => {
    const gate = resolveGate(conditional, key, {
      probes: { [key]: { verdict: 'unsupported', at: T0 } },
      now: T0 + POSITIVE_PROBE_TTL_MS * 1000
    });
    expect(gate.isUsable).toBe(false);
    expect(gate.isUnprobed).toBe(false);
  });
});

// ── The lookup ─────────────────────────────────────────────────────────────

describe('gateFor', () => {
  it('reads the descriptor rather than having an opinion', () => {
    // PocketBase aggregate is the case BCN-001's probe exists for: 200 with
    // ordinary un-aggregated rows, indistinguishable from an invented parameter.
    const gate = gateFor('pocketbase', 'data.aggregate');
    expect(gate.isUsable).toBe(false);
    expect(gate.reason).toBe(descriptorFor('pocketbase').capabilities['data.aggregate'].state === 'unsupported'
      ? (descriptorFor('pocketbase').capabilities['data.aggregate'] as { reason: string }).reason
      : undefined);
  });

  it('an unknown backend type resolves to supported — the safe floor', () => {
    // A project's saved `type` is not a closed set at rest. A gate that cannot
    // look the backend up must never disable something and then explain it with
    // a sentence about a backend the user is not using.
    expect(gateFor('a-backend-from-2031', 'auth.magicLink').isUsable).toBe(true);
    expect(gateFor(undefined, 'auth.magicLink').isUsable).toBe(true);
  });

  it('the live-pass cells are what the live pass expects to find', () => {
    // Pinned so that a later flip of any of these announces itself here rather
    // than by silently changing what the criterion-3 demonstration shows.
    expect(gateFor('directus', 'auth.magicLink').isUsable).toBe(false);
    expect(gateFor('supabase', 'auth.magicLink').isUsable).toBe(true);
    expect(gateFor('directus', 'realtime.subscribe').declared).toBe('conditional');
    expect(gateFor('directus', 'realtime.subscribe').isUnprobed).toBe(true);
    expect(gateFor('pocketbase', 'data.aggregate').isUsable).toBe(false);
    expect(gateFor('directus', 'data.aggregate').isUsable).toBe(true);
    expect(gateFor('directus', 'data.acl').isUsable).toBe(false);
    expect(gateFor('nodegx', 'data.acl').isUsable).toBe(true);
  });

  it('Supabase realtime is unsupported, not conditional — no probe may enable a port with no transport behind it', () => {
    const gate = gateFor('supabase', 'realtime.subscribe');
    expect(gate.declared).toBe('unsupported');
    expect(gate.probe).toBeUndefined();
    // And it cannot be talked into it by a probe result, which is the point.
    expect(
      gateFor('supabase', 'realtime.subscribe', {
        probes: { 'realtime.subscribe': { verdict: 'supported', at: T0 } },
        now: T0
      }).isUsable
    ).toBe(false);
  });
});

// ── The node bindings ──────────────────────────────────────────────────────

describe('NODE_CAPABILITIES', () => {
  it('binds only capability keys that exist', () => {
    const known = new Set<string>(CAPABILITY_KEYS);
    for (const [typeName, binding] of Object.entries(NODE_CAPABILITIES)) {
      if (binding.node) expect([typeName, known.has(binding.node)]).toEqual([typeName, true]);
      for (const [port, key] of Object.entries(binding.ports || {})) {
        expect([typeName, port, known.has(key)]).toEqual([typeName, port, true]);
      }
    }
  });

  it('has no entry that is also recorded as deliberately unbound', () => {
    const both = Object.keys(NODE_CAPABILITIES).filter((name) =>
      Object.prototype.hasOwnProperty.call(DELIBERATELY_UNBOUND, name)
    );
    expect(both).toEqual([]);
  });

  it('every binding says something on at least one backend', () => {
    // A binding that is `supported` everywhere is noise on screen and a claim
    // in a table that nothing can ever check.
    const inert: string[] = [];
    for (const [typeName, binding] of Object.entries(NODE_CAPABILITIES)) {
      const keys = [binding.node, ...Object.values(binding.ports || {})].filter(Boolean) as CapabilityKey[];
      for (const key of keys) {
        const speaks = BACKEND_TYPES.some((type) => {
          const gate = gateFor(type, key);
          return !gate.isUsable || gate.effective === 'degraded';
        });
        if (!speaks) inert.push(`${typeName} → ${key}`);
      }
    }
    expect(inert).toEqual([]);
  });

  it('lookups agree with the table', () => {
    expect(nodeCapabilityKey('net.noodl.user.RequestMagicLink')).toBe('auth.magicLink');
    expect(nodeCapabilityKey('DbCollection2')).toBeUndefined();
    expect(portCapabilityKey('DbCollection2', 'realtime')).toBe('realtime.subscribe');
    expect(portCapabilityKey('DbCollection2', 'collectionName')).toBeUndefined();
    expect(portCapabilityKey('net.noodl.user.RequestMagicLink', 'realtime')).toBeUndefined();
    // `hasOwnProperty` rather than `in`, so a port called `toString` is not a capability.
    expect(portCapabilityKey('DbCollection2', 'constructor')).toBeUndefined();
    expect(nodeCapabilityKey('toString')).toBeUndefined();
  });

  it('boundCapabilityKeys is what a probe runner would ask about', () => {
    const keys = boundCapabilityKeys();
    expect(keys).toContain('realtime.subscribe');
    expect(keys).toContain('data.aggregate');
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...keys].sort());
  });
});

// ── The cache ──────────────────────────────────────────────────────────────

describe('CapabilityProbeCache', () => {
  function cache(runner: (n: number) => ProbeOutcome, clock = { t: T0 }) {
    let calls = 0;
    const instance = new CapabilityProbeCache({
      runner: async () => runner(++calls),
      now: () => clock.t
    });
    return { instance, clock, callCount: () => calls };
  }

  const DIRECTUS: BackendType = 'directus';

  it('probes a conditional cell once and remembers the answer', async () => {
    const c = cache(() => ({ verdict: 'unsupported', at: T0, detail: 'no upgrade' }));
    await c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    await c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    expect(c.callCount()).toBe(1);
    expect(c.instance.results('b1')['realtime.subscribe']?.verdict).toBe('unsupported');
  });

  it('does not probe a cell that is not conditional', async () => {
    const c = cache(() => ({ verdict: 'supported', at: T0 }));
    // Directus `data.query` is plain `supported`; there is nothing to ask.
    await c.instance.ensure('b1', DIRECTUS, 'http://x', 'data.query');
    expect(c.callCount()).toBe(0);
  });

  it('re-probes a POSITIVE once it is stale, and never re-probes a negative', async () => {
    const clock = { t: T0 };
    const yes = cache(() => ({ verdict: 'supported', at: clock.t }), clock);
    await yes.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    clock.t = T0 + POSITIVE_PROBE_TTL_MS + 1;
    await yes.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    expect(yes.callCount()).toBe(2);

    const clock2 = { t: T0 };
    const no = cache(() => ({ verdict: 'unsupported', at: clock2.t }), clock2);
    await no.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    clock2.t = T0 + POSITIVE_PROBE_TTL_MS * 1000;
    await no.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    expect(no.callCount()).toBe(1);
  });

  it('invalidate() re-probes — this is what a reconnect calls', async () => {
    const c = cache(() => ({ verdict: 'unsupported', at: T0 }));
    await c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    c.instance.invalidate('b1');
    expect(c.instance.results('b1')).toEqual({});
    await c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    expect(c.callCount()).toBe(2);
  });

  it('keeps two instances of the same backend type apart', async () => {
    let n = 0;
    const instance = new CapabilityProbeCache({
      runner: async () => ({ verdict: ++n === 1 ? 'supported' : 'unsupported', at: T0 }),
      now: () => T0
    });
    await instance.ensure('b1', DIRECTUS, 'http://a', 'realtime.subscribe');
    await instance.ensure('b2', DIRECTUS, 'http://b', 'realtime.subscribe');
    expect(instance.results('b1')['realtime.subscribe']?.verdict).toBe('supported');
    expect(instance.results('b2')['realtime.subscribe']?.verdict).toBe('unsupported');
  });

  it('coalesces concurrent asks into one request', async () => {
    const c = cache(() => ({ verdict: 'unsupported', at: T0 }));
    await Promise.all([
      c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe'),
      c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe'),
      c.instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe')
    ]);
    expect(c.callCount()).toBe(1);
  });

  it('a runner that throws records NOTHING — "could not ask" is not "it said no"', async () => {
    const instance = new CapabilityProbeCache({
      runner: async () => {
        throw new Error('ECONNREFUSED');
      },
      now: () => T0
    });
    await instance.ensure('b1', DIRECTUS, 'http://x', 'realtime.subscribe');
    expect(instance.results('b1')['realtime.subscribe']).toBeUndefined();
    // …and the gate still closes, on the descriptor's hedged wording rather
    // than on a confident sentence we would have invented from a DNS failure.
    const gate = gateFor(DIRECTUS, 'realtime.subscribe', { probes: instance.results('b1'), now: T0 });
    expect(gate.isUsable).toBe(false);
    expect(gate.isUnprobed).toBe(true);
  });

  it('notifies listeners so a panel repaints when a probe settles', async () => {
    const seen: string[] = [];
    const instance = new CapabilityProbeCache({
      runner: async () => ({ verdict: 'unsupported', at: T0 }),
      now: () => T0
    });
    instance.onChange((id) => seen.push(id));
    await instance.ensure('b7', DIRECTUS, 'http://x', 'realtime.subscribe');
    expect(seen).toEqual(['b7']);
  });

  it('strips a trailing slash so a probe path is never doubled', async () => {
    let seenUrl = '';
    const instance = new CapabilityProbeCache({
      runner: async (request) => {
        seenUrl = request.url;
        return { verdict: 'unsupported', at: T0 };
      },
      now: () => T0
    });
    await instance.ensure('b1', DIRECTUS, 'http://x:8055///', 'realtime.subscribe');
    expect(seenUrl).toBe('http://x:8055');
  });
});

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
