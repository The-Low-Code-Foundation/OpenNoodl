/**
 * BCN-009: the security disclosure, the switch comparison, and the
 * `publicToken` finding.
 *
 * The prose is the deliverable of this task, so the parts of it that can be
 * checked mechanically are checked here rather than remembered — the same
 * argument BCN-001 made when it put its three reason-string rules behind a test
 * instead of behind a review note.
 *
 * Jasmine, not Jest: this suite runs as a webpack bundle inside a real Electron
 * renderer (see `tests/index.ts`), and an `import … from '@jest/globals'` throws
 * at module load and takes the whole run down with it.
 */

import { BACKEND_TYPES, type BackendType } from '@noodl/backend-contract';

import { ENDPOINT_BACKEND_ID } from '../../src/editor/src/models/BackendServices/activeBackend';
import {
  buildBackendList,
  dataBrowserAvailability,
  endpointBackendType,
  matchEndpointToManaged
} from '../../src/editor/src/models/BackendServices/backendList';
import {
  backendPresets,
  getAllPresets,
  getPresetOptions,
  getRestConfigurablePresets
} from '../../src/editor/src/models/BackendServices/presets';
import {
  BACKEND_SECURITY,
  describeBackendSwitch,
  securityFor
} from '../../src/editor/src/models/BackendServices/security';
import {
  collectPublicTokenFindings,
  PUBLIC_TOKEN_VISIBLE_CHECK,
  tokenFingerprint
} from '../../src/editor/src/models/BackendServices/securityFindings';
import type { BackendConfig } from '../../src/editor/src/models/BackendServices/types';

