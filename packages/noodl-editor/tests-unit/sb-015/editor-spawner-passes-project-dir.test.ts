/**
 * SB-015 — the second spawner: does a backend the **editor** starts get told
 * which project it is starting for?
 *
 * ## What this grades, and why it is two different kinds of assertion
 *
 * `noodl-mcp`'s spawner has always passed `--project-dir`; the editor's never
 * did, so a project shipping `nodegx.security.json` was provisioned onto
 * `defaultSecurityConfig()` on the one path a person picking a template off the
 * shelf is actually on. Fixing that is a five-link chain — renderer call site →
 * `backend:start` → `BackendManager.startBackend` → `ServiceSupervisor` config →
 * argv — and no single runner can see all of it:
 *
 *  - the **argv** end is graded in `tests-main/local-backend/`, where the main
 *    process is reachable;
 *  - the **renderer** end is graded here;
 *  - and the link neither can see — *is every call site on the helper at all?* —
 *    is graded by a **census over the source**, below.
 *
 * 🔴 **The census is the load-bearing one.** SB-015 §7 predicted two call sites;
 * there are four. A behavioural spec over the three call sites a plain-Node
 * runner can reach would have been green with the fourth still broken, and
 * "a gate with a hole shaped like the defect" is this phase's most repeated
 * finding. So the invariant asserted is not *these callers pass a project* but
 * **no renderer module invokes `backend:start` except the helper** — which is a
 * property of the whole tree, and the only form that survives a fifth call site
 * written next year.
 *
 * ⚠️ A census over source text is exactly the instrument this codebase has
 * recorded as passing on dead code, so it is deliberately not carrying the
 * behavioural claim: it says *who calls*, and the specs above it say *what the
 * call contains*. Its own known-firing arm is the helper itself — the one file
 * the scan must find the string in, so a scan that silently matched nothing
 * cannot read as a pass.
 */
import * as fs from 'fs';
import * as path from 'path';

import { ensureLessonBackend } from '@noodl-models/lessonbackend';
import {
  backendStartPayload,
  startLocalBackend
} from '@noodl-models/BackendServices/startLocalBackend';
import type { LessonManifest } from '@noodl-models/lessonformat';

const RENDERER_ROOT = path.join(__dirname, '..', '..', 'src', 'editor', 'src');
const HELPER = path.join(RENDERER_ROOT, 'models', 'BackendServices', 'startLocalBackend.ts');

/** Every `.ts`/`.tsx` under the renderer tree. */
function rendererSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) rendererSources(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Files naming `backend:start` in **live code** — block comments removed first.
 *
 * 🔴 The strip is why this is not a quote-matching regex. Matching
 * `['"`]backend:start['"`]` reads as tighter and is looser: it lets a template
 * literal through in one direction and, in the other, counts
 * `ProjectBackendLifecycle`'s module note — which names the channel in prose
 * inside backticks, and did in fact redden this spec when it was written that
 * way. A census maintained by exception is one that stops being read.
 *
 * ⚠️ Line comments are deliberately NOT stripped, so a `// backend:start`
 * mention will fire this. That is the safe direction: a census that cries wolf
 * is fixed by rewording a comment, and a census that misses a call is the exact
 * defect it exists to catch. The known-firing arm below is what stops the strip
 * from quietly eating the one match that must be there.
 */
function filesInvokingBackendStart(): string[] {
  return rendererSources(RENDERER_ROOT).filter((file) =>
    /backend:start/.test(fs.readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, ''))
  );
}

// ─── The payload ────────────────────────────────────────────────────────────

describe('SB-015 backendStartPayload', () => {
  it('carries the project directory the caller states', () => {
    expect(backendStartPayload('/projects/my-site')).toEqual({ projectDir: '/projects/my-site' });
  });

  it('keeps ephemeral beside it rather than instead of it', () => {
    expect(backendStartPayload('/projects/my-site', { ephemeral: true })).toEqual({
      ephemeral: true,
      projectDir: '/projects/my-site'
    });
  });

  it('🔴 leaves NO projectDir key when there is no project', () => {
    // Not `{ projectDir: undefined }`. That value does not survive Electron's
    // structured clone the way the main process's `typeof === 'string'` check
    // reads it, and a key that is present-but-empty is the shape that makes a
    // "did the renderer send one?" question unanswerable at the other end.
    expect(backendStartPayload(undefined)).toEqual({});
    expect(Object.keys(backendStartPayload(undefined))).not.toContain('projectDir');
  });

  it('treats a blank string as no project rather than as a directory called ""', () => {
    expect(backendStartPayload('   ')).toEqual({});
  });

  it('sends no ephemeral key when it was not asked for', () => {
    expect(Object.keys(backendStartPayload('/p', {}))).toEqual(['projectDir']);
  });
});

