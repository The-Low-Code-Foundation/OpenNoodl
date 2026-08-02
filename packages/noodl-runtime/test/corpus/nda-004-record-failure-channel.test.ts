/**
 * NDA-004 §2 — the Record family's failures leave the editor.
 *
 * These nodes were the odd case in the audit: the *graph* half was always right. `error` and
 * `failure` are real ports on every Record CRUD node and they fire wherever the node runs. What
 * was wrong was the **diagnosis**. `dbmodelcrudbase.setError` built a warning by hand and posted
 * it to `editorConnection.sendWarning`, which is precisely the pattern the Failure Contract names
 * as the defect:
 *
 * > `context.editorConnection.sendWarning` violates every clause: it exists only in the editor, so
 * > the diagnostics an author relied on during development vanish exactly when the app ships.
 *
 * So a Record node that could not store told you why on the canvas and told a deployed app
 * nothing — no `On App Error`, no console line, nothing in a cloud request log. `setError` now
 * raises on the bus, and the editor keeps exactly what it had, because
 * `createEditorWarningSubscriber` forwards to `sendWarning` with the identical
 * `{ showGlobally: true, message }` payload this used to construct itself.
 *
 * ## The clear had to move with the raise
 *
 * The bus's editor subscriber keys its warning by the raised **`code`**, not by a key the call
 * site picks. The moment `setError` raises, the editor's warning is filed under
 * `record/storage-op-failed` — and a `clearWarning` still naming `'storage-op-warning'` would
 * clear nothing at all, leaving every Record node holding a warning it could never shed. That is
 * why the two are one change and why the last row here exists.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import SetDbModelProperties = require('../../src/nodes/std-library/data/setdbmodelpropertiesnode');

/** Fires the `Do` port. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

interface TriggerInstance extends NodeInstance {
  go(): void;
}

/**
 * One Set Record Properties node with **no class name**, which is the cheapest way to reach
 * `checkWarningsBeforeCloudOp`'s `setError` without standing up a cloud backend.
 */
async function graphWithRecordNode(parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, SetDbModelProperties as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'record', type: 'SetDbModelProperties', parameters }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'record', targetPort: 'store' }]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** Press `Do` and settle. */
async function press(graph: CorpusGraph): Promise<void> {
  graph.node<TriggerInstance>('trigger').go();
  await graph.settle(4);
}

describe('NDA-004 §2: a Record failure reaches the runtime channel', () => {
  test('the miss is raised on the bus, not only posted to the editor', async () => {
    const graph = await graphWithRecordNode();
    await press(graph);

    // The row in one line: before this, `graph.errors` was empty here and the only trace of the
    // failure was an editor-only warning. A deployed app, a cloud function and an exported build
    // all saw nothing whatsoever.
    const raised = graph.errors.filter((e) => e.code === 'record/storage-op-failed');
    expect(raised.length).toBe(1);
    expect(raised[0].message).toBe('No class name specified');
  });

  test('the raise carries the provenance the runtime fills in, not the call site', async () => {
    const graph = await graphWithRecordNode();
    await press(graph);

    const raised = graph.errors.filter((e) => e.code === 'record/storage-op-failed')[0];
    // `nodeId`/`componentName`/`nodeType` are stamped by `raiseRuntimeError` itself, which is why
    // call sites stay one line and cannot lie about where an error came from. `nodeType` is also
    // what gives a subscriber per-node granularity despite the family sharing one code.
    expect(raised.nodeId).toBe('record');
    expect(raised.componentName).toBe('/root');
    expect(raised.nodeType).toBe('SetDbModelProperties');
  });

  test('the graph ports still fire exactly as they did', async () => {
    const graph = await graphWithRecordNode();
    await press(graph);

    // This half was never broken, and the change must not have touched it. `failure`/`error` are
    // the reason this node was not on the register's failure-mute list in the first place.
    expect(graph.node('record').getOutput('error').value).toBe('No class name specified');
    // ⚠️ ERG-001 §4. This read `.not.toContain('stored')`, which passes **vacuously** the moment
    // the port stops existing — and `stored` was renamed `done` by this task, so the negative
    // form would have gone on being green while saying nothing. The exact array is the assertion
    // that stays honest: `Failure` and only `Failure`, then the universal `Completed`.
    expect(graph.signalsFor('record')).toEqual(['failure', 'completed']);
    expect(graph.node('record').hasOutput('stored')).toBe(false);
  });

  test('the editor still sees the warning it always saw', async () => {
    const graph = await graphWithRecordNode();
    await press(graph);

    // Criterion 3 of NDA-004: "`sendWarning` still works and shows what it showed before." It now
    // arrives through the bus's subscriber rather than from the call site, with the same
    // `showGlobally`/`message` payload — so nothing regresses on the canvas.
    const warnings = graph.editorConnection.warnings.filter((w) => w.nodeId === 'record');
    expect(warnings.length).toBe(1);
    expect(warnings[0].message).toBe('No class name specified');
  });

  test('the warning key and the clear key are the same key', async () => {
    const graph = await graphWithRecordNode();
    await press(graph);
    expect(graph.editorConnection.hasWarningFor('record')).toBe(true);

    // `clearWarnings` runs at the top of the next operation. If it still named
    // `'storage-op-warning'` while the bus filed the warning under the raised code, this would
    // stay `true` for ever and every Record node would accumulate warnings it could not shed.
    graph.node<NodeInstance & { clearWarnings(): void }>('record').clearWarnings();

    expect(graph.editorConnection.hasWarningFor('record')).toBe(false);
  });

  /**
   * The control, and it took two attempts — recorded because the first one was wrong in an
   * instructive way.
   *
   * "Give it a class name and expect silence" is not a control: with a class name the node gets
   * *past* `checkWarningsBeforeCloudOp` and straight into the second `setError` on the save path,
   * `'Missing Record Id'` — which is the first §2 batch's fix doing its job. The fixture was too
   * thin, not the code. Standing up a genuinely succeeding save needs a bound record and a cloud
   * backend, which is a different test at a different level.
   *
   * So the control discriminates on the *message* instead: the guard under test must stop
   * reporting its own failure, while the node keeps reporting the real one behind it.
   */
  test('control: a class name silences that failure and reveals the next real one', async () => {
    const graph = await graphWithRecordNode({ collectionName: 'Posts' });
    await press(graph);

    const messages = graph.errors.filter((e) => e.code === 'record/storage-op-failed').map((e) => e.message);

    // `checkWarningsBeforeCloudOp`'s guard passes now, so this specific complaint is gone —
    // proving the rows above are not satisfied by a node that reports unconditionally.
    expect(messages).not.toContain('No class name specified');
    // And the failure genuinely behind it still reports, on the same channel.
    expect(messages).toContain('Missing Record Id');
  });
});

/**
 * NDA-004 §2 — the ports themselves, not just the signal log.
 *
 * `graph.signalsFor` records a port name **before** delegating, and `Node.sendSignalOnOutput` on
 * a name the node lacks only `console.log`s and returns. So deleting a node's `failure` output
 * leaves every `toContain('failure')` row in this file green — verified by doing it. Whenever the
 * *port* is part of the claim, `hasOutput` is the assertion that holds it in place.
 */
describe('NDA-004 §2: the ports exist', () => {
  test('Set Record Properties carries Failure and Error', async () => {
    const graph = await graphWithRecordNode({});

    expect(graph.node('record').hasOutput('failure')).toBe(true);
    expect(graph.node('record').hasOutput('error')).toBe(true);
  });
});