function backendFixture(overrides: Partial<BackendConfig> & Pick<BackendConfig, 'type'>): BackendConfig {
  const now = new Date('2026-07-31T00:00:00.000Z');
  const preset = backendPresets[overrides.type];
  return {
    id: 'backend_1',
    name: 'Test backend',
    url: 'https://example.test',
    auth: { method: 'bearer' },
    endpoints: preset.endpoints,
    responseConfig: preset.responseConfig,
    status: 'disconnected',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('BCN-009 — the six presets', () => {
  it('has exactly one preset per backend type the contract knows about', () => {
    expect(getAllPresets().length).toBe(BACKEND_TYPES.length);
    for (const type of BACKEND_TYPES) {
      expect(backendPresets[type]).toBeDefined();
      expect(backendPresets[type].type).toBe(type);
    }
  });

  it('names the built-in backend "Built-in" and includes Parse Server', () => {
    expect(backendPresets.nodegx.displayName).toBe('Built-in');
    expect(backendPresets.parse.displayName).toBe('Parse Server');
  });

  it('offers all six when adding a backend, and four of them through the REST form', () => {
    expect(getPresetOptions().length).toBe(6);

    const restTypes = getRestConfigurablePresets().map((preset) => preset.type);
    expect(restTypes).toEqual(['directus', 'supabase', 'pocketbase', 'custom']);
  });

  it('routes the two Parse-wire backends away from the REST form', () => {
    // Offering a second place to type an endpoint and app id is the duplication
    // this task removes; the presets are what stop it coming back.
    expect(backendPresets.nodegx.configuredBy).toBe('managed-process');
    expect(backendPresets.parse.configuredBy).toBe('cloud-endpoint');
  });
});

describe('BCN-009 — the security disclosure', () => {
  it('says something about every backend', () => {
    for (const type of BACKEND_TYPES) {
      expect(securityFor(type)).toBe(BACKEND_SECURITY[type]);
    }
  });

  /**
   * BCN-001 §5.4's three rules, applied to this prose. They are here rather than
   * in a review note for the reason that task gave: a rule remembered is a rule
   * that drifts the next time somebody adds a backend.
   */
  it('reads like a product fact, not like a backlog item', () => {
    const backlog = ['not implemented', 'coming soon', 'not yet supported', 'TODO', 'unsupported', 'capability'];

    for (const type of BACKEND_TYPES) {
      const disclosure = securityFor(type);
      for (const sentence of [disclosure.headline, disclosure.visitorsCanSee, disclosure.rulesAreSet]) {
        expect(sentence.length).toBeGreaterThan(0);
        // A sentence, not a label.
        expect(/[.!?]$/.test(sentence.trim())).toBe(true, `${type}: "${sentence}" does not end in punctuation`);
        for (const phrase of backlog) {
          expect(sentence.toLowerCase().includes(phrase.toLowerCase())).toBe(
            false,
            `${type}: "${sentence}" contains backlog language "${phrase}"`
          );
        }
      }
    }
  });

  it('gives every backend a phrase that reads in the switch comparison', () => {
    for (const type of BACKEND_TYPES) {
      const disclosure = securityFor(type);
      // These two are interpolated after "Publishes " and "Access decided by ",
      // so a trailing full stop or a leading capital would read wrong.
      expect(/[.!?]$/.test(disclosure.publishes)).toBe(false, `${type}: publishes phrase ends a sentence`);
      expect(/[.!?]$/.test(disclosure.rulesLiveIn)).toBe(false, `${type}: rulesLiveIn phrase ends a sentence`);
    }
  });

  it('marks exactly the backends that publish something a stranger can act with', () => {
    // The asymmetry is the whole point: an app id names a server, an access
    // token acts on one.
    expect(securityFor('nodegx').publishedCredential).toBe('app-id');
    expect(securityFor('parse').publishedCredential).toBe('app-id');
    expect(securityFor('directus').publishedCredential).toBe('access-token');
    expect(securityFor('supabase').publishedCredential).toBe('access-token');
    expect(securityFor('pocketbase').publishedCredential).toBe('none');
    expect(securityFor('custom').publishedCredential).toBe('unknown');
  });
});

describe('BCN-009 — what changes when a project changes backends', () => {
  it('names both sides in the sentence about rules', () => {
    const result = describeBackendSwitch('nodegx', 'supabase', { from: 'Built-in', to: 'My Supabase' });
    expect(result.rulesDoNotTravel.includes('Built-in')).toBe(true);
    expect(result.rulesDoNotTravel.includes('My Supabase')).toBe(true);
  });

  it('says so when the app starts publishing a copyable token', () => {
    const result = describeBackendSwitch('nodegx', 'directus', { from: 'Built-in', to: 'Directus' });
    expect(result.tokenVisibilityChange).toBeDefined();
    expect(result.tokenVisibilityChange.includes('copy')).toBe(true);
  });

  it('says so when it stops publishing one', () => {
    const result = describeBackendSwitch('supabase', 'pocketbase', { from: 'Supabase', to: 'PocketBase' });
    expect(result.tokenVisibilityChange).toBeDefined();
    expect(result.tokenVisibilityChange.includes('no longer')).toBe(true);
  });

  it('stays quiet when nothing about token visibility changed', () => {
    // A line that appears every time is a line nobody reads.
    const result = describeBackendSwitch('directus', 'supabase', { from: 'Directus', to: 'Supabase' });
    expect(result.tokenVisibilityChange).toBeUndefined();
  });
});

describe('BCN-009 — the publicToken finding (input to OPS-006)', () => {
  it('reports a Supabase backend that publishes a key', () => {
    const findings = collectPublicTokenFindings([
      backendFixture({ type: 'supabase', name: 'My Supabase', auth: { method: 'api-key', publicToken: 'anon-key' } })
    ]);

    expect(findings.length).toBe(1);
    expect(findings[0].check).toBe(PUBLIC_TOKEN_VISIBLE_CHECK);
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].anchor.backendName).toBe('My Supabase');
  });

  it('never puts the token itself into the finding', () => {
    // OPS-003 §4: redaction is a whitelist. A finding gets pasted into a chat
    // window, and the one thing it must not carry is the secret it is about.
    const findings = collectPublicTokenFindings([
      backendFixture({ type: 'directus', auth: { method: 'bearer', publicToken: 'super-secret-token' } })
    ]);

    expect(JSON.stringify(findings).includes('super-secret-token')).toBe(false);
  });

  it('does not report a backend whose published value is an app id', () => {
    const findings = collectPublicTokenFindings([
      backendFixture({ type: 'nodegx', auth: { method: 'none', publicToken: 'app-id' } }),
      backendFixture({ type: 'parse', auth: { method: 'none', publicToken: 'app-id' } }),
      backendFixture({ type: 'pocketbase', auth: { method: 'bearer', publicToken: '' } })
    ]);

    expect(findings.length).toBe(0);
  });

  it('keys a dismissal to the backend and the token, so rotating one re-opens it', () => {
    const before = collectPublicTokenFindings([
      backendFixture({ type: 'directus', auth: { method: 'bearer', publicToken: 'first' } })
    ])[0];
    const same = collectPublicTokenFindings([
      backendFixture({ type: 'directus', auth: { method: 'bearer', publicToken: 'first' } })
    ])[0];
    const rotated = collectPublicTokenFindings([
      backendFixture({ type: 'directus', auth: { method: 'bearer', publicToken: 'second' } })
    ])[0];

    expect(before.dismissalKey).toBe(same.dismissalKey);
    expect(before.dismissalKey).not.toBe(rotated.dismissalKey);
  });

  it('fingerprints a token without carrying it', () => {
    expect(tokenFingerprint('abc')).toBe(tokenFingerprint('abc'));
    expect(tokenFingerprint('abc')).not.toBe(tokenFingerprint('abd'));
    expect(tokenFingerprint('abc').includes('abc')).toBe(false);
  });
});

