/**
 * TUT-005 — a lesson that grades against the database gets a database.
 *
 * 🔴 **The defect these grade.** `log-a-thing` grades steps against the built-in
 * database, nothing bound a backend to an installed lesson, and `Backend
 * Services` — the only surface that can create or bind one — was disabled for
 * every lesson. The tutorial's first actionable step was impossible to finish.
 *
 * The sharpest test here is the one that asserts something is **not** done:
 * provisioning must not create the collections. `log-a-thing` step 1 *is* "make
 * somewhere to put them", so a starter that ships `LogEntries` pre-made makes
 * that step already-complete before the learner arrives — and it would arrive
 * through `lessonbundleverify`'s one admitted blind spot, since it reports
 * database steps `not-checked`. A green suite there would not have caught it.
 */

import { ensureLessonBackend, lessonBackendName } from '../../src/editor/src/models/lessonbackend';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';

// ─── Fakes ──────────────────────────────────────────────────────────────────

function recordingIpc(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ channel: string; args: unknown[] }> = [];
  const invoke = async (channel: string, ...args: unknown[]) => {
    calls.push({ channel, args });
    if (channel in overrides) return overrides[channel];
    if (channel === 'backend:list') return [];
    if (channel === 'backend:create') return { id: 'backend_new', name: String(args[0]), port: 8600 };
    if (channel === 'backend:status') return { running: true, port: 8600 };
    return undefined;
  };
  return { invoke, calls, channels: () => calls.map((c) => c.channel) };
}

const DB_LESSON = {
  title: 'Log a thing',
  steps: [
    { title: 'Intro', completeWhen: [] },
    { title: 'Make somewhere to put them', completeWhen: [{ collection: 'LogEntries', collectionExists: true }] }
  ]
} as unknown as LessonManifest;

const GRAPH_LESSON = {
  title: 'State on a page',
  steps: [{ title: 'Wire it', completeWhen: [{ node: '/Pages/Home:#Label', hasType: 'Text' }] }]
} as unknown as LessonManifest;

// ─── Specs ──────────────────────────────────────────────────────────────────

describe('TUT-005 ensureLessonBackend', () => {
  it('does nothing for a lesson that never grades against the database', async () => {
    const ipc = recordingIpc();
    const outcome = await ensureLessonBackend({ manifest: GRAPH_LESSON, projectId: 'proj-1', invoke: ipc.invoke });

    expect(outcome.status).toBe('not-needed');
    // The point of the guard: no HTTP traffic and no backend for the majority of lessons.
    expect(ipc.channels()).toEqual([]);
  });

  it('creates, starts and binds a backend for a database lesson', async () => {
    const ipc = recordingIpc();

    const outcome = await ensureLessonBackend({ manifest: DB_LESSON, projectId: 'proj-1', invoke: ipc.invoke });

    expect(ipc.channels()).toEqual(['backend:list', 'backend:create', 'backend:start', 'backend:status']);
    // The endpoint is the port the backend REPORTED, never the one we asked for.
    expect(outcome).toEqual({
      status: 'provisioned',
      backendId: 'backend_new',
      endpoint: 'http://localhost:8600',
      reused: false
    });
  });

  it('🔴 does NOT create the collections — that is the lesson, not the plumbing', async () => {
    const ipc = recordingIpc();

    await ensureLessonBackend({ manifest: DB_LESSON, projectId: 'proj-1', invoke: ipc.invoke });

    // If this ever fails, `log-a-thing` step 1 is already complete when the
    // learner opens it, and lessonbundleverify reports database steps
    // `not-checked`, so nothing else in the suite would say so.
    expect(ipc.channels()).not.toContain('backend:createTable');
  });

  it('never repoints a project that is already bound', async () => {
    const ipc = recordingIpc();

    const outcome = await ensureLessonBackend({
      manifest: DB_LESSON,
      projectId: 'proj-1',
      boundEndpoint: 'http://localhost:9999',
      invoke: ipc.invoke
    });

    expect(outcome).toEqual({ status: 'already-bound', endpoint: 'http://localhost:9999' });
    // Nothing was asked of the backend manager at all — the binding is untouched.
    expect(ipc.channels()).toEqual([]);
  });

  it('adopts a backend this project already owns instead of making a second', async () => {
    const ipc = recordingIpc({
      'backend:list': [
        { id: 'backend_owned', name: lessonBackendName(undefined, DB_LESSON), port: 8601, projectIds: ['proj-1'] }
      ],
      'backend:status': { running: true, port: 8601 }
    });

    const outcome = await ensureLessonBackend({ manifest: DB_LESSON, projectId: 'proj-1', invoke: ipc.invoke });

    expect(outcome).toEqual({
      status: 'provisioned',
      backendId: 'backend_owned',
      endpoint: 'http://localhost:8601',
      reused: true
    });
    expect(ipc.channels()).not.toContain('backend:create');
  });

  it('reports a failure rather than throwing, so the lesson still opens', async () => {
    const ipc = recordingIpc({ 'backend:create': undefined });

    const outcome = await ensureLessonBackend({ manifest: DB_LESSON, projectId: 'proj-1', invoke: ipc.invoke });

    expect(outcome.status).toBe('failed');
  });
});
