/**
 * Reading a definition written against an older step vocabulary (CWF-005 S3).
 *
 * WHAT HAPPENS TO A SAVED WORKFLOW WITH A `retry` STEP — the three cases, stated
 * once, because "migrate on read" is exactly the kind of phrase that hides them:
 *
 * **On read.** `WorkflowRegistry.load()` runs this over each parsed file BEFORE
 * validation. The step becomes `call-function` **in memory** and runs with the
 * policy it always had. **The file on disk is not touched.** Nothing rewrites a
 * user's definition because they started a backend; a `git diff` after a restart
 * is empty, and a backend that is rolled back finds its files exactly as it left
 * them.
 *
 * **On save.** The first time anything WRITES that workflow — the editor's Save,
 * an MCP `update_backend_workflow`, an accepted proposal — the migrated form is
 * what gets persisted, because `normalize()` migrates too. That is the author's
 * own action on their own workflow, at a moment they can see the result, which is
 * the only moment a rewrite is honest.
 *
 * **On a version that predates the fold.** A file still holding `kind: "retry"`
 * loads and runs there unchanged — this migration adds nothing to the file, so
 * there is nothing for an older backend to choke on. But a file SAVED after the
 * fold holds `kind: "call-function"` with retry params, and an older backend will
 * load it, accept it (call-function had no validation case at all before CWF-001)
 * and call the function **once**, ignoring the policy. That is a real downgrade
 * hazard and it is silent. It is stated here rather than defended against,
 * because the alternative — writing both forms — is the twin this fold exists to
 * remove.
 *
 * The reader keeps accepting `kind: "retry"` FOREVER. A deployed backend holds
 * definitions nobody is about to re-save, and an agent that learned the old
 * vocabulary will keep writing it.
 *
 * @module nodegx-backend/workflow/steps/migrate
 */

import type { WorkflowDefinition, WorkflowInput, WorkflowStep } from '../types';
import { RETRY_DEFAULTS } from './retryPolicy';

/**
 * Step kinds this backend no longer serves but still READS, and what each
 * becomes. Served in the catalog as `migratedKinds`, so a client refusing
 * unserved kinds can tell "this backend cannot run that" from "this backend
 * accepts that and will convert it".
 */
export const MIGRATED_STEP_KINDS: Readonly<Record<string, string>> = {
  // CWF-005: `retry` WAS a call-function with backoff — it took its own `ref`
  // and invoked a function directly. It is now that step's policy.
  retry: 'call-function'
};

export function isMigratedKind(kind: unknown): kind is string {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(MIGRATED_STEP_KINDS, kind);
}

/**
 * One step, in the current vocabulary. Returns the SAME object when nothing
 * changed, so a caller can tell whether a definition moved at all.
 */
export function migrateStep(step: WorkflowStep): WorkflowStep {
  if ((step.kind as string) !== 'retry') return step;

  // ⚠️ The defaults are MATERIALISED here, and this is the load-bearing line of
  // the whole migration. `retry` gated nothing: `{"kind":"retry","ref":"charge"}`
  // with no params retried three times, because `RetryStepExecutor` supplied 3 as
  // its own fallback and the catalog's `default` never set anything. The folded
  // policy is OFF unless `maxAttempts` > 1 — so migrating without writing the
  // number in would quietly turn three attempts into one, on every retry step
  // that never touched the field. Which is most of them.
  const params = { ...(step.params || {}) };
  if (typeof params.maxAttempts !== 'number' || !Number.isFinite(params.maxAttempts)) {
    params.maxAttempts = RETRY_DEFAULTS.maxAttempts;
  }

  return { ...step, kind: 'call-function', params };
}

/** A definition in the current vocabulary. Returns the same object if unchanged. */
export function migrateDefinition<T extends WorkflowDefinition | WorkflowInput>(def: T): T {
  const steps = def.steps || [];
  if (!steps.some((s) => isMigratedKind(s.kind))) return def;
  return { ...def, steps: steps.map(migrateStep) };
}
