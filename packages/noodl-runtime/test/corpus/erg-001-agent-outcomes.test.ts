/**
 * ERG-001 §4 — the outcome contract on the four small multi-verb Data nodes.
 *
 * | Node | Actions | Shape |
 * |---|---|---|
 * | `net.noodl.ActionHandler` — Action Handler | `Complete`, `Fail` | `done` · `completed`; existing `failure` kept, meaning unchanged |
 * | `net.noodl.StateSnapshot` — State Snapshot | `Save`, `Restore` | `done` · `completed`; existing `failure` kept |
 * | `net.noodl.JSONStreamParser` — JSON Stream Parser | `Parse`, `Clear` | `done` · `unchanged` · `completed`; ⚠️ `failure` **narrowed** |
 * | `net.noodl.PatternExtractor` — Pattern Extractor | `Extract` | `done` · `completed`; existing `failure` kept |
 *
 * ## ⚠️ Action Handler — a `Fail` that succeeds is a `Done`
 *
 * The two are not the same thing and conflating them is the easy mistake here. `Fail` asks this
 * node to report the in-flight action as failed; when it does, **the node did what it was asked**
 * and that is `Done`. The existing `Failure` port means something else entirely — *"Complete or
 * Fail was signalled with no action in flight"* — which is a genuine refusal, and it keeps that
 * meaning untouched.
 *
 * `Trigger` is not an outcome of anything. It is an *output* the registry fires when a dispatcher
 * has work for this node; nothing on this node's canvas invoked it, and the registration errors
 * (a blank action type, a reserved built-in name) stay on the error bus rather than becoming
 * outcomes, because they are reached while the graph is still coming up.
 *
 * ## ⚠️ State Snapshot — `setError(undefined)` is a clear, not a failure
 *
 * Every success path calls it first. The guard on a defined message is what stops the `Failure`
 * port firing on every successful operation, and it is preserved. What changed is that `setError`
 * settles the invocation's token *outside* its own dedup, for the reason Array Filter's
 * `reportFailure` does: the dedup is about the announcement, and Rule 1 is per invocation.
 *
 * ## ⚠️ JSON Stream Parser — the one node in the batch whose `Failure` changes meaning
 *
 * `reportError` fired `failure` **once per bad line**, so one `Parse` over three malformed lines
 * pulsed it three times. Rule 1's load-bearing half is *exactly* one terminal signal per
 * invocation, so the port is narrowed: the per-line detail stays on `Error` and `Error Count`
 * (and now reaches the NDA-004 bus, which it never did before — `reportError` raised nothing),
 * and the signal becomes the invocation's outcome. §0.2 Result 3's lesson applied deliberately:
 * where an existing port's meaning is wrong under the contract, the honest fix is to change it
 * and say so.
 *
 * It is also the one node here that earns an **`Unchanged`**: `doParse` opens with
 * `if (internal.buffer === '') return;` — nothing arrived and nothing needed doing, which is the
 * post-condition already holding rather than work being refused. A `Clear` with nothing to
 * discard is the same shape and uses the same port.
 *
 * ⚠️ A parse that consumed a chunk without completing a value is **`Done`, not `Unchanged`**: the
 * buffer grew, `Pending Characters` and `Is Complete` changed, and the action did its work. The
 * existing `Success` port keeps its narrower meaning — "this Parse yielded values" — and is a
 * value-level announcement beside the outcome, exactly as `Filtered` is on Array Filter.
 *
 * ## ⚠️ Pattern Extractor — the design question, decided
 *
 * `Found` and `Not Found` both mean "the extract ran". The tempting reading is
 * `notFound -> unchanged`; it is **wrong**, and the post-condition test is why. `Unchanged` means
 * the action was valid and *the post-condition already held, so nothing needed doing*. Extract's
 * post-condition is "the outputs reflect running this pattern over this text" — and running it
 * over text that matches nothing still rewrites `Match`, `Match Count`, `Groups` and `Named
 * Groups`. Nothing was declined; the work happened and produced a result.
 *
 * The consequence check agrees. An author pulling a percentage out of a stream hits `Not Found`
 * on most chunks — it is the *common* case — and routing the common case onto a different wire
 * from the uncommon one is `Run Tasks`' defect with the sign flipped, which is the same reason
 * `For Each` refused an `Unchanged` for an empty list.
 *
 * So **`done` fires beside both `Found` and `Not Found`**, and this node gets no `Unchanged`
 * port. §5 must not expect one.
 *
 * ## What reverting reddens — predicted before running, then measured
 *
 * | Revert | Predicted | Actual |
 * |---|---|---|
 * | `doFail` reporting `failure` rather than `done` when there *was* an action in flight | 1 | **1, that row** |
 * | State Snapshot settling the token inside `setError`'s dedup | 1 | **1, that row** |
 * | Pattern Extractor reporting `unchanged` for a no-match | 2 | **2, those two** |
 * | `doParse`'s empty-buffer branch returning silently again | 1 | **1, that row** |
 * | `reportError` keeping its per-line `failure` pulse | 1 | **1, that row** |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ActionHandlerNode = require('../../src/nodes/std-library/agent/actionhandlernode');
import StateSnapshotNode = require('../../src/nodes/std-library/agent/statesnapshotnode');
import JsonStreamParserNode = require('../../src/nodes/std-library/agent/json-stream-parser');
import PatternExtractorNode = require('../../src/nodes/std-library/agent/pattern-extractor');

import { actionRegistry, type ActionContext } from '../../src/nodes/std-library/agent/action-dispatcher';
import { globalStoreManager } from '../../src/nodes/std-library/agent/globalstore';
import { stateHistoryManager } from '../../src/nodes/std-library/agent/statehistory';

function outcomesOf(graph: CorpusGraph, id: string, from = 0): string[] {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, id: string, signal: string, from = 0): number {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === signal).length;
}

function mark(graph: CorpusGraph, id: string): number {
  return graph.signalsFor(id).length;
}

function pulse(graph: CorpusGraph, id: string, port: string): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

async function graphWith(
  module: unknown,
  type: string,
  id: string,
  parameters: Record<string, unknown> = {}
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id, type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(3);
  return graph;
}

// =================================================================================================
// Action Handler
// =================================================================================================

/** A synthetic in-flight action, invoked through the handler the node really registered. */
function dispatchTo(channel: string, actionType: string): { completed: unknown[]; failed: string[] } {
  const completed: unknown[] = [];
  const failed: string[] = [];
  const context: ActionContext = {
    actionId: 'act-1',
    actionType,
    action: { type: actionType } as never,
    payload: { hello: 'world' },
    complete(result?: unknown) {
      completed.push(result);
    },
    fail(message: string) {
      failed.push(message);
    }
  };
  for (const handler of actionRegistry.getHandlers(channel, actionType)) handler.invoke(context);
  return { completed, failed };
}

