/**
 * DEF-009 AC4 — a public cloud function that writes rows has a budget whether
 * or not anyone declared one.
 *
 * 🧭 **Richard's ruling, 2026-08-30**: 60/min, burst 30, per caller — the
 * `auth` rung of the ladder the product already has. It went AGAINST the
 * recommendation put to him, which was to keep `null`.
 *
 * ## What is graded here and why in this shape
 *
 * The behaviour under test is a REFUSAL, and §5 of the task file names the way
 * a refusal is misread: *a refused write and a filtered read are the same
 * shape*. So nothing here measures "the row did not appear" — every arm reads
 * the HTTP status and the 429's own text, which names the numbers of the bucket
 * that refused and therefore tells the per-function budget apart from the
 * shared `functions` class one (600/min, burst 200 — far above anything this
 * spec sends).
 *
 * 🔴 **A known-firing signal sits beside every absence.** `no-limit-reader`
 * and `private-writer` are asserted NOT to be limited, which is worth nothing
 * on its own: a spec whose requests never reached the limiter would read
 * identically. `declared-tight` fires at its own threshold in the same fixture,
 * over the same transport, in the same run — so the absences are absences of a
 * limit rather than absences of a request.
 *
 * ## The arms
 *
 * 1. `public-writer` — public in the graph, writes records, nothing declared:
 *    **limited at 30 burst**, and the refusal names 60/30.
 * 2. `no-limit-reader` — public, writes nothing: **not limited** (AC3).
 * 3. `private-writer` — writes records, `allowNoAuth` unticked: **not limited**
 *    (AC3). Its calls are refused 403 by the gate, which is the point: the
 *    default is about the door being open, not about the graph being dangerous.
 * 4. `opted-out-writer` — public writer carrying an explicit
 *    `{ ratePerMinute: 0, burst: 0 }`: **not limited**. This is the limiter's
 *    existing "unlimited" convention and the ruling's own caveat that the
 *    default must not collide with it — and it is the escape hatch the corpus
 *    says real endpoints need (see §"the population" below).
 * 5. `declared-tight` — a declared budget still wins, unchanged.
 *
 * ## The population this default lands on
 *
 * The ruling's evidence was *"27 unlimited public write doors across 23
 * projects, all `submitContactForm`"*. Re-run at HEAD the count holds and the
 * composition does not: **17** are `submitContactForm` and ten are not,
 * including `ses_sns_response` ×3, `stripe-webhook` ×2 and
 * `Stripe/Process payment` — provider callbacks, the one shape that
 * legitimately bursts past 30. That is why arm 4 and the boot announcement
 * exist, and why they are graded rather than described.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  PUBLIC_WRITE_DEFAULT_RATE_LIMIT,
  effectiveFunctionRateLimit,
  functionRateLimitAnnouncement,
  type SecurityConfig
} from '../src/security/model';
import { BackendService } from '../src/service';
import { RECORD_WRITE_NODE_TYPES, declaredFunctionsIn, graphWritesRecords } from '../src/workflow/functionDeclarations';

jest.setTimeout(60000);

const LOCKED_CONFIG = {
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
  functions: {
    // Arm 4: the deliberate opt-out, in the limiter's own vocabulary.
    'opted-out-writer': { rateLimit: { ratePerMinute: 0, burst: 0 } },
    // Arm 5: a declared budget, tighter than the default, still decides.
    'declared-tight': { rateLimit: { ratePerMinute: 1, burst: 1 } }
  },
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

/** A cloud component, with or without a write and with or without a public door. */
function cloudComponent(name: string, allowNoAuth: boolean, writes: boolean) {
  const nodes: Record<string, unknown>[] = [
    { id: `${name}-req`, type: 'noodl.cloud.request', x: 0, y: 0, parameters: { allowNoAuth }, ports: [], children: [] },
    { id: `${name}-res`, type: 'noodl.cloud.response', x: 0, y: 400, parameters: {}, ports: [], children: [] }
  ];
  if (writes) {
    // Flat, so the fixture is a graph the cloud runtime can actually load — the
    // recursive half of the predicate is graded directly in §7 instead, where a
    // nested tree costs nothing.
    nodes.push({
      id: `${name}-write`,
      type: 'SetDbModelProperties',
      x: 0,
      y: 200,
      parameters: { collectionName: 'Notes' },
      ports: [],
      children: []
    });
  }
  return {
    name: `/#__cloud__/${name}`,
    nodes,
    connections: [{ sourceId: `${name}-req`, sourcePort: 'receive', targetId: `${name}-res`, targetPort: 'send' }],
    roots: []
  };
}

