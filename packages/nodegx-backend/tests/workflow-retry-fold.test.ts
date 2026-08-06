/**
 * CWF-005 — `retry` folded into `call-function`, and what happens to the
 * definitions that already say `retry`.
 *
 * The fold is only safe if THREE things hold, and each one is a way it could have
 * gone wrong quietly:
 *
 *   1. a `retry` step with NO params keeps retrying. It relied on the EXECUTOR's
 *      fallback of 3 — the catalog's `default` never set anything — and the
 *      folded policy is off unless `maxAttempts` > 1. Migrating without writing
 *      the number in would turn three attempts into one, on every retry step
 *      whose author never touched the field.
 *   2. a `call-function` step WITHOUT a policy behaves exactly as it did, and its
 *      output does not grow `attempts` / `retried`.
 *   3. a definition on disk is NOT rewritten by being read.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { WorkflowRegistry } from '../src/workflow/WorkflowRegistry';
import { MIGRATED_STEP_KINDS, migrateDefinition, migrateStep } from '../src/workflow/steps/migrate';
import { STEP_KINDS, STEP_KIND_SPECS, isStepKind, stepKindCatalog } from '../src/workflow/steps/kinds';
import { retryPolicyActive } from '../src/workflow/steps/retryPolicy';
import type { WorkflowDefinition, WorkflowStep } from '../src/workflow/types';

const RETRY_DEF = {
  version: 1,
  id: 'legacy',
  entry: 'r',
  concurrency: 1,
  createdAt: 'then',
  updatedAt: 'then',
  steps: [{ id: 'r', kind: 'retry', ref: 'charge' } as unknown as WorkflowStep]
} as unknown as WorkflowDefinition;

describe('CWF-005 — the kind is gone from the vocabulary', () => {
  it('the picker has eight kinds, and retry is not one of them', () => {
    expect(STEP_KINDS).not.toContain('retry');
    expect(isStepKind('retry')).toBe(false);
    expect(STEP_KIND_SPECS['retry' as 'call-function']).toBeUndefined();
  });

  it('call-function carries the policy, in its own panel section', () => {
    const params = STEP_KIND_SPECS['call-function'].params;
    const policy = params.filter((p) => p.group === 'Retry policy').map((p) => p.name);
    expect(policy).toEqual(['maxAttempts', 'delayMs', 'backoffMultiplier', 'maxDelayMs', 'jitter', 'retryOnStatus']);
    // `ref` and the mapping stay in the default group — the policy is the part
    // that is off for most steps and needs folding away.
    expect(params.find((p) => p.name === 'ref')?.group).toBeUndefined();
  });

  it('says out loud that the output grows when the policy is on', () => {
    // A downstream `$path` into `previous.attempts` used to read a retry step's
    // output. It has to keep resolving, and an author has to be able to find out
    // that it does.
    expect(STEP_KIND_SPECS['call-function'].output).toMatch(/attempts.*retried/);
  });

  it('serves the migration, so a client can tell "cannot run" from "will convert"', () => {
    const wire = JSON.parse(JSON.stringify(stepKindCatalog())) as ReturnType<typeof stepKindCatalog>;
    expect(wire.migratedKinds).toEqual({ retry: 'call-function' });
    expect(MIGRATED_STEP_KINDS.retry).toBe('call-function');
  });
});

describe('CWF-005 — migration keeps a retry retrying', () => {
  it('MATERIALISES maxAttempts, because the policy is gated on it', () => {
    // The one line that stops the fold silently changing behaviour.
    const migrated = migrateStep({ id: 'r', kind: 'retry' as 'call-function', ref: 'charge' });
    expect(migrated.kind).toBe('call-function');
    expect(migrated.params).toEqual({ maxAttempts: 3 });
    expect(retryPolicyActive(migrated.params)).toBe(true);
  });

  it('leaves an author-set attempt count alone', () => {
    const migrated = migrateStep({
      id: 'r',
      kind: 'retry' as 'call-function',
      ref: 'charge',
      params: { maxAttempts: 7, delayMs: 50, retryOnStatus: [503] }
    });
    expect(migrated.params).toEqual({ maxAttempts: 7, delayMs: 50, retryOnStatus: [503] });
  });

  it('preserves a deliberate maxAttempts of 1 — no retry stays no retry', () => {
    const migrated = migrateStep({
      id: 'r',
      kind: 'retry' as 'call-function',
      ref: 'charge',
      params: { maxAttempts: 1 }
    });
    expect(retryPolicyActive(migrated.params)).toBe(false);
  });

  it('returns the SAME definition when nothing needed migrating', () => {
    // So a caller can tell whether anything moved, and so reading a modern
    // definition allocates nothing.
    const modern = { ...RETRY_DEF, steps: [{ id: 'c', kind: 'call-function', ref: 'charge' } as WorkflowStep] };
    expect(migrateDefinition(modern)).toBe(modern);
  });

  it('leaves an ordinary call-function step with the policy OFF', () => {
    expect(retryPolicyActive(undefined)).toBe(false);
    expect(retryPolicyActive({})).toBe(false);
    expect(retryPolicyActive({ delayMs: 500 })).toBe(false);
    expect(retryPolicyActive({ maxAttempts: 2 })).toBe(true);
  });
});

describe('CWF-005 — reading a saved workflow does not rewrite it', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf005-'));
    fs.mkdirSync(path.join(dataDir, 'workflow-defs'), { recursive: true });
  });

  afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  const file = () => path.join(dataDir, 'workflow-defs', 'legacy.workflow-def.json');

  it('loads a `retry` definition, and the FILE is untouched', () => {
    const onDisk = JSON.stringify(RETRY_DEF, null, 2) + '\n';
    fs.writeFileSync(file(), onDisk);

    const registry = new WorkflowRegistry(dataDir);
    // In memory: the current vocabulary, with the policy on.
    const loaded = registry.get('legacy')!;
    expect(loaded.steps[0].kind).toBe('call-function');
    expect(loaded.steps[0].params).toEqual({ maxAttempts: 3 });

    // On disk: byte-for-byte what the author left. Nothing edits a user's
    // workflow because they started a backend.
    expect(fs.readFileSync(file(), 'utf-8')).toBe(onDisk);
  });

  it('persists the migrated form only when something SAVES the workflow', () => {
    fs.writeFileSync(file(), JSON.stringify(RETRY_DEF, null, 2) + '\n');
    const registry = new WorkflowRegistry(dataDir);

    const saved = registry.upsert({
      id: 'legacy',
      entry: 'r',
      steps: [{ id: 'r', kind: 'retry' as 'call-function', ref: 'charge' }]
    });
    expect(saved.steps[0].kind).toBe('call-function');
    expect(JSON.parse(fs.readFileSync(file(), 'utf-8')).steps[0].kind).toBe('call-function');
  });

  it('accepts a `retry` step over the write path rather than rejecting it', () => {
    // An agent that learned the old vocabulary keeps writing it, and a deployed
    // backend holds definitions nobody is about to re-save. The reader accepts
    // `retry` forever; `validate` is the dry run that has to agree.
    const registry = new WorkflowRegistry(dataDir);
    expect(
      registry.validate({ id: 'x', entry: 'r', steps: [{ id: 'r', kind: 'retry' as 'call-function', ref: 'charge' }] })
    ).toEqual([]);
  });
});
