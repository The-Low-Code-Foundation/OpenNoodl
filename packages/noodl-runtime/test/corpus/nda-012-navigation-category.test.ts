/**
 * NDA-012 — the citations for the Navigation category (8 nodes).
 *
 * Everything else in that worksheet is answerable from the source. These are not, and the phase's
 * rule is that an uncited ⚠️ is a suspicion.
 *
 * ## 1. `Page Inputs` had no connectable ports at all — **FIXED**
 *
 * The whole of the module's `setup` was commented out, and had been **since the initial commit**,
 * so `sendDynamicPorts` was never called for this node type. Every real output it has is a `pm-*`
 * announced from there. The runtime half was intact the entire time — the Router calls
 * `_setPageParams` (`router.tsx:298,330`) and `registerOutputIfNeeded` resolves `pm-*` — but a port
 * the editor is never told about cannot be connected to, so the node in the picker
 * (`nodelibraryexport.ts:568`) produced two edit-only stringlists and no way to read a single
 * parameter out of it.
 *
 * This is FINDINGS **CS-i** one step further along: there the node could not be *added*; here it
 * can be added and does nothing.
 *
 * ## 2. A close action latches, so the *next* close reports it too — **FIXED**
 *
 * `Close Popup` wrote `_internal.closeAction` in `closeActionTriggered` and nothing ever cleared
 * it. So once a popup had been closed through, say, `Save`, every later close through the plain
 * `Close` signal handed `Save` back to the Show Popup node — which fires the author's `Save` branch
 * for an interaction the user never made, rather than `Closed`. `Pop Component Stack` has the same
 * shape in `backAction` (`navigate-back.ts`), reported to the node that pushed the component.
 *
 * This is a *third* member of the "one-shot state that is not one-shot" family, and unlike the
 * signal-before-value class it is not an ordering problem: the value is correct when it is first
 * read and wrong on every read after.
 *
 * ## 3. Show Popup's duplicate-port guard compared the wrong string — **FIXED**
 *
 * `showpopup.ts` deduplicated close-action ports with `ports.find((p) => p.name === a)`, where `a`
 * is the bare action name and `p.name` is always the prefixed `closeAction-…`. It therefore never
 * matched and never deduplicated anything; the close-*results* loop next to it had no guard at all.
 * Two Close Popup nodes in one popup declaring the same action — one on a button, one on a
 * backdrop, which is the ordinary way to build a dialog — published two ports with identical names.
 *
 * `navigate.ts:304` is the same guard written correctly, one file over, which is what makes this an
 * oversight rather than a design difference.
 *
 * **Rows 1 and 3 are `setup`-time.** `graph-harness` never calls a node module's `setup` and says
 * so in its own comment, so the editor-derived ports are untested by the ordinary corpus unless the
 * `setup` is driven against a fake graph model. Same shape as NDA-009's J-rows and NDA-010's.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

// The fake `EventEmitter` a module's `setup` subscribes through. Three suites each grew
// their own byte-identical copy of this; it now lives in `setup-harness.ts` beside the
// rest of the same apparatus.
import { emitter } from './setup-harness';
import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ClosePopupModule from '../../../noodl-viewer-react/src/nodes/navigation/closepopup';
import NavigateBackModule from '../../../noodl-viewer-react/src/nodes/navigation/navigate-back';
import PageInputsModule from '../../../noodl-viewer-react/src/nodes/navigation/page-inputs';
import ShowPopupModule from '../../../noodl-viewer-react/src/nodes/navigation/showpopup';

interface RecordedPort {
  name: string;
  displayName?: string;
  type?: unknown;
  plug: string;
  group?: string;
}

/** The minimum of `EventEmitter` that a module's `setup` reaches for. */

type SetupModule = { setup(context: unknown, graphModel: unknown): void };

/* ------------------------------------------------------------------ *
 * 1. Page Inputs announces its parameter outputs
 * ------------------------------------------------------------------ */