describe('SB-015 startLocalBackend', () => {
  it('invokes backend:start with the id and the payload, in that order', async () => {
    const calls: unknown[][] = [];
    const invoke = async (...args: unknown[]) => {
      calls.push(args);
      return { running: true };
    };
    await startLocalBackend(invoke, 'backend_7', '/projects/site');
    expect(calls).toEqual([['backend:start', 'backend_7', { projectDir: '/projects/site' }]]);
  });

  it('returns what the main process answered', async () => {
    const invoke = async () => ({ running: true, port: 8601 });
    await expect(startLocalBackend(invoke, 'b', '/p')).resolves.toEqual({ running: true, port: 8601 });
  });
});

// ─── The one call site a plain-Node runner can drive end to end ─────────────

describe('SB-015 ensureLessonBackend threads the project directory', () => {
  const DB_LESSON = {
    title: 'Log a thing',
    steps: [{ title: 'Make somewhere', completeWhen: [{ collection: 'LogEntries', collectionExists: true }] }]
  } as unknown as LessonManifest;

  function recordingIpc() {
    const calls: Array<{ channel: string; args: unknown[] }> = [];
    const invoke = async (channel: string, ...args: unknown[]) => {
      calls.push({ channel, args });
      if (channel === 'backend:list') return [];
      if (channel === 'backend:create') return { id: 'backend_new', name: String(args[0]), port: 8600 };
      if (channel === 'backend:status') return { running: true, port: 8600 };
      return undefined;
    };
    return { invoke, calls };
  }

  it('passes it through to backend:start', async () => {
    const ipc = recordingIpc();
    const result = await ensureLessonBackend({
      manifest: DB_LESSON,
      projectId: 'proj-1',
      projectName: 'Log a thing',
      projectDir: '/projects/lesson-1',
      invoke: ipc.invoke,
      waitForRunning: async () => ({ port: 8600 })
    });
    expect(result.status).toBe('provisioned');
    const start = ipc.calls.find((c) => c.channel === 'backend:start');
    expect(start!.args[1]).toEqual({ projectDir: '/projects/lesson-1' });
  });

  it('still starts one when the caller has no directory (known-firing control)', async () => {
    // Without this, "the directory arrived" is consistent with a helper that
    // refuses to start a backend at all when there is no project — which would
    // break every lesson rather than fix any policy.
    const ipc = recordingIpc();
    const result = await ensureLessonBackend({
      manifest: DB_LESSON,
      projectId: 'proj-1',
      projectName: 'Log a thing',
      invoke: ipc.invoke,
      waitForRunning: async () => ({ port: 8600 })
    });
    expect(result.status).toBe('provisioned');
    expect(ipc.calls.find((c) => c.channel === 'backend:start')!.args[1]).toEqual({});
  });
});

// ─── The census ─────────────────────────────────────────────────────────────

describe('SB-015 — every renderer spawner goes through the helper', () => {
  it('finds the helper itself (the scan is known-firing)', () => {
    // A scan that matched nothing would satisfy the next spec silently, and
    // "nothing matched" and "nothing violates" are the same reading from the
    // outside. This is the arm that separates them.
    expect(filesInvokingBackendStart()).toContain(HELPER);
  });

  it('🔴 finds it ONLY there', () => {
    const others = filesInvokingBackendStart().filter((f) => f !== HELPER);
    expect(others.map((f) => path.relative(RENDERER_ROOT, f))).toEqual([]);
  });

  it('the helper cannot be called without stating a project (compile-time half)', () => {
    // `projectDir` is a required positional parameter, so a new call site that
    // has not thought about it does not compile. That is not observable at run
    // time — what is observable is its arity, which is what pins the signature
    // against a well-meaning refactor into an optional options field.
    expect(startLocalBackend.length).toBeGreaterThanOrEqual(3);
  });
});
