/**
 * DSG-007 / F2 — the durable project identity a backend is bound to.
 *
 * `findReusableBackend` matches on **name plus ownership**, and ownership is
 * `nodegx.project.json → id` appearing in the backend's `projectIds`. A project
 * with no `id` cannot prove it owns anything, so the match short-circuits and a
 * second backend is created for a project that already has one. Every row of
 * DSG-007 §2 — three backends with `projectIds: []`, and two carrying an id no
 * project file claims any more — is that one missing field.
 *
 * ## Why this lives here and not in `ProjectStore`
 *
 * `ProjectStore` is the *authoring* surface: components, settings, tokens, the
 * cloud-services binding. This is the one field whose only consumer is the
 * provisioner, and putting it next to the provisioner is what keeps the reason
 * for writing it — a backend needs something to be bound *to* — in the same
 * file as the write. Nothing else in the server reads `id`.
 *
 * ## The identity scheme is not new; it is `create_project`'s
 *
 * ⚠️ Do not invent a scheme here. `tools/createProject.ts` already mints project
 * ids with `crypto.randomUUID()`, and every project that server created carries
 * one (`Kiln & Co.` ×10, `Stock Cupboard` ×2 on this machine). This module mints
 * the *same* shape for the projects that predate it, so a backfilled project and
 * a freshly created one are indistinguishable to the matcher. A name, a slug or
 * a directory basename would all collide across the copies of a project that
 * this repo makes constantly — `Shop backend` carries `projectIds:
 * ["ecommerce-example"]`, a hand-written id that reads as a name, and two
 * different project directories answer to it.
 *
 * ⚠️ This is **not** the process-ownership identity. That one is kind + pid +
 * session start time and lives in {@link ./runtimeRecord} — it answers "may I
 * signal this pid", which is a different question with a different failure mode.
 * The two must not be merged.
 *
 * ## The write is a backfill, not a modification
 *
 * A write to a user's project file on open is the kind of damage noticed a week
 * later, so the rules are narrow:
 *
 * - **Only ever adds `id`.** No other key is touched — `modified` is
 *   deliberately *not* bumped, because acquiring an identity is not a change to
 *   the design and a bumped timestamp is a spurious diff in every version
 *   control panel that shows one.
 * - **Idempotent by construction.** A project that already has a non-empty `id`
 *   is not written at all, so the second call opens the file and closes it.
 * - **Atomic.** Temp file plus rename, the same shape `ProjectStore` and
 *   `createProject` use, so a crash mid-write cannot leave a truncated project.
 *
 * @module noodl-mcp/backend/projectIdentity
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/** The one file this module reads or writes. */
export const PROJECT_FILE = 'nodegx.project.json';

export type ProjectIdOutcome =
  /** The file already carried a usable `id`; nothing was written. */
  | 'present'
  /** An `id` was minted and written. */
  | 'minted'
  /** No `id`, and none could be written. `reason` says why. */
  | 'unavailable';

export interface ProjectIdentity {
  id?: string;
  outcome: ProjectIdOutcome;
  /** Present only on `unavailable` — the sentence a tool result repeats. */
  reason?: string;
}

/** Mints the same shape `tools/createProject.ts` does. Kept in one place on purpose. */
export function mintProjectId(): string {
  return crypto.randomUUID();
}

function projectFilePath(projectDir: string): string {
  return path.join(projectDir, PROJECT_FILE);
}

/**
 * The project's id as it stands, without writing anything.
 *
 * An `id` that is not a non-empty string is treated as absent rather than
 * repaired: a project file with `id: null` is a project file something else got
 * wrong, and silently rewriting it is how a second bug hides the first.
 */
export function readProjectId(projectDir: string): string | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(projectFilePath(projectDir), 'utf-8'));
    const id = parsed?.id;
    return typeof id === 'string' && id.trim() ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The project's id, minting and persisting one if it has none.
 *
 * Returns `unavailable` — never throws — when the file is missing, unparseable
 * or unwritable. A provision must still be able to proceed for a project whose
 * identity cannot be established; what it must not do is pretend it reused
 * something. {@link explainReuse} turns that into the sentence the caller reads.
 */
export function ensureProjectId(projectDir: string): ProjectIdentity {
  const file = projectFilePath(projectDir);

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf-8');
  } catch {
    return {
      outcome: 'unavailable',
      reason: `there is no readable ${PROJECT_FILE} in ${projectDir}, so this project has no identity to bind a backend to`
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      outcome: 'unavailable',
      reason: `${PROJECT_FILE} is not valid JSON, so no project id could be read or written`
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { outcome: 'unavailable', reason: `${PROJECT_FILE} is not a JSON object` };
  }

  const existing = parsed.id;
  if (typeof existing === 'string' && existing.trim()) {
    return { id: existing, outcome: 'present' };
  }

  const id = mintProjectId();
  try {
    writeJsonAtomic(file, withIdAfterName(parsed, id));
  } catch (error) {
    return {
      // The id is still returned: it is correct for *this* call, and a provision
      // that stamps it onto the backend is better than one that stamps nothing.
      // The outcome says it did not persist, so the caller can say so too.
      id,
      outcome: 'unavailable',
      reason:
        `${PROJECT_FILE} could not be written (${error instanceof Error ? error.message : String(error)}), so this ` +
        'project will not be able to prove it owns the backend next time'
    };
  }
  return { id, outcome: 'minted' };
}

/**
 * The project object with `id` inserted directly after `name`.
 *
 * Position is cosmetic but not arbitrary: `createProject.ts`'s skeleton and
 * `project-v2.schema.json`'s property list both put `id` there, so a backfilled
 * file and a freshly created one diff to nothing but the value.
 */
function withIdAfterName(project: Record<string, unknown>, id: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let inserted = false;
  for (const [key, value] of Object.entries(project)) {
    if (key === 'id') continue; // absent-or-invalid by the time we get here
    out[key] = value;
    if (key === 'name' && !inserted) {
      out.id = id;
      inserted = true;
    }
  }
  if (!inserted) out.id = id;
  return out;
}

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