describe('BCN-009 — one list from three mechanisms', () => {
  it('reads an endpoint with no recorded type as the narrower backend', () => {
    // Guessing wide would offer aggregate on a server that answers it with
    // "master key is required".
    expect(endpointBackendType(undefined)).toBe('parse');
    expect(endpointBackendType('external')).toBe('parse');
    expect(endpointBackendType('nodegx')).toBe('nodegx');
  });

  it('puts the backend the project is talking to first', () => {
    const entries = buildBackendList({
      managed: [{ id: 'local1', name: 'Local', port: 8577, running: true }],
      endpoint: { endpoint: 'http://localhost:8577', appId: 'local1', type: 'nodegx' },
      external: [backendFixture({ type: 'directus', id: 'ext1', name: 'Directus' })],
      activeBackendId: ENDPOINT_BACKEND_ID
    });

    // AAQ-002: TWO entries, not three. The endpoint and the managed process are
    // one backend — this spec used to assert the duplicate, and the duplicate is
    // what a user saw as a "Built-in backend" card that could only be edited or
    // disconnected, next to the card that could open its data.
    expect(entries.length).toBe(2);
    expect(entries[0].isActive).toBe(true);
    expect(entries[0].kind).toBe('managed');
    expect(entries[0].isProjectEndpoint).toBe(true);
    expect(entries.map((entry) => entry.type)).toContain('directus' as BackendType);
  });

  // ⚠️ The defect this list used to make visible, now pinned. Before BCN-009
  // step 2 the endpoint entry was `isActive: true` unconditionally and the
  // managed entry matched on the port, so one server and one Directus produced
  // *three* active entries — and the panel drew two ACTIVE badges.
  it('has at most one active entry, whatever the project holds', () => {
    const sources = {
      managed: [{ id: 'local1', name: 'Local', port: 8577, running: true }],
      endpoint: { endpoint: 'http://localhost:8577', appId: 'local1', type: 'nodegx' },
      external: [backendFixture({ type: 'directus', id: 'ext1', name: 'Directus' })]
    };

    for (const activeBackendId of [undefined, ENDPOINT_BACKEND_ID, 'ext1', 'gone']) {
      const active = buildBackendList({ ...sources, activeBackendId }).filter((entry) => entry.isActive);
      expect(active.length).toBeLessThan(2);
    }
  });

  it('labels the endpoint entry with a name, not with an app id', () => {
    const entries = buildBackendList({
      managed: [],
      endpoint: { endpoint: 'http://localhost:8577', appId: 'backend_ms94j6xso72rl', type: 'nodegx' },
      external: [],
      activeBackendId: ENDPOINT_BACKEND_ID
    });

    // The app id is identity, not a name. It belongs on the detail line, which
    // is where a user looking for "which server" finds the URL anyway.
    expect(entries[0].name).toBe('Built-in backend');
    expect(entries[0].detail).toContain('backend_ms94j6xso72rl');
    expect(entries[0].backendId).toBe(ENDPOINT_BACKEND_ID);
  });

  it('offers the record grid only where the editor can actually reach it, with a reason where it cannot', () => {
    const managed = dataBrowserAvailability('nodegx', 'managed');
    expect(managed.isAvailable).toBe(true);

    const external = dataBrowserAvailability('directus', 'external');
    expect(external.isAvailable).toBe(false);
    expect(external.reason.length).toBeGreaterThan(0);
  });
});

