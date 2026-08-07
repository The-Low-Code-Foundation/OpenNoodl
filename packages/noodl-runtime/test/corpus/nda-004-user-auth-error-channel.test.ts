/**
 * NDA-004 §2 / FINDINGS B-iv — the two user-and-auth nodes that live in this package.
 *
 * The other nine are in `noodl-viewer-react/tests/corpus/nda-004-user-auth-error-channel.test.ts`
 * and this file is their twin; the claim, the reasoning and the row set are the same one. The
 * split is forced rather than chosen: `setuserproperties.ts` references
 * `_noodl_cloud_runtime_version`, a build-time global declared in *this* package's typings, and
 * the viewer's ts-jest does not see them — so importing it there fails the whole suite to compile.
 * The standing rule it instantiates: a cross-package source compiled under another package's jest
 * is compiled with **that** package's options.
 *
 * The defect, in one sentence: these nodes have real `failure`/`error` ports — so the register's
 * `Fail?` column passes them — and sent their *diagnosis* to `editorConnection.sendWarning`, which
 * exists only on the canvas. Graph-observable and diagnostically mute, which are independent
 * failure modes and only one of them is machine-detectable.
 *
 * The rows test the **channel**, not the trigger. Whether a fetch of the logged-in user fails
 * needs a cloud backend to ask; what was broken is where the answer goes. Each row therefore calls
 * the node's own `setError` — the single funnel every failure path in these files routes through.
 *
 * The `clearWarnings` rows are the ones that would not have been written from the fix alone. The
 * bus's editor subscriber keys its warning by the raised **`code`** (`runtimeerror.ts:177-186`),
 * so a `clearWarning` still naming the old hand-written key clears nothing and the node keeps a
 * warning it can never shed — strictly worse than the defect being fixed. Raise and clear move
 * together, every time.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import NoodlRuntime = require('../../noodl-runtime');
import SetUserPropertiesModule = require('../../src/nodes/std-library/user/setuserproperties');
import UserModule = require('../../src/nodes/std-library/user/user');

/**
 * The User node's `initialize` calls `NoodlRuntime.Services.UserService.forScope(...)`, and
 * `Services.UserService` is **assigned by `noodl-viewer-react`**, not by this package —
 * `services.ts` only names the entry point and says so. Under this package's jest it is
 * `undefined`, so the node throws before it exists and every row reports "no node with id node",
 * which reads as a broken test rather than a missing collaborator.
 *
 * Four session events and a `current`, which is the whole of what `initialize` touches.
 */
const realUserService = (NoodlRuntime as { Services: { UserService?: unknown } }).Services.UserService;

beforeAll(() => {
  (NoodlRuntime as { Services: { UserService?: unknown } }).Services.UserService = {
    forScope: () => ({
      current: undefined,
      on: () => {
        /* loggedIn / sessionGained / loggedOut / sessionLost; nothing here emits them */
      }
    })
  };
});

afterAll(() => {
  (NoodlRuntime as { Services: { UserService?: unknown } }).Services.UserService = realUserService;
});

interface FailableInstance extends NodeInstance {
  _internal: { error?: string };
  setError(err: string): void;
  clearWarnings(): void;
}

const NODES: Array<{ label: string; module: unknown; type: string; code: string; legacyKey: string }> = [
  { label: 'User', module: UserModule, type: 'net.noodl.user.User', code: 'user/fetch-failed', legacyKey: 'user-warning' },
  {
    label: 'Set User Properties',
    module: SetUserPropertiesModule,
    type: 'net.noodl.user.SetUserProperties',
    code: 'user/set-properties-failed',
    legacyKey: 'user-set-warning'
  }
];

async function graphWith(module: unknown, type: string): Promise<CorpusGraph> {
  return createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters: {} }], connections: [] }]
    } as never
  });
}

describe.each(NODES)('NDA-004 §2 / B-iv: $label', ({ module, type, code, legacyKey }) => {
  test('the diagnosis reaches the runtime channel, not just the editor', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Could not reach the backend');
    await graph.settle(2);

    // The channel that exists in every runtime. Empty for both of these before the change.
    const raised = graph.errors.filter((e) => e.code === code);
    expect(raised).toHaveLength(1);
    expect(raised[0].message).toBe('Could not reach the backend');
    expect(raised[0].nodeId).toBe('node');
  });

  test('the graph surface still fires, and the Error output still carries the message', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Could not reach the backend');
    await graph.settle(2);

    // Never broken; pinned so that moving the channel cannot quietly cost it.
    expect(graph.signalsFor('node')).toContain('failure');
    expect(graph.node('node').hasOutput('failure')).toBe(true);
    expect(graph.node('node').hasOutput('error')).toBe(true);
    expect(graph.node('node').getOutput('error').value).toBe('Could not reach the backend');
  });

  test('the editor keeps exactly what it had — a global warning carrying the message', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Could not reach the backend');
    await graph.settle(2);

    const warnings = graph.editorConnection.warnings.filter((w) => w.nodeId === 'node');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].key).toBe(code);
    expect(warnings[0].message).toBe('Could not reach the backend');
  });

  test('clearWarnings clears the warning the raise actually filed', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    graph.node<FailableInstance>('node').setError('Could not reach the backend');
    await graph.settle(2);
    expect(graph.editorConnection.hasWarningFor('node')).toBe(true);

    graph.node<FailableInstance>('node').clearWarnings();
    await graph.settle(2);

    expect(graph.editorConnection.hasWarningFor('node')).toBe(false);
  });

  test('the legacy key is cleared too, for an editor session that predates this change', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(2);

    // What a running editor would already be holding, and what nothing else will ever remove.
    graph.editorConnection.sendWarning('/root', 'node', legacyKey, { message: 'stale' });

    graph.node<FailableInstance>('node').clearWarnings();
    await graph.settle(2);

    expect(graph.editorConnection.hasWarningFor('node')).toBe(false);
  });

  // ✅ Pinned control.
  test('(pinned control) booting raises nothing on its own', async () => {
    const graph = await graphWith(module, type);
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.editorConnection.hasWarningFor('node')).toBe(false);
  });
});
