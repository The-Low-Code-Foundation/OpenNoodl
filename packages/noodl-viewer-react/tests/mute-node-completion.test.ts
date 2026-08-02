/**
 * NDA-004 §2/§3 — the action nodes that used to take a signal and emit nothing.
 *
 * Each of these had the same shape of bug: an early `return` on a condition the author is
 * most likely to hit, with no port and no report on the way out. The node did nothing and
 * said nothing, which from the canvas is indistinguishable from a node that worked — so the
 * *node* got blamed for what was a configuration mistake.
 *
 * The failures pinned here are the specific ones the Failure Contract calls out: Close Popup
 * with no popup in scope, and a browser popup blocker refusing an External Link.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../noodl-runtime/test/corpus/graph-harness';

import ClosePopupModule from '../src/nodes/navigation/closepopup';
import NavigateBackModule from '../src/nodes/navigation/navigate-back';
import EventSenderModule from '../src/nodes/std-library/eventsender';
import ExternalLinkModule from '../src/nodes/std-library/externallink';

interface ClosePopupInstance extends NodeInstance {
  _internal: { closeCallback?: (action: string | undefined, results: Record<string, unknown>) => void };
}

interface NavigateBackInstance extends NodeInstance {
  _internal: { backCallback?: (args: unknown) => { ok: boolean; code?: string; message?: string } | void };
}

async function graphWith(module: NodeModule, type: string, parameters: Record<string, unknown> = {}) {
  const graph = await createCorpusGraph({
    modules: [module],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

function codesRaised(graph: CorpusGraph): string[] {
  return graph.editorConnection.warnings.map((w) => w.key);
}

describe('NDA-004: Close Popup', () => {
  test('with no popup in scope, reports instead of doing nothing quietly', async () => {
    const graph = await graphWith(ClosePopupModule, 'NavigationClosePopup');

    graph.node('node').setInputValue('close', true);
    await graph.settle(3);

    expect(graph.signalsFor('node')).toEqual(['failure']);
    expect(codesRaised(graph)).toContain('close-popup/no-popup-in-scope');
    // NDA-015 changed this from a shorter, separate string. The Failure Contract asks that a
    // `Failure` signal be "accompanied by an `Error` value output carrying `message`/`code`",
    // and two different wordings of one failure is the "no information one level up" problem
    // in miniature: the author reading the Error port saw less than the raised event said.
    expect(graph.node('node').getOutput('error').value).toBe(
      'No popup in scope to close — this node only works inside a component opened as a popup'
    );
  });

  test('inside a popup, closes and signals Closed', async () => {
    const graph = await graphWith(ClosePopupModule, 'NavigationClosePopup');

    const node = graph.node<ClosePopupInstance>('node');
    const closed: unknown[] = [];
    // What the popup layer installs when the popup opens.
    node._internal.closeCallback = (action, results) => closed.push({ action, results });

    node.setInputValue('close', true);
    await graph.settle(3);

    expect(closed).toHaveLength(1);
    expect(graph.signalsFor('node')).toEqual(['success']);
  });
});

describe('NDA-004: Send Event', () => {
  test('with no channel name, reports rather than sending into the void', async () => {
    const graph = await graphWith(EventSenderModule, 'Event Sender');

    graph.node('node').setInputValue('sendEvent', true);
    await graph.settle(3);

    // ERG-001 §4 added `Completed` after every outcome, whatever it was.
    expect(graph.signalsFor('node')).toEqual(['failure', 'completed']);
    expect(codesRaised(graph)).toContain('event-sender/no-channel');
  });

  test('the Error output carries the message, so a graph can show it', async () => {
    const graph = await graphWith(EventSenderModule, 'Event Sender');

    graph.node('node').setInputValue('sendEvent', true);
    await graph.settle(3);

    // Added 2026-07-30 with the port itself. The contract forbids a bare `Failure` signal.
    expect(graph.node('node').getOutput('error').value).toBe('No channel name, so the event was not sent');
  });

  test('with a channel name, sends and reports Done', async () => {
    const graph = await graphWith(EventSenderModule, 'Event Sender', { channelName: 'ping' });

    const received: unknown[] = [];
    graph.context.eventSenderEmitter.on('ping', (payload: unknown) => received.push(payload));

    graph.node('node').setInputValue('sendEvent', true);
    await graph.settle(3);

    expect(received).toHaveLength(1);
    // ERG-001 §4 renamed `sent` to `done` and added `Completed` beside it.
    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
  });
});

describe('NDA-004: External Link', () => {
  const realWindow = (global as { window?: unknown }).window;

  afterEach(() => {
    if (realWindow === undefined) delete (global as { window?: unknown }).window;
    else (global as { window?: unknown }).window = realWindow;
  });

  function stubWindow(open: (...args: unknown[]) => unknown) {
    (global as { window?: unknown }).window = { open };
  }

  /**
   * The headline case. A popup blocker returns null from `window.open`, the tab never opens,
   * and before this the author saw a button that simply did nothing.
   */
  test('a blocked new tab reports instead of failing silently', async () => {
    stubWindow(() => null);
    const graph = await graphWith(ExternalLinkModule, 'net.noodl.externallink', {
      link: 'https://example.com',
      openInNewTab: true
    });

    graph.node('node').setInputValue('do', true);
    await graph.settle(2);

    expect(graph.signalsFor('node')).toEqual(['failure']);
    expect(codesRaised(graph)).toContain('external-link/blocked');
    expect(graph.node('node').getOutput('error').value).toBe('The browser blocked opening a new tab');
  });

  test('an empty link reports rather than opening nothing', async () => {
    stubWindow(() => ({}));
    const graph = await graphWith(ExternalLinkModule, 'net.noodl.externallink', { link: '' });

    graph.node('node').setInputValue('do', true);
    await graph.settle(2);

    expect(graph.signalsFor('node')).toEqual(['failure']);
    expect(codesRaised(graph)).toContain('external-link/no-link');
  });

  test('a link that opens signals Success', async () => {
    const opened: unknown[] = [];
    stubWindow((url: unknown) => {
      opened.push(url);
      return {};
    });
    const graph = await graphWith(ExternalLinkModule, 'net.noodl.externallink', {
      link: 'https://example.com',
      openInNewTab: true
    });

    graph.node('node').setInputValue('do', true);
    await graph.settle(2);

    expect(opened).toEqual(['https://example.com']);
    expect(graph.signalsFor('node')).toEqual(['success']);
  });
});