/** Drives `page-inputs`' `setup` over one node and records every publish. */
function pageInputPortsFor(parameters: Record<string, unknown>) {
  const publishes: RecordedPort[][] = [];

  const editorConnection = {
    isRunningLocally: () => true,
    sendDynamicPorts(_id: string, published: RecordedPort[]) {
      publishes.push(published);
    }
  };

  const node = Object.assign(emitter(), { id: 'pi-1', type: 'PageInputs', parameters });

  const graphModel = Object.assign(emitter(), {
    components: {},
    getNodesWithType: (type: string) => (type === 'PageInputs' ? [node] : [])
  });

  (PageInputsModule as unknown as SetupModule).setup({ editorConnection }, graphModel);
  graphModel.emit('editorImportComplete');

  return {
    node,
    publishes,
    get ports() {
      return publishes[publishes.length - 1] || [];
    }
  };
}

describe('NDA-012 Navigation — Page Inputs has connectable outputs', () => {
  /**
   * The finding. Before the fix `setup` did not exist on the module at all, so this row does not
   * merely see the wrong ports — the call throws. Re-comment the block and it reddens outright,
   * which is the strongest form the discrimination can take.
   */
  test('a path parameter becomes a pm- output port', () => {
    const { ports } = pageInputPortsFor({ pathParams: 'productId' });

    const port = ports.find((p) => p.name === 'pm-productId');
    expect(port).toBeDefined();
    expect(port?.plug).toBe('output');
    expect(port?.displayName).toBe('productId');
  });

  /** Query parameters share the namespace: the Router hands over one flat map (`router.tsx:272`). */
  test('a query parameter becomes a pm- output port too', () => {
    const { ports } = pageInputPortsFor({ queryParams: 'tab' });

    expect(ports.find((p) => p.name === 'pm-tab')?.plug).toBe('output');
  });

  /**
   * The discrimination row. Because both lists feed one namespace, a name in both is one port —
   * publishing it twice would give the editor two ports with the same name. Without this row the
   * two above would pass on an implementation that simply concatenated the lists.
   */
  test('a name in both lists yields exactly one port', () => {
    const { ports } = pageInputPortsFor({ pathParams: 'id,tab', queryParams: 'tab' });

    expect(ports.filter((p) => p.name === 'pm-tab')).toHaveLength(1);
    expect(ports).toHaveLength(2);
  });

  /** A stringlist the author is mid-way through typing ends in a comma; that is not a port. */
  test('a trailing comma does not announce an unnamed port', () => {
    const { ports } = pageInputPortsFor({ pathParams: 'id,' });

    expect(ports.map((p) => p.name)).toEqual(['pm-id']);
  });

  /** Renaming a parameter has to re-publish, or the old port outlives the name. */
  test('editing the parameter list re-publishes', () => {
    const harness = pageInputPortsFor({ pathParams: 'id' });
    const before = harness.publishes.length;

    harness.node.parameters.pathParams = 'slug';
    harness.node.emit('parameterUpdated', { name: 'pathParams' });

    expect(harness.publishes.length).toBeGreaterThan(before);
    expect(harness.ports.map((p) => p.name)).toEqual(['pm-slug']);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Show Popup deduplicates its derived ports
 * ------------------------------------------------------------------ */

/** A popup component with `n` Close Popup nodes, each declaring the same results/close actions. */
function aPopupWithClosers(count: number, results: string[], closeActions: string[]) {
  const closers = Array.from({ length: count }, (_unused, i) =>
    Object.assign(emitter(), {
      id: 'close-' + i,
      type: 'NavigationClosePopup',
      parameters: {
        ...(results.length ? { results: results.join(',') } : {}),
        ...(closeActions.length ? { closeActions: closeActions.join(',') } : {})
      }
    })
  );

  return Object.assign(emitter(), {
    inputPorts: {},
    outputPorts: {},
    getNodesWithType: (type: string) => (type === 'NavigationClosePopup' ? closers : [])
  });
}

function showPopupPortsFor(component: ReturnType<typeof aPopupWithClosers>) {
  const publishes: RecordedPort[][] = [];

  const editorConnection = {
    isRunningLocally: () => true,
    sendDynamicPorts(_id: string, published: RecordedPort[]) {
      publishes.push(published);
    }
  };

  const showPopupNode = Object.assign(emitter(), {
    id: 'show-1',
    type: 'NavigationShowPopup',
    parameters: { target: '/Popup' }
  });

  const graphModel = Object.assign(emitter(), {
    components: { '/Popup': component },
    getNodesWithType: (type: string) => (type === 'NavigationShowPopup' ? [showPopupNode] : [])
  });

  (ShowPopupModule as unknown as SetupModule).setup({ editorConnection }, graphModel);
  graphModel.emit('editorImportComplete');

  return publishes[publishes.length - 1] || [];
}

describe('NDA-012 Navigation — Show Popup does not publish duplicate ports', () => {
  /**
   * The control. One closer declaring one action still produces exactly one port, so a fix that
   * over-deduplicated — dropping the port entirely — would redden here and not below.
   */
  test('one Close Popup node declaring an action gives one port', () => {
    const ports = showPopupPortsFor(aPopupWithClosers(1, [], ['confirm']));

    expect(ports.filter((p) => p.name === 'closeAction-confirm')).toHaveLength(1);
  });

  /**
   * The finding. The guard compared the bare `confirm` against the prefixed `closeAction-confirm`,
   * so it never fired. Restore `p.name === a` and this row reddens on a length of 2 while the
   * control above stays green.
   */
  test('two Close Popup nodes declaring the same action still give one port', () => {
    const ports = showPopupPortsFor(aPopupWithClosers(2, [], ['confirm']));

    expect(ports.filter((p) => p.name === 'closeAction-confirm')).toHaveLength(1);
  });

  /** The results loop had no guard at all, where `navigate.ts:318` carries one for `backResult-`. */
  test('two Close Popup nodes declaring the same result still give one port', () => {
    const ports = showPopupPortsFor(aPopupWithClosers(2, ['chosenId'], []));

    expect(ports.filter((p) => p.name === 'closeResult-chosenId')).toHaveLength(1);
  });

  /**
   * The discrimination row for the dedupe itself: two *different* actions from two closers must
   * both survive. Without it, a guard that deduplicated on the wrong key — or simply kept the
   * first port it saw — would pass both rows above.
   */
  test('two Close Popup nodes declaring different actions give both ports', () => {
    const component = aPopupWithClosers(1, [], ['confirm']);
    const second = Object.assign(emitter(), {
      id: 'close-2',
      type: 'NavigationClosePopup',
      parameters: { closeActions: 'cancel' }
    });
    const closers = component.getNodesWithType('NavigationClosePopup').concat([second]);
    component.getNodesWithType = (type: string) => (type === 'NavigationClosePopup' ? closers : []);

    const ports = showPopupPortsFor(component);

    expect(ports.filter((p) => p.name === 'closeAction-confirm')).toHaveLength(1);
    expect(ports.filter((p) => p.name === 'closeAction-cancel')).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * 2. The latched close / back action
 * ------------------------------------------------------------------ */

interface TriggerInstance extends NodeInstance {
  fire(port: string): void;
}

/**
 * Two signal outputs, fired on demand.
 *
 * The action ports have to be driven over a **wire**: `closeAction-Save` and `backAction-Save` are
 * runtime-discovered, and `registerInputIfNeeded` only runs when a connection targets them, so
 * `setInputValue` on one is a no-op that logs and returns. Banked from the Event Sender row in
 * `nda-012-small-categories.test.ts`.
 */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.NavTrigger',
    category: 'Logic',
    outputs: {
      action: { type: 'signal' },
      plain: { type: 'signal' }
    },
    methods: {
      fire(this: NodeInstance, port: string) {
        this.sendSignalOnOutput(port);
      }
    }
  }
};

/** What the popup / stack layer was handed when the node was asked to close or pop. */
interface HandedBack {
  action: string | undefined;
  results: Record<string, unknown>;
}

describe('NDA-012 Navigation — a close action does not latch onto the next close', () => {
  async function popupGraph(): Promise<{ graph: CorpusGraph; handled: HandedBack[] }> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, ClosePopupModule as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.NavTrigger' },
              { id: 'close', type: 'NavigationClosePopup' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'action', targetId: 'close', targetPort: 'closeAction-Save' },
              { sourceId: 'trigger', sourcePort: 'plain', targetId: 'close', targetPort: 'close' }
            ]
          }
        ]
      } as never
    });

    // Standing in for the popup layer. `resolvePopup` prefers a handed-down callback whenever
    // `Popup` is unset, so this is the same path a real popup takes.
    const handled: HandedBack[] = [];
    (graph.node('close') as unknown as { _setCloseCallback(cb: unknown): void })._setCloseCallback(
      (action: string | undefined, results: Record<string, unknown>) => {
        handled.push({ action, results });
      }
    );

    await graph.settle(3);
    return { graph, handled };
  }

  /** The control: a close action reaches the popup layer at all, so a silent row below would mean something. */
  test('a close action is reported to the popup layer', async () => {
    const { graph, handled } = await popupGraph();

    graph.node<TriggerInstance>('trigger').fire('action');
    await graph.settle(6);

    expect(handled).toHaveLength(1);
    expect(handled[0].action).toBe('closeAction-Save');
  });

  /** The control's other half: a plain close, with no action ever fired, reports no action. */
  test('a plain close with no action reports no action', async () => {
    const { graph, handled } = await popupGraph();

    graph.node<TriggerInstance>('trigger').fire('plain');
    await graph.settle(6);

    expect(handled).toHaveLength(1);
    expect(handled[0].action).toBeUndefined();
  });

  /**
   * The finding. Restore the read of `this._internal.closeAction` without clearing it and this row
   * reddens on `'closeAction-Save'` while both controls above stay green — which is what makes it a
   * test of the latch rather than of the wiring.
   */
  test('a plain close after a close action does not repeat that action', async () => {
    const { graph, handled } = await popupGraph();

    graph.node<TriggerInstance>('trigger').fire('action');
    await graph.settle(6);
    graph.node<TriggerInstance>('trigger').fire('plain');
    await graph.settle(6);

    expect(handled).toHaveLength(2);
    expect(handled[0].action).toBe('closeAction-Save');
    expect(handled[1].action).toBeUndefined();
  });
});

