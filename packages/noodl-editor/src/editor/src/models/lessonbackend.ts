/**
 * A lesson that grades against the database gets a database, without the learner
 * going looking for one.
 *
 * 🔴 **THE DEFECT THIS CLOSES.** `log-a-thing` grades steps against the built-in
 * database (`collectionExists`, `hasColumns`, `rowCountAtLeast`). Nothing bound a
 * backend to an installed lesson, and `Backend Services` — the only surface that
 * can create or bind one — is registered `isDisabled: isLesson === true`. So the
 * first actionable step of a shipping tutorial was unreachable: grading answered
 * *"this project is not bound to a backend, so there is no built-in database to
 * read"*, and the panel that would have fixed it was greyed out. Measured
 * 2026-08-21 on a freshly installed copy.
 *
 * ## What decides that a lesson needs one
 *
 * `lessonObservesDatabase`, which reads the lesson's **own grading conditions**.
 * ⚠️ **Not a hand-written `requiresBackend:` field**, and the reason is the one
 * `lessonprotection.ts` already records for protected nodes: a second statement
 * of the same fact drifts on the first edit, and here it would drift into a
 * lesson that grades against a database it was never given. The conditions are
 * the fact; this reads them.
 *
 * ## What it deliberately does NOT do
 *
 * 🔴 **It does not create the collections.** `provisionBackend` does, because an
 * AI plan that says "an app with a Posts collection" has been asked for one. A
 * lesson is the opposite: `log-a-thing` step 1 *is* "make somewhere to put them",
 * and a starter that ships `LogEntries` pre-made makes that step already complete
 * before the learner arrives — the F2 "already complete in the starter" defect
 * `lessonbundleverify` exists to catch, arriving through the one blind spot it
 * admits to (it reports database steps `not-checked`). The backend is plumbing
 * and we supply it; the collection is the lesson and the learner makes it.
 *
 * 🔴 **It never repoints a project that is already bound.** Same rule as
 * `endpointRefusal`: a learner who has pointed a lesson at their own backend
 * keeps it, and a reinstall that silently moved their data would be worse than
 * the state it was called to repair.
 *
 * ⚠️ **Failure is advisory.** If provisioning fails the lesson still opens and
 * grading still says, honestly, that it could not read a database. A lesson that
 * refused to open because a backend would not start would be a worse outcome
 * than one step that cannot be ticked.
 *
 * @module models/lessonbackend
 */

import { findReusableBackend, type LocalBackendMeta } from './BackendServices/backendReuse';
import { lessonObservesDatabase } from './lessondatabase';
import type { LessonManifest } from './lessonformat';

export type EnsureLessonBackendResult =
  | { status: 'not-needed' }
  | { status: 'already-bound'; endpoint: string }
  | { status: 'provisioned'; backendId: string; endpoint: string; reused: boolean }
  | { status: 'failed'; reason: string };

export interface EnsureLessonBackendInput {
  manifest: LessonManifest | undefined;
  /** The ownership key. A project without one never reuses — it gets its own. */
  projectId: string | undefined;
  projectName?: string;
  /** `getCloudServices(project).endpoint` at the call site. Bound means bound. */
  boundEndpoint?: string;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  /** Injected so a spec does not wait 20 real seconds for a backend to answer. */
  waitForRunning?: (id: string) => Promise<{ port: number }>;
}

/** How a lesson's backend is named. One per lesson, and it says whose it is. */
export function lessonBackendName(projectName: string | undefined, manifest: LessonManifest | undefined): string {
  const title = (manifest?.title || projectName || 'Lesson').toString().trim();
  return `${title} database`;
}

/**
 * Decide and perform the plumbing, and REPORT the binding rather than writing it.
 *
 * ⚠️ **The caller applies the binding**, through `setCloudServices`, because that
 * function reaches `PopupLayer`/`ToastLayer` and this module has to stay
 * reachable from a plain-Node runner — the boundary `jest.config.js` enforces
 * deliberately. The split also means the undo/notify semantics stay in one place
 * rather than being half-stated here.
 */
export async function ensureLessonBackend(input: EnsureLessonBackendInput): Promise<EnsureLessonBackendResult> {
  const { manifest, projectId, projectName, boundEndpoint, invoke } = input;

  if (!lessonObservesDatabase(manifest)) return { status: 'not-needed' };
  if (boundEndpoint) return { status: 'already-bound', endpoint: boundEndpoint };

  try {
    const name = lessonBackendName(projectName, manifest);
    const existing = ((await invoke('backend:list')) as LocalBackendMeta[] | undefined) ?? [];

    // The ownership rule has one definition and this is not a second one.
    const reusable = findReusableBackend(existing, name, projectId);
    const meta = reusable ?? ((await invoke('backend:create', name, { projectId })) as LocalBackendMeta | undefined);
    if (!meta?.id) return { status: 'failed', reason: 'the backend was not created' };

    await invoke('backend:start', meta.id, {});
    const { port } = input.waitForRunning
      ? await input.waitForRunning(meta.id)
      : await pollUntilRunning(meta.id, invoke);

    return {
      status: 'provisioned',
      backendId: meta.id,
      endpoint: `http://localhost:${port}`,
      reused: Boolean(reusable)
    };
  } catch (e) {
    return { status: 'failed', reason: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Wait for the backend to answer with a port.
 *
 * ⚠️ The port recorded is the one `backend:status` reports, never the one we
 * asked for — the same rule both other spawners follow, because the child picks
 * its own when the requested one is taken.
 */
async function pollUntilRunning(
  id: string,
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>,
  timeoutMs = 20_000,
  intervalMs = 250
): Promise<{ port: number }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = (await invoke('backend:status', id)) as { running?: boolean; port?: number } | undefined;
    if (status?.running === true && typeof status.port === 'number') return { port: status.port };
    if (Date.now() >= deadline) throw new Error(`the backend did not start within ${timeoutMs / 1000}s`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