/**
 * AAQ-002 — one backend, one card.
 *
 * `provisionBackend` creates a managed process and then binds the project to it
 * by writing `cloudservices`, so the same server had two entries: the endpoint
 * one, which wore ACTIVE and could only be edited or disconnected, and the
 * managed one, which could open the schema and the data and looked like a
 * different backend entirely. Disconnecting removed the first and read as
 * deletion.
 */
describe('AAQ-002 — the provisioned backend is one entry', () => {
  const local = { id: 'backend_abc', name: 'App backend', port: 8577, running: true };

  it('matches the endpoint to the managed process by the id the provisioner wrote', () => {
    // `setCloudServices(project, { id: meta.id, … })` stores the managed id as
    // `instanceId` — exact, and the reason this is not guesswork. The port here
    // deliberately does NOT match, so only the id can be doing the work.
    expect(
      matchEndpointToManaged({ id: 'backend_abc', endpoint: 'http://localhost:9999' }, [local])?.id
    ).toBe('backend_abc');
  });

  it('falls back to a localhost port, for a binding written before the id was carried', () => {
    expect(matchEndpointToManaged({ endpoint: 'http://localhost:8577' }, [local])?.id).toBe('backend_abc');
    // Someone else's server on a familiar port is not this machine's backend.
    expect(matchEndpointToManaged({ endpoint: 'https://api.example.com:8577' }, [local])).toBeUndefined();
    expect(matchEndpointToManaged({ endpoint: 'http://localhost:9999' }, [local])).toBeUndefined();
    expect(matchEndpointToManaged(undefined, [local])).toBeUndefined();
  });

  it('gives the surviving entry the badge, and the Data Browser with it', () => {
    const entries = buildBackendList({
      managed: [local],
      endpoint: { id: 'backend_abc', endpoint: 'http://localhost:8577', appId: 'backend_abc', type: 'nodegx' },
      external: [],
      activeBackendId: ENDPOINT_BACKEND_ID
    });

    expect(entries.length).toBe(1);
    expect(entries[0].kind).toBe('managed');
    expect(entries[0].isActive).toBe(true);
    expect(entries[0].isProjectEndpoint).toBe(true);
    // The point of folding them: this is the gate the crippled card failed, with
    // a reason written for foreign Parse servers.
    expect(dataBrowserAvailability(entries[0].type, entries[0].kind).isAvailable).toBe(true);
  });

  it('leaves a deployed or foreign endpoint its own entry — there is no process here to fold it into', () => {
    const entries = buildBackendList({
      managed: [local],
      endpoint: { endpoint: 'https://api.example.com', appId: 'app', type: 'external' },
      external: [],
      activeBackendId: ENDPOINT_BACKEND_ID
    });

    expect(entries.length).toBe(2);
    expect(entries.filter((entry) => entry.kind === 'endpoint').length).toBe(1);
    // And the managed one is not wearing a badge it did not earn.
    expect(entries.find((entry) => entry.kind === 'managed')!.isActive).toBe(false);
    expect(entries.find((entry) => entry.kind === 'managed')!.isProjectEndpoint).toBeUndefined();
  });

  it('still has at most one active entry once they are folded', () => {
    const sources = {
      managed: [local, { id: 'other', name: 'Other', port: 8578, running: true }],
      endpoint: { id: 'backend_abc', endpoint: 'http://localhost:8577', appId: 'backend_abc', type: 'nodegx' },
      external: [backendFixture({ type: 'directus', id: 'ext1', name: 'Directus' })]
    };

    for (const activeBackendId of [undefined, ENDPOINT_BACKEND_ID, 'ext1', 'gone']) {
      const active = buildBackendList({ ...sources, activeBackendId }).filter((entry) => entry.isActive);
      expect(active.length).toBeLessThan(2);
    }
  });
});
