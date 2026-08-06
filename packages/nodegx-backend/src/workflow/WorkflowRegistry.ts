/**
 * WorkflowRegistry — the persisted, deployable WF-001 workflow definitions.
 *
 * One file per workflow at `<dataDir>/workflow-defs/<id>.workflow-def.json`:
 * diffable (SUB-007), MCP-editable, and it deploys WITH the backend (so a
 * workflow travels to a VPS and survives a restart). Definitions are validated
 * strictly on load — an invalid file REFUSES to start, the same doctrine as
 * triggers.json/security.json: a workflow that silently fails to load is an
 * automation that fails on a delay timer.
 *
 * This is the same on-disk convention as the historically-named function
 * `*.workflow.json` files, kept in a SEPARATE directory (`workflow-defs/`) so the
 * two artifact kinds never collide.
 *
 * @module nodegx-backend/workflow/WorkflowRegistry
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { validateWorkflowDefinition } from './WorkflowEngine';
import { migrateDefinition } from './steps/migrate';
import type { WorkflowDefinition, WorkflowInput } from './types';

const DIR = 'workflow-defs';
const SUFFIX = '.workflow-def.json';
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export class WorkflowConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowConfigError';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export class WorkflowRegistry {
  private readonly dir: string;
  private defs = new Map<string, WorkflowDefinition>();

  constructor(private readonly dataDir: string) {
    this.dir = path.join(dataDir, DIR);
    this.load();
  }

  /** Load + validate every definition. An invalid file refuses to start (loud). */
  private load(): void {
    this.defs.clear();
    if (!fs.existsSync(this.dir)) return;
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith(SUFFIX));
    const allErrors: string[] = [];
    for (const file of files) {
      const full = path.join(this.dir, file);
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(full, 'utf-8'));
      } catch (e) {
        allErrors.push(`${file}: not valid JSON: ${e instanceof Error ? e.message : e}`);
        continue;
      }
      // CWF-005: a definition written against an older step vocabulary becomes
      // the current one HERE, in memory, before validation — so it validates and
      // runs by today's rules. The FILE IS NOT REWRITTEN: nothing edits a user's
      // workflow because they started a backend. It is persisted in the migrated
      // form the first time they save it themselves. See `steps/migrate.ts` for
      // all three cases, including what an older backend makes of a file saved
      // after the fold.
      const def = migrateDefinition(parsed as WorkflowDefinition);
      const errs = validateWorkflowDefinition(def);
      if (errs.length) {
        allErrors.push(...errs.map((e) => `${file}: ${e}`));
        continue;
      }
      if (this.defs.has(def.id)) allErrors.push(`${file}: duplicate workflow id "${def.id}"`);
      this.defs.set(def.id, def);
    }
    if (allErrors.length) {
      throw new WorkflowConfigError(
        `Invalid workflow definitions — refusing to start with workflows that would not run correctly:\n` +
          allErrors.map((e) => `  - ${e}`).join('\n')
      );
    }
  }

  list(): WorkflowDefinition[] {
    return [...this.defs.values()].map((d) => ({ ...d }));
  }

  get(id: string): WorkflowDefinition | null {
    const d = this.defs.get(id);
    return d ? { ...d } : null;
  }

  /**
   * The definition an input WOULD become — the shape `upsert` persists, built
   * without persisting it.
   *
   * Shared by `upsert` and `validate` deliberately: a dry run that normalised
   * differently from the real write would answer a question nobody asked.
   */
  private normalize(input: WorkflowInput): WorkflowDefinition {
    // CWF-005: migrate on the WRITE path too, so a client that still speaks the
    // old vocabulary — an agent that learned `retry`, a definition copied from
    // an older backend — is accepted and converted rather than rejected. The
    // catalog serves `migratedKinds` so a client can know that in advance.
    input = migrateDefinition(input);
    const existing = input.id ? this.defs.get(input.id) : undefined;
    const id = input.id || 'wf_' + crypto.randomBytes(9).toString('base64url');
    if (!ID_RE.test(id)) {
      throw new WorkflowConfigError(`workflow id "${id}" must match [A-Za-z0-9][A-Za-z0-9_-]{0,63}`);
    }
    const now = nowIso();
    return {
      version: 1,
      id,
      name: input.name,
      entry: input.entry,
      concurrency: input.concurrency && input.concurrency >= 1 ? input.concurrency : 1,
      timeoutMs: input.timeoutMs,
      stepTimeoutMs: input.stepTimeoutMs,
      steps: input.steps || [],
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
  }

  /**
   * WFA-007 — "would you accept this?", answered without accepting it.
   *
   * Until this existed, the only way to learn whether a definition passed
   * validation was to POST or PUT it, which persists on success. So "check" and
   * "write" were the same call, and a proposal could not be validated against
   * its target backend without becoming that backend's state — the one thing a
   * review surface exists to prevent.
   *
   * Same normalisation, same validator, nothing written. An id that cannot be
   * one is returned as an error rather than thrown, because a dry run's job is
   * to report every reason rather than to stop at the first.
   */
  validate(input: WorkflowInput): string[] {
    let def: WorkflowDefinition;
    try {
      def = this.normalize(input);
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
    return validateWorkflowDefinition(def);
  }

  /**
   * Create or update a workflow definition. Validates strictly and REJECTS
   * (throws WorkflowConfigError) rather than persisting a definition that would
   * not run — including a cyclic graph or a dangling edge.
   */
  upsert(input: WorkflowInput): WorkflowDefinition {
    const def = this.normalize(input);

    const errors = validateWorkflowDefinition(def);
    if (errors.length) {
      throw new WorkflowConfigError(`Invalid workflow:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    }

    this.persist(def);
    this.defs.set(def.id, def);
    return { ...def };
  }

  delete(id: string): boolean {
    if (!this.defs.has(id)) return false;
    this.defs.delete(id);
    const full = path.join(this.dir, `${id}${SUFFIX}`);
    try {
      fs.unlinkSync(full);
    } catch {
      // Already gone on disk — the in-memory delete is what matters.
    }
    return true;
  }

  private persist(def: WorkflowDefinition): void {
    fs.mkdirSync(this.dir, { recursive: true });
    const full = path.join(this.dir, `${def.id}${SUFFIX}`);
    const tmp = `${full}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(def, null, 2) + '\n');
    fs.renameSync(tmp, full);
  }
}