const WORKFLOW = {
  components: [
    cloudComponent('public-writer', true, true),
    cloudComponent('no-limit-reader', true, false),
    cloudComponent('private-writer', false, true),
    cloudComponent('opted-out-writer', true, true),
    cloudComponent('declared-tight', true, true)
  ],
  settings: {},
  metadata: {}
};

interface FunctionRow {
  name: string;
  rateLimit: { ratePerMinute: number; burst: number } | null;
  effectiveRateLimit: { ratePerMinute: number; burst: number } | null;
  rateLimitSource: 'declared' | 'public-write-default' | 'none';
}

describe('DEF-009 AC4 — the public-write rate-limit default', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  /**
   * Fire `count` calls at a function AS FAST AS THE TRANSPORT ALLOWS and report
   * every status. Sequential rather than concurrent: the token bucket refills
   * at `ratePerMinute / 60_000` per millisecond, so a run that takes seconds
   * would hand back allowance mid-measurement and turn a threshold into a
   * range. Loopback keeps a call under a millisecond, and the arm that matters
   * asserts a THRESHOLD (the 30th passes, the 31st does not), which is only
   * meaningful if refill is negligible over the run.
   */
  async function burst(name: string, count: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      const res = await fetch(`${base}/functions/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });
      statuses.push(res.status);
      if (res.status === 429) {
        // Read the body once so the refusal's own numbers can be asserted.
        const text = await res.text();
        refusalBodies.set(name, text);
      } else {
        await res.text();
      }
    }
    return statuses;
  }

  const refusalBodies = new Map<string, string>();

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-def009-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(LOCKED_CONFIG));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'main.workflow.json'), JSON.stringify(WORKFLOW));

    service = new BackendService({ dataDir, port: 0, backendId: 'def009', backendName: 'DEF-009 Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. The known-firing signal, established FIRST
  // ==========================================================================

  it('a declared budget still decides, and it fires in this fixture', async () => {
    // 1/min burst 1: the first call spends the only token, the second is
    // refused. Nothing about DEF-009 is involved — this is the arm that makes
    // every "not limited" below an absence of a LIMIT rather than an absence of
    // a request.
    const statuses = await burst('declared-tight', 3);
    expect(statuses[0]).not.toBe(429);
    expect(statuses.slice(1)).toEqual([429, 429]);
    expect(refusalBodies.get('declared-tight')).toContain('1/min');
    expect(refusalBodies.get('declared-tight')).toContain('burst 1');
  });

  // ==========================================================================
  // 2. The defect, closed
  // ==========================================================================

  it('a public writing function with nothing declared is limited at 60/min burst 30', async () => {
    const statuses = await burst('public-writer', 40);

    // The threshold, exactly: 30 tokens, then refusal.
    expect(statuses.slice(0, 30).filter((s) => s === 429)).toEqual([]);
    expect(statuses[30]).toBe(429);
    expect(statuses.slice(30).every((s) => s === 429)).toBe(true);

    // 🔴 The numbers in the refusal are what tell the per-function bucket from
    // the shared class one (600/min, burst 200). Asserting only "429" would
    // pass on a class-level refusal, which is the pre-fix behaviour under a
    // heavier load and not this fix at all.
    const body = refusalBodies.get('public-writer') as string;
    expect(body).toContain('60/min');
    expect(body).toContain('burst 30');
    expect(body).toContain('public-writer');
  });

  // ==========================================================================
  // 3. The negative arms — AC3
  // ==========================================================================

  it('a public function that writes nothing is not limited', async () => {
    const statuses = await burst('no-limit-reader', 40);
    expect(statuses.filter((s) => s === 429)).toEqual([]);
    // And the calls really happened: a public reader answers, it does not 403.
    expect(statuses.every((s) => s < 400)).toBe(true);
  });

  it('a writing function whose door is shut is not limited', async () => {
    const statuses = await burst('private-writer', 40);
    expect(statuses.filter((s) => s === 429)).toEqual([]);
    // Refused by the gate, which is the distinction being drawn: the default is
    // about the door being open, not about the graph being able to write.
    expect(statuses.every((s) => s === 403)).toBe(true);
  });

  it('an explicit { ratePerMinute: 0, burst: 0 } opts a public writer out', async () => {
    const statuses = await burst('opted-out-writer', 40);
    expect(statuses.filter((s) => s === 429)).toEqual([]);
  });

  // ==========================================================================
  // 4. The panel says what is being spent
  // ==========================================================================

  it('the admin listing reports the effective budget and where it came from', async () => {
    const res = await fetch(`${base}/admin/permissions/functions`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { functions: FunctionRow[]; publicWriteDefaultRateLimit: unknown };
    const rows = Object.fromEntries(json.functions.map((r) => [r.name, r]));

    // Nothing declared, and the panel does not pretend that means unlimited.
    expect(rows['public-writer'].rateLimit).toBeNull();
    expect(rows['public-writer'].rateLimitSource).toBe('public-write-default');
    expect(rows['public-writer'].effectiveRateLimit).toEqual({ ratePerMinute: 60, burst: 30 });

    // The opt-out is reported as a DECLARATION with no bucket, not as "nobody
    // said" — the two answers this resolver exists to keep apart.
    expect(rows['opted-out-writer'].rateLimit).toEqual({ ratePerMinute: 0, burst: 0 });
    expect(rows['opted-out-writer'].rateLimitSource).toBe('declared');
    expect(rows['opted-out-writer'].effectiveRateLimit).toBeNull();

    expect(rows['no-limit-reader'].rateLimitSource).toBe('none');
    expect(rows['no-limit-reader'].effectiveRateLimit).toBeNull();

    expect(rows['declared-tight'].rateLimitSource).toBe('declared');
    expect(rows['declared-tight'].effectiveRateLimit).toEqual({ ratePerMinute: 1, burst: 1 });

    expect(json.publicWriteDefaultRateLimit).toEqual({ ratePerMinute: 60, burst: 30 });
  });

  // ==========================================================================
  // 5. The resolver, directly — the cases HTTP cannot reach cheaply
  // ==========================================================================

  describe('effectiveFunctionRateLimit', () => {
    const config = (functions: Record<string, unknown>): SecurityConfig =>
      ({ ...LOCKED_CONFIG, functions } as unknown as SecurityConfig);

    it('a config entry that sets only `call` has said nothing about rate', () => {
      // 🔴 The trap this exists for: reading "there is an entry" as consent
      // would exempt every function anyone ever configured — which is most of
      // the ones an operator cared enough to touch.
      const resolved = effectiveFunctionRateLimit(config({ fn: { call: 'public' } }), 'fn', {
        allowNoAuth: false,
        writesRecords: true
      });
      expect(resolved.source).toBe('public-write-default');
      expect(resolved.policy).toEqual(PUBLIC_WRITE_DEFAULT_RATE_LIMIT);
    });

    it('a configured `call` that shuts the door removes the default', () => {
      const resolved = effectiveFunctionRateLimit(config({ fn: { call: 'authenticated' } }), 'fn', {
        allowNoAuth: true,
        writesRecords: true
      });
      expect(resolved).toEqual({ policy: undefined, source: 'none' });
    });

    it('a `role:` rule is not a public door', () => {
      const resolved = effectiveFunctionRateLimit(config({ fn: { call: 'role:ops' } }), 'fn', {
        allowNoAuth: true,
        writesRecords: true
      });
      expect(resolved.source).toBe('none');
    });

    it('the graph port alone opens the door when nothing is configured', () => {
      expect(effectiveFunctionRateLimit(config({}), 'fn', { allowNoAuth: true, writesRecords: true }).source).toBe(
        'public-write-default'
      );
      expect(effectiveFunctionRateLimit(config({}), 'fn', { allowNoAuth: false, writesRecords: true }).source).toBe(
        'none'
      );
    });
  });

  // ==========================================================================
  // 6. The boot announcement — AC1's other half
  // ==========================================================================

  describe('functionRateLimitAnnouncement', () => {
    const config = (functions: Record<string, unknown>): SecurityConfig =>
      ({ ...LOCKED_CONFIG, functions } as unknown as SecurityConfig);

    it('names every endpoint the default bounds, and the opt-out that changes it', () => {
      const notice = functionRateLimitAnnouncement(config({}), [
        { name: 'submitContactForm', allowNoAuth: true, writesRecords: true },
        { name: 'stripe-webhook', allowNoAuth: true, writesRecords: true },
        { name: 'readOnly', allowNoAuth: true, writesRecords: false }
      ]) as string;
      expect(notice).toContain('2 public cloud functions');
      expect(notice).toContain('stripe-webhook, submitContactForm');
      expect(notice).not.toContain('readOnly');
      expect(notice).toContain('60/min, burst 30');
      // The escape hatch has to be IN the sentence that tells an operator they
      // have a problem, not one page away from it.
      expect(notice).toContain('"ratePerMinute": 0, "burst": 0');
    });

    it('says nothing when it bounds nothing', () => {
      expect(functionRateLimitAnnouncement(config({}), [])).toBeNull();
      expect(
        functionRateLimitAnnouncement(config({ fn: { rateLimit: { ratePerMinute: 5, burst: 5 } } }), [
          { name: 'fn', allowNoAuth: true, writesRecords: true }
        ])
      ).toBeNull();
    });
  });

  // ==========================================================================
  // 7. The predicate, and the copy of it in the other package
  // ==========================================================================

  it('a write nested inside a Group is still the graph’s write', () => {
    const declared = declaredFunctionsIn(WORKFLOW, 'main');
    const byName = Object.fromEntries(declared.map((d) => [d.name, d]));
    expect(byName['public-writer'].writesRecords).toBe(true);
    expect(byName['no-limit-reader'].writesRecords).toBe(false);
    expect(graphWritesRecords([{ type: 'Group', children: [{ type: 'DeleteDbModelProperties' }] }])).toBe(true);
    expect(graphWritesRecords([{ type: 'Group', children: [{ type: 'Text' }] }])).toBe(false);
  });

  it('the door WARNS about exactly the population this default LIMITS', () => {
    // 🔴 Two copies of one list in two packages that cannot import each other.
    // Held equal by reading the other file rather than by hope: the editor's
    // `public-write-door-unlimited` tells an author their door is unlimited,
    // and this default is what actually bounds it. A type renamed on one side
    // would quietly narrow one of them, and nothing else would notice.
    const doorSource = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'noodl-editor',
        'src',
        'editor',
        'src',
        'validation',
        'publicWriteDoor.ts'
      ),
      'utf-8'
    );
    const block = /export const RECORD_WRITE_NODE_TYPES: readonly string\[\] = \[([^\]]*)\]/.exec(doorSource);
    expect(block).not.toBeNull();
    const doorTypes = (block as RegExpExecArray)[1]
      .split(',')
      .map((line) => line.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    // The control: the list was actually parsed, so an equality against an
    // empty array cannot pass for agreement.
    expect(doorTypes.length).toBeGreaterThan(0);
    expect([...doorTypes].sort()).toEqual([...RECORD_WRITE_NODE_TYPES].sort());
  });
});