describe('ERG-001 §4: Action Handler', () => {
  afterEach(() => actionRegistry.reset());

  test('a Complete with an action in flight reports Done then Completed', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', {
      actionType: 'OPEN',
      autoComplete: false
    });
    const dispatched = dispatchTo('default', 'OPEN');
    const before = mark(graph, 'handler');

    pulse(graph, 'handler', 'complete');
    await graph.settle(2);

    expect(dispatched.completed).toHaveLength(1);
    expect(outcomesOf(graph, 'handler', before)).toEqual(['done']);
    expect(countOf(graph, 'handler', 'completed', before)).toBe(1);
  });

  /**
   * ⚠️ The row the whole node turns on. `Fail` asks this handler to report the action failed;
   * doing so is the node succeeding at what it was asked, so the outcome is `Done`. Reporting
   * `Failure` here would mean an author could not tell "I reported a failure" from "you pulsed
   * Fail with nothing in flight".
   */
  test('a Fail with an action in flight reports Done, because reporting a failure is what it was asked to do', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', {
      actionType: 'OPEN',
      autoComplete: false,
      errorMessage: 'the user declined'
    });
    const dispatched = dispatchTo('default', 'OPEN');
    const before = mark(graph, 'handler');

    pulse(graph, 'handler', 'fail');
    await graph.settle(2);

    expect(dispatched.failed).toEqual(['the user declined']);
    expect(outcomesOf(graph, 'handler', before)).toEqual(['done']);
    expect(countOf(graph, 'handler', 'completed', before)).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('a Complete with nothing in flight reports Failure then Completed', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', {
      actionType: 'OPEN'
    });
    const before = mark(graph, 'handler');

    pulse(graph, 'handler', 'complete');
    await graph.settle(2);

    expect(outcomesOf(graph, 'handler', before)).toEqual(['failure']);
    expect(countOf(graph, 'handler', 'completed', before)).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['action-handler/operation-failed']);
  });

  test('a Fail with nothing in flight reports Failure then Completed', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', {
      actionType: 'OPEN'
    });
    const before = mark(graph, 'handler');

    pulse(graph, 'handler', 'fail');
    await graph.settle(2);

    expect(outcomesOf(graph, 'handler', before)).toEqual(['failure']);
    expect(countOf(graph, 'handler', 'completed', before)).toBe(1);
  });

  /**
   * ⚠️ Pinned control. `Trigger` is the registry asking this node to act, not an outcome of
   * anything on this canvas, and a registration error is reached while the graph is coming up.
   */
  test('(pinned control) being triggered by a dispatcher reports no outcome', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', {
      actionType: 'OPEN'
    });
    const before = mark(graph, 'handler');
    dispatchTo('default', 'OPEN');
    await graph.settle(2);

    expect(graph.signalsFor('handler').slice(before)).toEqual(['trigger']);
  });

  test('(pinned control) a blank Action Type raises but reports no outcome', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', {
      actionType: ''
    });
    await graph.settle(3);

    expect(graph.signalsFor('handler')).toEqual([]);
    expect(graph.errors.map((e) => e.code)).toEqual(['action-handler/operation-failed']);
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await graphWith(ActionHandlerNode, 'net.noodl.ActionHandler', 'handler', { actionType: 'OPEN' });
    const node = graph.node('handler');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // Complete with nothing in flight is a refusal, not a no-op.
    expect(node.hasOutput('unchanged')).toBe(false);
  });
});