describe('NDA-012 Navigation — a back action does not latch onto the next pop', () => {
  async function stackGraph(): Promise<{ graph: CorpusGraph; handled: HandedBack[] }> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, NavigateBackModule as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.NavTrigger' },
              { id: 'back', type: 'PageStackNavigateBack' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'action', targetId: 'back', targetPort: 'backAction-Save' },
              { sourceId: 'trigger', sourcePort: 'plain', targetId: 'back', targetPort: 'navigate' }
            ]
          }
        ]
      } as never
    });

    const handled: HandedBack[] = [];
    (graph.node('back') as unknown as { _setBackCallback(cb: unknown): void })._setBackCallback(
      (args: { backAction: string | undefined; results: Record<string, unknown> }) => {
        handled.push({ action: args.backAction, results: args.results });
        return { ok: true };
      }
    );

    await graph.settle(3);
    return { graph, handled };
  }

  /** The control. */
  test('a back action is reported to the stack', async () => {
    const { graph, handled } = await stackGraph();

    graph.node<TriggerInstance>('trigger').fire('action');
    await graph.settle(6);

    expect(handled).toHaveLength(1);
    expect(handled[0].action).toBe('backAction-Save');
  });

  /** The finding, in the second node that carries the shape. */
  test('a plain pop after a back action does not repeat that action', async () => {
    const { graph, handled } = await stackGraph();

    graph.node<TriggerInstance>('trigger').fire('action');
    await graph.settle(6);
    graph.node<TriggerInstance>('trigger').fire('plain');
    await graph.settle(6);

    expect(handled).toHaveLength(2);
    expect(handled[0].action).toBe('backAction-Save');
    expect(handled[1].action).toBeUndefined();
  });
});
