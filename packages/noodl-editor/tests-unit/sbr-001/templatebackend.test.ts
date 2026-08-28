/**
 * SBR-001 — the wizard attaches the backend (phase 77 finding 1).
 *
 * 🔴 **The defect these grade.** Pick the Site Builder template, finish the
 * wizard, and you landed in a project with no backend: the template ships
 * `devOpen: false`, so every query was refused and the claim screen was a
 * white void. `ensureTemplateBackend` is the missing half — create (owned) and
 * report the binding.
 *
 * The sharpest specs here assert what is **not** done:
 *
 *  - No `backend:start` — `ProjectBackendLifecycle` starts the bound backend on
 *    open with the project dir (policy) and deploys the cloud functions. A
 *    start from the wizard would be *adopted* by that reconcile, whose adopted
 *    path never deploys — the seven `/#__cloud__/` functions would be absent
 *    exactly when the claim screen first needs them.
 *  - No backend at all for a template that did not ask (AC5's hello-world
 *    control, and AC6's community row, whose wire has no column and arrives
 *    `undefined`).
 */

import { ensureTemplateBackend } from '../../src/editor/src/models/templatebackend';
import { backendNameForProject } from '../../src/editor/src/models/AiAssistant/scoping/scope';

// ─── Fakes ──────────────────────────────────────────────────────────────────

function recordingIpc(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ channel: string; args: unknown[] }> = [];
  const invoke = async (channel: string, ...args: unknown[]) => {
    calls.push({ channel, args });
    if (channel in overrides) return overrides[channel];
    if (channel === 'backend:list') return [];
    if (channel === 'backend:create') return { id: 'backend_new', name: String(args[0]), port: 8611 };
    return undefined;
  };
  return { calls, invoke, channels: () => calls.map((c) => c.channel) };
}

// ─── Specs ──────────────────────────────────────────────────────────────────

describe('SBR-001 ensureTemplateBackend', () => {
  it('does nothing for a template that did not ask for a backend (AC5, the hello-world control)', async () => {
    const ipc = recordingIpc();
    const outcome = await ensureTemplateBackend({ needsBackend: false, projectId: 'proj-1', invoke: ipc.invoke });

    expect(outcome.status).toBe('not-needed');
    expect(ipc.channels()).toEqual([]);
  });

  it('reads undefined as "no" — a community row has no column to say (AC6)', async () => {
    const ipc = recordingIpc();
    const outcome = await ensureTemplateBackend({ needsBackend: undefined, projectId: 'proj-1', invoke: ipc.invoke });

    expect(outcome.status).toBe('not-needed');
    expect(ipc.channels()).toEqual([]);
  });

  it('🔴 never repoints a project that is already bound', async () => {
    const ipc = recordingIpc();
    const outcome = await ensureTemplateBackend({
      needsBackend: true,
      projectId: 'proj-1',
      boundEndpoint: 'http://localhost:9000',
      invoke: ipc.invoke
    });

    expect(outcome).toEqual({ status: 'already-bound', endpoint: 'http://localhost:9000' });
    expect(ipc.channels()).toEqual([]);
  });

  it('creates an OWNED backend, named for the project, and reports the binding (AC2)', async () => {
    const ipc = recordingIpc();
    const outcome = await ensureTemplateBackend({
      needsBackend: true,
      projectId: 'proj-1',
      projectName: 'My Site',
      invoke: ipc.invoke
    });

    expect(ipc.channels()).toEqual(['backend:list', 'backend:create']);
    // The ownership key is what `findReusableBackend` matches on, and the panel's
    // own createBackend omits it — this path must not.
    expect(ipc.calls[1].args).toEqual(['My Site backend', { projectId: 'proj-1' }]);
    // The endpoint is the port `backend:create` allocated, never a hard-coded 8577.
    expect(outcome).toEqual({
      status: 'attached',
      backendId: 'backend_new',
      endpoint: 'http://localhost:8611',
      reused: false
    });
  });

  it('🔴 does NOT start the backend — the lifecycle starts a BOUND backend on open, and only a lifecycle start deploys the cloud functions', async () => {
    const ipc = recordingIpc();
    await ensureTemplateBackend({ needsBackend: true, projectId: 'proj-1', projectName: 'My Site', invoke: ipc.invoke });

    // The absence is asserted beside the calls that DID fire — an empty call
    // list would make the two `not`s below true for the wrong reason.
    expect(ipc.channels()).toEqual(['backend:list', 'backend:create']);
    expect(ipc.channels()).not.toContain('backend:start');
    expect(ipc.channels()).not.toContain('backend:status');
  });

  it('reuses a backend this project already owns, and creates nothing (AC7)', async () => {
    const name = backendNameForProject('My Site');
    const ipc = recordingIpc({
      'backend:list': [{ id: 'backend_owned', name, port: 8622, projectIds: ['proj-1'] }]
    });

    const outcome = await ensureTemplateBackend({
      needsBackend: true,
      projectId: 'proj-1',
      projectName: 'My Site',
      invoke: ipc.invoke
    });

    expect(ipc.channels()).toEqual(['backend:list']);
    expect(outcome).toEqual({
      status: 'attached',
      backendId: 'backend_owned',
      endpoint: 'http://localhost:8622',
      reused: true
    });
  });

  it('🔴 does NOT adopt a same-named backend owned by nobody — the AAQ-002/F4 rule, unchanged (AC7)', async () => {
    const name = backendNameForProject('My Site');
    const ipc = recordingIpc({
      'backend:list': [{ id: 'backend_legacy', name, port: 8633, projectIds: [] }]
    });

    const outcome = await ensureTemplateBackend({
      needsBackend: true,
      projectId: 'proj-1',
      projectName: 'My Site',
      invoke: ipc.invoke
    });

    expect(ipc.channels()).toEqual(['backend:list', 'backend:create']);
    expect(outcome).toMatchObject({ status: 'attached', backendId: 'backend_new', reused: false });
  });

  it('reports a create that answered nothing as failed, without throwing', async () => {
    const ipc = recordingIpc({ 'backend:create': undefined });
    const outcome = await ensureTemplateBackend({
      needsBackend: true,
      projectId: 'proj-1',
      projectName: 'My Site',
      invoke: ipc.invoke
    });

    expect(outcome).toEqual({ status: 'failed', reason: 'the backend was not created' });
  });

  it('captures a thrown IPC failure as advisory — the project must still open', async () => {
    const invoke = async (channel: string) => {
      if (channel === 'backend:list') throw new Error('no main process');
      return undefined;
    };
    const outcome = await ensureTemplateBackend({
      needsBackend: true,
      projectId: 'proj-1',
      projectName: 'My Site',
      invoke
    });

    expect(outcome).toEqual({ status: 'failed', reason: 'no main process' });
  });
});
