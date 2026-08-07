/**
 * ERG-001 §4 — the last four Navigation nodes: `Close Popup`, `External Link`,
 * `Navigate To Path` and `Show Popup`.
 *
 * The navigation slice took the seven that route through the Router and the Component Stack;
 * these four were left because none of them is a page transition in the Router's sense. Three
 * of them still leave the page, which is why the contract's one real exception is quoted again
 * here rather than assumed.
 *
 * | Node | Action port | Shape |
 * |---|---|---|
 * | `NavigationClosePopup` | `Close`, each `closeAction-…` | `done` (was `success`) · `failure` kept · `completed` |
 * | `net.noodl.externallink` | `Do` | `done` (was `success`) · `unchanged` · `failure` kept · `completed` |
 * | `PageStackNavigateToPath` | `Navigate` | `done` (was `success`) · `unchanged` · `failure` kept · `completed` |
 * | `NavigationShowPopup` | `Show` | `done` **added** · `failure` kept · `completed` |
 *
 * ## ⚠️ Three renames and one addition, and the grep is what decides
 *
 * `Close Popup`, `External Link` and `Navigate To Path` each send `success` from one method
 * whose only callers are their own action ports — no setter, no subscription — so `Success` *is*
 * the invocation's outcome and §0.2 Result 2 loses three more spellings.
 *
 * `Show Popup` is different and keeps every port it has. `Closed`, `Dismissed` and the author's
 * `closeAction-…` outputs are all *later* events: they fire when the user finishes with a popup
 * that opened successfully, which may be minutes after the `Show` that opened it, and
 * `Dismissed` fires for something the author never did. None of them is "the Show finished", so
 * `Done` is added beside them and fires when the popup has actually been opened.
 *
 * ## ⚠️ The server-side no-op becomes `Unchanged`, on the two nodes that have one
 *
 * `External Link` and `Navigate To Path` both open with a bare `return` when there is no
 * `window` — an SSR render firing them. That is the contract's headline dead chain: the node was
 * told to do something, did nothing, and said nothing. It is `Unchanged` rather than `Failure`
 * for the reason both files already gave in prose: "an SSR pass firing `Failure` would train
 * authors to ignore the port". Nothing is raised.
 *
 * ## ⚠️ `Done` stays on the navigating path
 *
 * The navigation slice settled this and it applies again: a `Completed` that is silent on the
 * *most common* path defeats Rule 2's whole value, and an External Link opening a new tab
 * demonstrably leaves this graph alive. Terminality is documented in the port description
 * instead of being expressed as a missing port.
 *
 * ## What reverting reddens — predicted per *fixture*, before running
 *
 * | Revert | Predicted |
 * |---|---|
 * | `Close Popup`'s token minted in `scheduleClose` rather than at its two ports | **0** — `scheduleClose` has no other caller, so the mint moves without changing anything |
 * | `Close Popup`'s tokens minted inside the coalescing guard | 1 — the two-Closes row |
 * | `Close Popup`'s no-popup branch reporting `done` | 2 — the no-popup row and the pre-existing NDA-004 row |
 * | `External Link`'s SSR branch back to a bare return | 1 — the SSR row |
 * | `Navigate To Path`'s SSR branch back to a bare return | 1 — the SSR row |
 * | `Show Popup` reporting `done` before `showPopup` resolves | 1 — the rejected-target row, which would then report twice |
 * | `Show Popup` folding `Closed` into `Done` | 2 — the close row and the port-surface control |
 */

/* eslint-env jest */

import NoodlRuntime from '@noodl/runtime';
import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ClosePopupModule from '../../src/nodes/navigation/closepopup';
import ExternalLinkModule from '../../src/nodes/std-library/externallink';
import NavigateToPathModule from '../../src/nodes/navigation/navigate-to-path';
import ShowPopupModule from '../../src/nodes/navigation/showpopup';

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

function signalPortsOf(module: unknown): string[] {
  const outputs = ((module as NodeModule).node as { outputs: Record<string, { type?: unknown }> }).outputs;
  return Object.keys(outputs).filter((name) => {
    const type = outputs[name].type;
    return type === 'signal' || (type && (type as { name?: string }).name === 'signal');
  });
}

async function graphWith(
  module: unknown,
  type: string,
  parameters: Record<string, unknown> = {}
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(3);
  return graph;
}

// =================================================================================================
// Close Popup
// =================================================================================================

