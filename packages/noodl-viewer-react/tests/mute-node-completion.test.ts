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
import EventSenderModule from '../src/nodes/std-library/eventsender';
import ExternalLinkModule from '../src/nodes/std-library/externallink';

interface ClosePopupInstance extends NodeInstance {
  _internal: { closeCallback?: (action: string | undefined, results: Record<string, unknown>) => void };
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
    expect(graph.node('node').getOutput('error').value).toBe('No popup in scope to close');
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

    expect(graph.signalsFor('node')).toEqual(['failure']);
    expect(codesRaised(graph)).toContain('event-sender/no-channel');
  });

  test('with a channel name, sends and signals Sent', async () => {
    const graph = await graphWith(EventSenderModule, 'Event Sender', { channelName: 'ping' });

    const received: unknown[] = [];
    graph.context.eventSenderEmitter.on('ping', (payload: unknown) => received.push(payload));

    graph.node('node').setInputValue('sendEvent', true);
    await graph.settle(3);

    expect(received).toHaveLength(1);
    expect(graph.signalsFor('node')).toEqual(['sent']);
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