// =================================================================================================
// State Snapshot
// =================================================================================================

describe('ERG-001 §4: State Snapshot', () => {
  beforeEach(() => {
    globalStoreManager.reset();
    stateHistoryManager.reset();
  });

  test('a Save reports Done then Completed, beside the existing Saved', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {
      snapshotName: 'checkpoint'
    });
    const before = mark(graph, 'snap');

    pulse(graph, 'snap', 'save');
    await graph.settle(3);

    const signals = graph.signalsFor('snap').slice(before);
    expect(signals).toContain('saved');
    expect(outcomesOf(graph, 'snap', before)).toEqual(['done']);
    expect(countOf(graph, 'snap', 'completed', before)).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('a Restore of a saved checkpoint reports Done then Completed', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {
      snapshotName: 'checkpoint'
    });
    pulse(graph, 'snap', 'save');
    await graph.settle(3);
    const before = mark(graph, 'snap');

    pulse(graph, 'snap', 'restore');
    await graph.settle(3);

    expect(graph.signalsFor('snap').slice(before)).toContain('restored');
    expect(outcomesOf(graph, 'snap', before)).toEqual(['done']);
    expect(countOf(graph, 'snap', 'completed', before)).toBe(1);
  });

  test('a Restore of a checkpoint that was never saved reports Failure then Completed', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {
      snapshotName: 'never-saved'
    });
    const before = mark(graph, 'snap');

    pulse(graph, 'snap', 'restore');
    await graph.settle(3);

    expect(outcomesOf(graph, 'snap', before)).toEqual(['failure']);
    expect(countOf(graph, 'snap', 'completed', before)).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['state-snapshot/operation-failed']);
  });

  /**
   * ⚠️ `setError` dedups by message, and a second Restore of the same missing checkpoint
   * produces the identical message. The announcement is deduped; the invocation still owes its
   * own outcome, or the second press is a dead chain.
   */
  test('a second Restore of the same missing checkpoint still reports its own Failure', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {
      snapshotName: 'never-saved'
    });
    const before = mark(graph, 'snap');

    pulse(graph, 'snap', 'restore');
    await graph.settle(3);
    pulse(graph, 'snap', 'restore');
    await graph.settle(3);

    expect(outcomesOf(graph, 'snap', before)).toEqual(['failure', 'failure']);
    expect(countOf(graph, 'snap', 'completed', before)).toBe(2);
    // One raise, not two — the message dedup is untouched.
    expect(graph.errors.map((e) => e.code)).toEqual(['state-snapshot/operation-failed']);
  });

  test('a Save and a Restore queued in one pass each report their own outcome', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {
      snapshotName: 'checkpoint'
    });
    const before = mark(graph, 'snap');

    pulse(graph, 'snap', 'save');
    pulse(graph, 'snap', 'restore');
    await graph.settle(3);

    expect(outcomesOf(graph, 'snap', before)).toEqual(['done', 'done']);
    expect(countOf(graph, 'snap', 'completed', before)).toBe(2);
  });

  test('(pinned control) booting with a Snapshot Name reports nothing at all', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {
      snapshotName: 'checkpoint',
      storeName: 'app'
    });
    await graph.settle(4);

    expect(graph.signalsFor('snap')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await graphWith(StateSnapshotNode, 'net.noodl.StateSnapshot', 'snap', {});
    const node = graph.node('snap');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // Save copies the store every time and Restore writes every time; neither can decline.
    expect(node.hasOutput('unchanged')).toBe(false);
  });
});