interface ClosePopupInternals extends NodeInstance {
  _internal: { closeCallback?: (action: string | undefined, results: Record<string, unknown>) => void };
}

describe('ERG-001 §4: Close Popup', () => {
  test('a Close inside a popup reports Done then Completed, and Closed is gone', async () => {
    const graph = await graphWith(ClosePopupModule, 'NavigationClosePopup');
    const closed: unknown[] = [];
    graph.node<ClosePopupInternals>('node')._internal.closeCallback = (action, results) =>
      closed.push({ action, results });

    pulse(graph, 'node', 'close');
    await graph.settle(3);

    expect(closed).toHaveLength(1);
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.signalsFor('node')).not.toContain('success');
  });

  test('a Close with no popup in scope is a Failure carrying its existing code', async () => {
    const graph = await graphWith(ClosePopupModule, 'NavigationClosePopup');

    pulse(graph, 'node', 'close');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['close-popup/no-popup-in-scope']);
  });

  /**
   * The coalescing guard drops the second pulse's *close* deliberately; it must not drop the
   * second pulse's outcome.
   */
  test('two Closes coalesced into one pass still report two outcomes', async () => {
    const graph = await graphWith(ClosePopupModule, 'NavigationClosePopup');
    const closed: unknown[] = [];
    graph.node<ClosePopupInternals>('node')._internal.closeCallback = (action, results) =>
      closed.push({ action, results });

    const node = graph.node('node');
    node.setInputValue('close', false);
    node.setInputValue('close', true);
    node.setInputValue('close', false);
    node.setInputValue('close', true);
    await graph.settle(3);

    expect(closed).toHaveLength(1);
    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('(pinned control) the port surface is exactly the three outcome signals', () => {
    expect(signalPortsOf(ClosePopupModule).sort()).toEqual(['completed', 'done', 'failure']);
  });
});

// =================================================================================================
// External Link
// =================================================================================================

describe('ERG-001 §4: External Link', () => {
  const realWindow = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    if (realWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = realWindow;
  });

  function stubWindow(open: (...args: unknown[]) => unknown) {
    (globalThis as { window?: unknown }).window = { open };
  }

  test('a link that opens reports Done then Completed, and Success is gone', async () => {
    const opened: unknown[] = [];
    stubWindow((url: unknown) => {
      opened.push(url);
      return {};
    });
    const graph = await graphWith(ExternalLinkModule, 'net.noodl.externallink', {
      link: 'https://example.com',
      openInNewTab: true
    });

    pulse(graph, 'node', 'do');
    await graph.settle(3);

    expect(opened).toEqual(['https://example.com']);
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.signalsFor('node')).not.toContain('success');
  });

  test('a blocked new tab is a Failure carrying its existing code', async () => {
    stubWindow(() => null);
    const graph = await graphWith(ExternalLinkModule, 'net.noodl.externallink', {
      link: 'https://example.com',
      openInNewTab: true
    });

    pulse(graph, 'node', 'do');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(graph.errors.map((e) => e.code)).toEqual(['external-link/blocked']);
  });

  /**
   * ⚠️ The dead chain this closes. With no `window` the node returned bare — told to open a
   * link, did nothing, said nothing. `Unchanged` rather than `Failure`, and nothing raised: an
   * SSR pass is a graph working exactly as written.
   */
  test('a server-side render reports Unchanged and raises nothing', async () => {
    delete (globalThis as { window?: unknown }).window;
    const graph = await graphWith(ExternalLinkModule, 'net.noodl.externallink', {
      link: 'https://example.com'
    });

    pulse(graph, 'node', 'do');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('(pinned control) the port surface is exactly the four outcome signals', () => {
    expect(signalPortsOf(ExternalLinkModule).sort()).toEqual(['completed', 'done', 'failure', 'unchanged']);
  });
});

// =================================================================================================
// Navigate To Path
// =================================================================================================

