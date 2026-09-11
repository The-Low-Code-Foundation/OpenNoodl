/**
 * SB-015 — the one place the editor asks the main process to start a backend,
 * and the reason it is one place.
 *
 * ## What was broken
 *
 * A project can ship a security policy (`nodegx.security.json`, SB-015) and the
 * backend applies it only if it is told which project it is being started for —
 * `--project-dir`, read at startup step 1.4, before `SecurityState` exists. The
 * MCP spawner passed it (`noodl-mcp/src/backend/provision.ts`); the **editor's**
 * did not, and the editor is the path a person picking Site Builder off the
 * shelf is actually on. So the template's whole product — *what a stranger
 * cannot see* — was provisioned onto `defaultSecurityConfig()`.
 *
 * ## Why a leaf module rather than four edits
 *
 * `backend:start` had **four** call sites, not the two SB-015 §7 predicted:
 * `provisionBackend` (the AI plan's spawner), `ProjectBackendLifecycle`
 * (auto-start on project open), `useLocalBackends` (the panel's Start button)
 * and `models/lessonbackend`. Threading a field through four call sites leaves a
 * gate with a hole shaped like the defect — this phase's most repeated finding —
 * because the fifth call site is written by somebody who never read this note.
 *
 * Two things close that, and they close it in different ways:
 *
 *  1. **`projectDir` is a required positional parameter here.** It may be
 *     `undefined` — a lesson runner or a test legitimately has no project — but
 *     it cannot be *omitted*, so a new call site fails to compile until its
 *     author has decided. A field on the options bag would have defaulted to
 *     silence, which is the failure mode this module exists to end.
 *  2. **A census spec** (`tests-unit/sb-015/editor-spawner-passes-project-dir.test.ts`)
 *     asserts that no renderer module invokes `'backend:start'` except this one.
 *     The compiler cannot see a call that bypasses the helper; the census can.
 *
 * ⚠️ This module deliberately imports **nothing from the editor**, for the same
 * reason `backendReuse` does: `models/lessonbackend` is exercised from a
 * plain-Node runner (TUT-005) and reaching `ProjectModel` from here would fail
 * that suite *to run*. Resolving the open project stays at the call sites, which
 * is where a project is actually known.
 *
 * @module BackendServices/startLocalBackend
 */

/** The IPC shape every caller already has, narrowed to what this needs. */
export type BackendInvoke = (channel: string, ...args: unknown[]) => Promise<unknown>;

/**
 * The options `backend:start` accepts, as the renderer sends them.
 *
 * `projectDir` is not here on purpose — see the module note. It is a parameter,
 * so it cannot be forgotten.
 */
export interface StartLocalBackendOptions {
  /** Opt in to non-persisting in-memory mode when native SQLite is unavailable. */
  ephemeral?: boolean;
}

/** What the main process sends over `backend:start`, as this module builds it. */
export interface BackendStartPayload {
  ephemeral?: boolean;
  /**
   * The **project** directory — not the backend's data directory. The service
   * reads `nodegx.security.json` from it at startup and installs it as its own
   * `security.json`, but only when it has none yet. Absent for a caller with no
   * project, and inert for a project that ships no policy (today, all but one).
   */
  projectDir?: string;
}

/**
 * Build the payload for `backend:start`.
 *
 * Split out from {@link startLocalBackend} so the mapping can be graded without
 * an IPC channel: the property under test is that a stated project directory
 * survives into the payload and an absent one leaves no key behind, and a
 * `projectDir: undefined` sent over Electron IPC is not the same value the main
 * process's `options.projectDir` check reads.
 */
export function backendStartPayload(
  projectDir: string | undefined,
  options: StartLocalBackendOptions = {}
): BackendStartPayload {
  const payload: BackendStartPayload = {};
  if (options.ephemeral === true) payload.ephemeral = true;
  const trimmed = typeof projectDir === 'string' ? projectDir.trim() : '';
  if (trimmed) payload.projectDir = trimmed;
  return payload;
}

/**
 * Ask the main process to start a local backend for `projectDir`.
 *
 * @param invoke     the caller's IPC invoker — injected rather than imported so
 *                   this module stays reachable from a plain-Node runner.
 * @param backendId  the backend to start.
 * @param projectDir the open project's directory, or `undefined` when the
 *                   caller genuinely has no project. **Required**: see the
 *                   module note for why this is not an options field.
 */
export function startLocalBackend<T = unknown>(
  invoke: BackendInvoke,
  backendId: string,
  projectDir: string | undefined,
  options: StartLocalBackendOptions = {}
): Promise<T> {
  return invoke('backend:start', backendId, backendStartPayload(projectDir, options)) as Promise<T>;
}