// =================================================================================================
// JSON Stream Parser
// =================================================================================================

describe('ERG-001 §4: JSON Stream Parser', () => {
  test('a Parse that yields a value reports Done then Completed, beside the existing Success', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    graph.node('parser').setInputValue('chunk', '{"a":1}\n');
    await graph.settle(2);
    const before = mark(graph, 'parser');

    pulse(graph, 'parser', 'parse');
    await graph.settle(2);

    const signals = graph.signalsFor('parser').slice(before);
    expect(signals).toContain('success');
    expect(outcomesOf(graph, 'parser', before)).toEqual(['done']);
    expect(countOf(graph, 'parser', 'completed', before)).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  /**
   * ⚠️ A chunk that only advanced an incomplete value is `Done`, not `Unchanged` — the buffer
   * grew and `Pending Characters` changed. `Success` stays quiet, which is its narrower and
   * correct meaning, and is why the two ports both exist.
   */
  test('a Parse that completes no value but consumed the chunk reports Done, and stays quiet on Success', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    graph.node('parser').setInputValue('chunk', '{"a":1');
    await graph.settle(2);
    const before = mark(graph, 'parser');

    pulse(graph, 'parser', 'parse');
    await graph.settle(2);

    const signals = graph.signalsFor('parser').slice(before);
    expect(signals).not.toContain('success');
    expect(outcomesOf(graph, 'parser', before)).toEqual(['done']);
    expect(countOf(graph, 'parser', 'completed', before)).toBe(1);
  });

  /** ⚠️ The contract's headline class: this branch emitted nothing at all. */
  test('a Parse with nothing pending reports Unchanged then Completed', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    const before = mark(graph, 'parser');

    pulse(graph, 'parser', 'parse');
    await graph.settle(2);

    expect(outcomesOf(graph, 'parser', before)).toEqual(['unchanged']);
    expect(countOf(graph, 'parser', 'completed', before)).toBe(1);
    // Unchanged does not raise: it is not an error.
    expect(graph.errors).toEqual([]);
  });

  /**
   * ⚠️ The narrowing, pinned. Three bad lines used to pulse `failure` three times for one
   * invocation, which is Rule 1's load-bearing half broken. The count is now one, and the
   * per-line detail is on `Error Count`.
   */
  test('a Parse over three unparseable lines reports exactly one Failure, and counts three errors', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    graph.node('parser').setInputValue('chunk', 'nope\nalso nope\nstill nope\n');
    await graph.settle(2);
    const before = mark(graph, 'parser');

    pulse(graph, 'parser', 'parse');
    await graph.settle(2);

    expect(outcomesOf(graph, 'parser', before)).toEqual(['failure']);
    expect(countOf(graph, 'parser', 'failure', before)).toBe(1);
    expect(countOf(graph, 'parser', 'completed', before)).toBe(1);
    expect(graph.node('parser').getOutput('errorCount').value).toBe(3);
    expect(graph.errors.map((e) => e.code)).toEqual(['json-stream-parser/parse-failed']);
  });

  test('a Clear with something to discard reports Done, beside the existing Cleared', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    graph.node('parser').setInputValue('chunk', '{"a":1}\n');
    await graph.settle(2);
    pulse(graph, 'parser', 'parse');
    await graph.settle(2);
    const before = mark(graph, 'parser');

    pulse(graph, 'parser', 'clear');
    await graph.settle(2);

    expect(graph.signalsFor('parser').slice(before)).toContain('cleared');
    expect(outcomesOf(graph, 'parser', before)).toEqual(['done']);
    expect(countOf(graph, 'parser', 'completed', before)).toBe(1);
  });

  test('a Clear with nothing to discard reports Unchanged', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    const before = mark(graph, 'parser');

    pulse(graph, 'parser', 'clear');
    await graph.settle(2);

    expect(outcomesOf(graph, 'parser', before)).toEqual(['unchanged']);
    expect(countOf(graph, 'parser', 'completed', before)).toBe(1);
  });

  test('(pinned control) a Chunk arriving reports no outcome', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {
      format: 'ndjson'
    });
    graph.node('parser').setInputValue('chunk', '{"a":1}\n');
    await graph.settle(4);

    expect(graph.signalsFor('parser')).toEqual([]);
  });

  test('(pinned control) has Done, Unchanged, Failure and Completed', async () => {
    const graph = await graphWith(JsonStreamParserNode, 'net.noodl.JSONStreamParser', 'parser', {});
    const node = graph.node('parser');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('unchanged')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
  });
});