describe('ERG-001 §4: Navigate To Path', () => {
  const realWindow = (globalThis as { window?: unknown }).window;

  // `navigate()` reads the project's `navigationPathType` before it looks for a browser, so the
  // runtime singleton has to exist even for the server-side row.
  beforeEach(() => {
    (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
  });

  afterEach(() => {
    if (realWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = realWindow;
    delete (globalThis as { dispatchEvent?: unknown }).dispatchEvent;
    delete (globalThis as { PopStateEvent?: unknown }).PopStateEvent;
  });

  function stubBrowser(open?: (...args: unknown[]) => unknown) {
    const pushed: unknown[] = [];
    (globalThis as { window?: unknown }).window = {
      open: open || (() => ({})),
      history: { pushState: (...args: unknown[]) => pushed.push(args) }
    };
    (globalThis as { dispatchEvent?: unknown }).dispatchEvent = () => undefined;
    (globalThis as { PopStateEvent?: unknown }).PopStateEvent = class {};
    return pushed;
  }

  test('a navigation reports Done then Completed, and Success is gone', async () => {
    const pushed = stubBrowser();
    const graph = await graphWith(NavigateToPathModule, 'PageStackNavigateToPath', { path: '/a' });

    pulse(graph, 'node', 'navigate');
    await graph.settle(3);

    expect(pushed).toHaveLength(1);
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.signalsFor('node')).not.toContain('success');
  });

  test('no Path at all is a Failure carrying its existing code', async () => {
    stubBrowser();
    const graph = await graphWith(NavigateToPathModule, 'PageStackNavigateToPath', {});

    pulse(graph, 'node', 'navigate');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(graph.errors.map((e) => e.code)).toEqual(['navigate-to-path/no-path']);
  });

  test('a server-side render reports Unchanged and raises nothing', async () => {
    delete (globalThis as { window?: unknown }).window;
    const graph = await graphWith(NavigateToPathModule, 'PageStackNavigateToPath', { path: '/a' });

    pulse(graph, 'node', 'navigate');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['unchanged']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('two Navigates coalesced into one pass still report two outcomes', async () => {
    stubBrowser();
    const graph = await graphWith(NavigateToPathModule, 'PageStackNavigateToPath', { path: '/a' });

    const node = graph.node('node');
    node.setInputValue('navigate', false);
    node.setInputValue('navigate', true);
    node.setInputValue('navigate', false);
    node.setInputValue('navigate', true);
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('(pinned control) the port surface is exactly the four outcome signals', () => {
    expect(signalPortsOf(NavigateToPathModule).sort()).toEqual(['completed', 'done', 'failure', 'unchanged']);
  });
});

// =================================================================================================
// Show Popup
// =================================================================================================

describe('ERG-001 §4: Show Popup', () => {
  async function showPopupGraph(
    parameters: Record<string, unknown>,
    showPopup: (...args: unknown[]) => unknown
  ): Promise<CorpusGraph> {
    const graph = await graphWith(ShowPopupModule, 'NavigationShowPopup', parameters);
    (graph.context as unknown as { showPopup: unknown }).showPopup = showPopup;
    return graph;
  }

  test('an opened popup reports Done then Completed, and Closed is untouched', async () => {
    let onClose: ((action: string | undefined, results: Record<string, unknown>) => void) | undefined;
    const graph = await showPopupGraph({ target: '/popup' }, (_t, _p, options: never) => {
      onClose = (options as { onClosePopup: typeof onClose }).onClosePopup;
      return Promise.resolve();
    });

    pulse(graph, 'node', 'show');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);

    // The later event, which is not this invocation's outcome and must not have become one.
    const from = mark(graph, 'node');
    onClose(undefined, {});
    await graph.settle(3);
    expect(graph.signalsFor('node').slice(from)).toEqual(['Closed']);
    expect(outcomesOf(graph, 'node', from)).toEqual([]);
  });

  test('no Target is a Failure carrying its existing code', async () => {
    const graph = await showPopupGraph({}, () => Promise.resolve());

    pulse(graph, 'node', 'show');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['show-popup/no-target']);
  });

  /**
   * ⚠️ The row that holds "report when it has actually opened" in place. `showPopup` rejects for
   * a component that has been deleted or renamed; reporting `Done` optimistically would spend
   * the token and turn this into an `outcome/duplicate`.
   */
  test('a target that cannot be opened is a Failure, and reports exactly once', async () => {
    const graph = await showPopupGraph({ target: '/gone' }, () => Promise.reject(new Error('no such component')));

    pulse(graph, 'node', 'show');
    await graph.settle(4);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['show-popup/target-failed']);
  });

  test('a host that returns no promise still reports Done', async () => {
    const graph = await showPopupGraph({ target: '/popup' }, () => undefined);

    pulse(graph, 'node', 'show');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
  });

  test('(pinned control) Closed and Dismissed survive, and there is no Unchanged', () => {
    expect(signalPortsOf(ShowPopupModule).sort()).toEqual([
      'Closed',
      'Dismissed',
      'completed',
      'done',
      'failure'
    ]);
  });
});
