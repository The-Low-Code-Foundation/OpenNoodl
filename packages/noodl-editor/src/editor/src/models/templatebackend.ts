/**
 * SBR-001 — a template that needs a backend gets one, at creation.
 *
 * 🔴 **THE DEFECT THIS CLOSES.** Pick the Site Builder template and finish the
 * wizard, and you landed in a project whose backend panel read "No backend
 * attached". The template ships `devOpen: false`, so every query the claim
 * screen makes was refused — a white void, measured 2026-08-28 (phase 77
 * finding 1). Nothing on the wizard path created, started or bound a backend;
 * the only surface that could is the Backend Services panel, which is exactly
 * the detour the template's audience does not know to take.
 *
 * ## What decides that a template needs one
 *
 * `templateNeedsBackend` (`EmbeddedTemplateProvider.ts`), which derives it from
 * what the template ships — a security policy, `/#__cloud__/` components —
 * carried to the wizard as `TemplateItem.needsBackend`. ⚠️ Not a hand-written
 * `requiresBackend:` field, for `lessonbackend.ts`'s reason: a second statement
 * of the same fact drifts on the first edit. A community row cannot say
 * (`communityapi.ts` has no column), arrives `undefined`, and is read as "no" —
 * a template that did not ask for a backend must not grow one.
 *
 * ## 🔴 What it deliberately does NOT do: START the backend
 *
 * `ensureLessonBackend` starts what it creates, because a lesson binds on
 * `EditorPage` with the project already open. This runs on the launcher,
 * *before* the route, and starting here would be worse than idle:
 *
 *  - `ProjectBackendLifecycle` already starts the open project's **bound**
 *    backend on every open, passing `--project-dir` so the template's
 *    `nodegx.security.json` is enforced (SB-015 — its own comment names "a
 *    person picking a template off the shelf" as the path it exists for), and
 *    it reaches `CloudFunctionDeployer.onBackendStarted` so the template's
 *    seven cloud functions are deployed.
 *  - A backend started *here* would be **adopted** by that reconcile instead —
 *    and the adopted path never deploys functions, so the claim screen's
 *    `claimSite` would be absent exactly when it is first needed.
 *  - `CloudFunctionDeployer.pushToBackend` exports `ProjectModel.instance`,
 *    which on the launcher is not the project being created — a deploy from
 *    here would push the wrong project's functions or none.
 *
 * So this module's whole job is the half that was missing: **create (owned) and
 * report the binding**. The caller binds through `setCloudServices` — which
 * raises `cloudServicesChanged` and reaches `PopupLayer`/`ToastLayer`, the
 * reason the split keeps this module plain-Node gradeable — and the route makes
 * `ProjectModel.instanceHasChanged` fire, which hands the rest to machinery
 * that already exists and is already specced.
 *
 * ⚠️ **Failure is advisory**, as it is for lessons: the project still opens,
 * and SBR-002 makes the screen say honestly that there is no backend. A wizard
 * that refused to finish because a backend would not create is a worse outcome
 * than a project with a visible gap.
 *
 * 🔴 **It never repoints a project that is already bound** — same rule as
 * `ensureLessonBackend`. A bound project keeps its backend.
 *
 * @module models/templatebackend
 */

import { findReusableBackend, type LocalBackendMeta } from './BackendServices/backendReuse';
import { backendNameForProject } from './AiAssistant/scoping/scope';

export type EnsureTemplateBackendResult =
  | { status: 'not-needed' }
  | { status: 'already-bound'; endpoint: string }
  | { status: 'attached'; backendId: string; endpoint: string; reused: boolean }
  | { status: 'failed'; reason: string };

export interface EnsureTemplateBackendInput {
  /**
   * `TemplateItem.needsBackend`, read from the chosen row. The derivation lives
   * with the provider; this module only obeys it. `undefined` (a community row,
   * which cannot say) is "no".
   */
  needsBackend: boolean | undefined;
  /** The ownership key. A project without one never reuses — it gets its own. */
  projectId: string | undefined;
  projectName?: string;
  /** `getCloudServices(project).endpoint` at the call site. Bound means bound. */
  boundEndpoint?: string;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

/**
 * Create (or adopt) the backend a template asked for, and REPORT the binding.
 *
 * The endpoint is built from the port `backend:create` allocated and recorded
 * in the backend's own config — not from nodegx-backend's default 8577, which
 * is a default and not a promise. If the child ever comes up on a different
 * port, `backend:status` is the honest readout, and the surfaces that show one
 * already read it.
 */
export async function ensureTemplateBackend(input: EnsureTemplateBackendInput): Promise<EnsureTemplateBackendResult> {
  const { needsBackend, projectId, projectName, boundEndpoint, invoke } = input;

  if (needsBackend !== true) return { status: 'not-needed' };
  if (boundEndpoint) return { status: 'already-bound', endpoint: boundEndpoint };

  try {
    // AAQ-002/F4's naming rule, unchanged: the Backend Services list is
    // machine-wide, and the name is what tells a human whose backend this is.
    const name = backendNameForProject(projectName);
    const existing = ((await invoke('backend:list')) as LocalBackendMeta[] | undefined) ?? [];

    // The ownership rule has one definition and this is not a second one.
    const reusable = findReusableBackend(existing, name, projectId);
    const meta = reusable ?? ((await invoke('backend:create', name, { projectId })) as LocalBackendMeta | undefined);
    if (!meta?.id) return { status: 'failed', reason: 'the backend was not created' };
    if (typeof meta.port !== 'number') {
      return { status: 'failed', reason: 'the backend was created without a port' };
    }

    return {
      status: 'attached',
      backendId: meta.id,
      endpoint: `http://localhost:${meta.port}`,
      reused: Boolean(reusable)
    };
  } catch (e) {
    return { status: 'failed', reason: e instanceof Error ? e.message : String(e) };
  }
}