/**
 * NDA-008 §3. Three ways to fail, all of them formerly silent — and the third is the one
 * authors actually hit, because a double-tapped back button lost its second tap without trace.
 *
 * ⚠️ **Updated by ERG-001 §4**, which adopted the outcome contract across the navigation family.
 * Two things moved: every invocation now also emits `Completed`, and `success` (displaying
 * "Popped") became `done` — §0.2 Result 2's one concept had six wire names and this was the
 * sixth. The stack-at-root case became `Unchanged` rather than `Failure`, on the reasoning Build
 * 2b applied to `Undo` at the beginning of history; the row below is updated to the shape the
 * Component Stack actually returns now, and `erg-001-navigation-outcomes.test.ts` pins both ends.
 */
describe('NDA-004 / NDA-008 §3: Pop Component Stack', () => {
  test('outside a pushed component, reports instead of doing nothing quietly', async () => {
    const graph = await graphWith(NavigateBackModule, 'PageStackNavigateBack');

    graph.node('node').setInputValue('navigate', true);
    await graph.settle(3);

    expect(graph.signalsFor('node')).toEqual(['failure', 'completed']);
    expect(codesRaised(graph)).toContain('pop-component-stack/no-stack-in-scope');
  });

  test('a stack already at its first component reports, rather than swallowing the pop', async () => {
    const graph = await graphWith(NavigateBackModule, 'PageStackNavigateBack');
    const node = graph.node<NavigateBackInstance>('node');
    // What the Component Stack installs when it pushes this node's component.
    node._internal.backCallback = () => ({ ok: false, unchanged: true });

    node.setInputValue('navigate', true);
    await graph.settle(3);

    // ERG-001 §4: still reported, and no longer as a failure. A Back button on the root
    // component is a graph working exactly as written.
    expect(graph.signalsFor('node')).toEqual(['unchanged', 'completed']);
    expect(graph.errors).toEqual([]);
  });

  test('a pop during a transition reports, rather than losing the second tap', async () => {
    const graph = await graphWith(NavigateBackModule, 'PageStackNavigateBack');
    const node = graph.node<NavigateBackInstance>('node');
    node._internal.backCallback = () => ({
      ok: false,
      code: 'pop-component-stack/transition-in-progress',
      message: 'Still animating'
    });

    node.setInputValue('navigate', true);
    await graph.settle(3);

    expect(graph.signalsFor('node')).toEqual(['failure', 'completed']);
    expect(codesRaised(graph)).toContain('pop-component-stack/transition-in-progress');
  });

  test('a pop that works signals Popped', async () => {
    const graph = await graphWith(NavigateBackModule, 'PageStackNavigateBack');
    const node = graph.node<NavigateBackInstance>('node');
    const popped: unknown[] = [];
    node._internal.backCallback = (args) => {
      popped.push(args);
      return { ok: true };
    };

    node.setInputValue('navigate', true);
    await graph.settle(3);

    expect(popped.length).toBe(1);
    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
  });

  test('a callback that returns nothing is treated as success, not failure', async () => {
    // `_setBackCallback` is reachable across the node-type boundary, so something other than
    // `navigation-stack.tsx` could be installing one. Treating "told us nothing" as a failure
    // would be worse than assuming it worked.
    const graph = await graphWith(NavigateBackModule, 'PageStackNavigateBack');
    const node = graph.node<NavigateBackInstance>('node');
    node._internal.backCallback = () => undefined;

    node.setInputValue('navigate', true);
    await graph.settle(3);

    expect(graph.signalsFor('node')).toEqual(['done', 'completed']);
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
describe('NDA-004 §2/§3: the ports exist', () => {
  const CASES = [
    { label: 'Close Popup', module: ClosePopupModule, type: 'NavigationClosePopup', done: 'success' },
    { label: 'Send Event', module: EventSenderModule, type: 'Event Sender', done: 'done' },
    { label: 'External Link', module: ExternalLinkModule, type: 'net.noodl.externallink', done: 'success' },
    // ERG-001 §4 renamed these to `done` as its slices reached them. The two still reading
    // `success` are waiting on the Navigation slice of §4 — recorded here rather than left to
    // look like an inconsistency someone should quietly "fix".
    { label: 'Pop Component Stack', module: NavigateBackModule, type: 'PageStackNavigateBack', done: 'done' }
  ];

  /**
   * This top-up is what found **Send Event had no `Error` port at all** — a `Failure` signal and
   * a raised code, but nothing an author could read on the canvas, which the contract calls out
   * by name: "a bare signal reproduces 'no information' one level up". The batch-1 rows asserted
   * on `signalsFor` and the raised code, so nothing noticed for two batches.
   */
  test.each(CASES)('$label carries its completion, Failure and Error', async ({ module, type, done }) => {
    const graph = await graphWith(module as NodeModule, type);
    const node = graph.node('node');

    expect({ done: node.hasOutput(done), failure: node.hasOutput('failure'), error: node.hasOutput('error') }).toEqual(
      { done: true, failure: true, error: true }
    );
  });
});