// =================================================================================================
// Pattern Extractor
// =================================================================================================

describe('ERG-001 §4: Pattern Extractor', () => {
  test('an Extract that matches reports Done then Completed, beside the existing Found', async () => {
    const graph = await graphWith(PatternExtractorNode, 'net.noodl.PatternExtractor', 'extract', {
      pattern: '(\\d+)%'
    });
    graph.node('extract').setInputValue('text', 'Processing... 45% complete');
    await graph.settle(2);
    const before = mark(graph, 'extract');

    pulse(graph, 'extract', 'extract');
    await graph.settle(2);

    const signals = graph.signalsFor('extract').slice(before);
    expect(signals).toContain('found');
    expect(outcomesOf(graph, 'extract', before)).toEqual(['done']);
    expect(countOf(graph, 'extract', 'completed', before)).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  /**
   * ⚠️ The decided question, pinned in a row. `Not Found` is a **result**: the extract ran and
   * rewrote every output. It is `Done`, not `Unchanged` — nothing was declined, and putting the
   * common case on a different wire from the uncommon one is `Run Tasks`' defect inverted.
   */
  test('an Extract that matches nothing reports Done too, beside the existing Not Found', async () => {
    const graph = await graphWith(PatternExtractorNode, 'net.noodl.PatternExtractor', 'extract', {
      pattern: '(\\d+)%'
    });
    graph.node('extract').setInputValue('text', 'nothing numeric here');
    await graph.settle(2);
    const before = mark(graph, 'extract');

    pulse(graph, 'extract', 'extract');
    await graph.settle(2);

    const signals = graph.signalsFor('extract').slice(before);
    expect(signals).toContain('notFound');
    expect(outcomesOf(graph, 'extract', before)).toEqual(['done']);
    expect(countOf(graph, 'extract', 'completed', before)).toBe(1);
  });

  test('an Extract with an unusable pattern reports Failure then Completed', async () => {
    const graph = await graphWith(PatternExtractorNode, 'net.noodl.PatternExtractor', 'extract', {
      pattern: '('
    });
    graph.node('extract').setInputValue('text', 'anything');
    await graph.settle(2);
    const before = mark(graph, 'extract');

    pulse(graph, 'extract', 'extract');
    await graph.settle(2);

    expect(outcomesOf(graph, 'extract', before)).toEqual(['failure']);
    expect(countOf(graph, 'extract', 'completed', before)).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['pattern-extractor/extract-failed']);
  });

  test('(pinned control) Text arriving reports no outcome', async () => {
    const graph = await graphWith(PatternExtractorNode, 'net.noodl.PatternExtractor', 'extract', {
      pattern: '(\\d+)%'
    });
    graph.node('extract').setInputValue('text', 'Processing... 45% complete');
    await graph.settle(4);

    expect(graph.signalsFor('extract')).toEqual([]);
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await graphWith(PatternExtractorNode, 'net.noodl.PatternExtractor', 'extract', {});
    const node = graph.node('extract');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // Decided above: Not Found is a result, not a post-condition that already held.
    expect(node.hasOutput('unchanged')).toBe(false);
  });
});
