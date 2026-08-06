/**
 * AAQ-011 **F9** — the Page Router's warning *lifecycle*, which is a different thing from its
 * diagnoses.
 *
 * `nda-012-page-router-reset.test.ts` pins **what** `resetAsync` says: four codes, one per way a
 * reset can fail. Every row there asserts a single reset in isolation, and that is exactly why
 * this defect survived it — the bug is not in any one reset, it is in what the *previous* reset
 * left behind.
 *
 * ## The defect
 *
 * A raise is an **event**. The editor turns it into a **warning**, which is a *predicate*: it
 * stays on the node card and in the Problems panel until something withdraws it. `router.tsx`
 * raised and never withdrew. So a Page Router that was momentarily unconfigured — the mount that
 * runs before its `pages` parameter arrives, which is the ordinary shape of an apply streaming
 * `createNode` ahead of `setParameter` — kept *"This Router has no Pages configured, so it has
 * nothing to show"* for the rest of the session, on a router showing all three of its pages.
 * A permanent, false `⚠ 1` on every wizard-built app.
 *
 * ## Why the chain below is real rather than faked
 *
 * A fake is an unchecked claim, and the claim here is precisely about a hop between two modules:
 * the raise is keyed by `code` by `createEditorWarningSubscriber`, and a clear that names a
 * different string clears nothing (`dbmodelcrudbase.clearWarnings` is the file that learned it).
 * So the rows below drive the **product's own** bus, subscriber, `sendWarning`/`clearWarning` and
 * `ActiveWarnings` — the only stand-in is the WebSocket `send`, which is recorded. `⚠ N` in the
 * topbar counts live warnings, so `liveWarningKeys` is the number the author actually sees.
 *
 * ## Both directions, because only one of them is the fix
 *
 * Clearing on success is trivially "correct" and trivially wrong: a Router that genuinely has no
 * pages must go on warning. Every transient row here has a persistent twin.
 */

/* eslint-env jest */

import type { TSFixme } from '../../typings/global';

import NodeCtor from '@noodl/runtime/src/node';
import { RuntimeErrorBus, createEditorWarningSubscriber } from '@noodl/runtime/src/runtimeerror';

import RouterModule from '../../src/nodes/navigation/router';

import ActiveWarnings = require('@noodl/runtime/src/editorconnection.activewarnings');
import EditorConnection = require('@noodl/runtime/src/editorconnection');

type AnyFn = (...args: unknown[]) => unknown;
type Probe = Record<string, TSFixme>;

/** `resetAsync`'s success path reaches `Noodl.SEO.setTitle` as a bare global. */
beforeAll(() => {
  (globalThis as unknown as { Noodl: unknown }).Noodl = {
    SEO: { setTitle: () => undefined },
    Env: {}
  };
});

const NODE_ID = 'router-1';
const COMPONENT = '/App';
const PAGE = { path: 'home', title: 'Home', component: '/Home' };

interface SentMessage {
  cmd: string;
  content: string;
}

interface RouterProbe {
  instance: Probe;
  /** Every message the connection would have put on the wire, in order. */
  sent: SentMessage[];
  /** The warning keys the editor currently believes are live on this node. */
  liveWarningKeys(): string[];
  /** `showwarning` traffic for this node, decoded, in order. */
  warningTraffic(): Array<{ key: string; cleared: boolean }>;
}

/**
 * A Page Router wired to the real editor-warning channel.
 *
 * ⚠️ The real methods are bound **first** and the collaborators after, the order
 * `nda-012-page-router-reset.test.ts` records: reverse it and a stub overwrites the method under
 * test, and every row passes by doing nothing.
 */
function makeRouter(options: { pages?: { startPage?: string } }): RouterProbe {
  const sent: SentMessage[] = [];

  // The product's own de-duplicating warning ledger and the product's own two senders, bound
  // onto a connection whose only stand-in is the socket.
  const connection = {
    activeWarnings: new ActiveWarnings(),
    send: (message: SentMessage) => sent.push(message)
  } as TSFixme;
  connection.sendWarning = EditorConnection.prototype.sendWarning.bind(connection);
  connection.clearWarning = EditorConnection.prototype.clearWarning.bind(connection);

  const errorBus = new RuntimeErrorBus();
  errorBus.subscribe(createEditorWarningSubscriber(connection));

  const content = { nodeScope: { getNodesWithType: () => [{}] } };

  const instance: Probe = {
    id: NODE_ID,
    name: 'Router',
    _internal: {
      pages: options.pages,
      currentPage: undefined,
      currentPageSnapshot: undefined,
      currentParams: undefined
    },
    context: { editorConnection: connection, errorBus },
    children: [] as unknown[],
    nodeScope: {
      componentOwner: { name: COMPONENT },
      createNode: async () => content,
      deleteNode: () => undefined,
      createPrimitiveNode: () => ({ setStyle() {}, addChild() {} })
    },
    flagOutputDirty() {
      /* currentPageTitle / currentPageComponent */
    }
  };

  const methods = (RouterModule as unknown as { node: { methods: Record<string, AnyFn> } }).node.methods;
  for (const key of Object.keys(methods)) instance[key] = methods[key].bind(instance);

  // The real raise, so the code that reaches the subscriber is the code the node names.
  instance.raiseRuntimeError = (NodeCtor as TSFixme).prototype.raiseRuntimeError.bind(instance);

  instance.getChildren = () => instance.children;
  instance.addChild = (child: unknown) => instance.children.push(child);
  instance.removeChild = (child: unknown) => {
    const i = instance.children.indexOf(child);
    if (i !== -1) instance.children.splice(i, 1);
  };
  instance.scrollToTop = () => undefined;
  instance.matchPageFromUrl = () => undefined;
  instance._updatePageInputs = () => undefined;
  instance.createPageContainer = () => ({ addChild() {} });

  return {
    instance,
    sent,
    liveWarningKeys: () => Object.keys(connection.activeWarnings.currentWarnings.get(NODE_ID) ?? {}),
    warningTraffic: () =>
      sent
        .filter((m) => m.cmd === 'showwarning')
        .map((m) => JSON.parse(m.content) as { key: string; warning?: unknown })
        .map((c) => ({ key: c.key, cleared: c.warning === undefined }))
  };
}

/** `getPageInfoForComponent` reaches `NoodlRuntime.instance` through the handler singleton. */
function withPageInfo(info: unknown, run: () => Promise<void>) {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const handler = require('../../src/nodes/navigation/router-handler').RouterHandler;
  /* eslint-enable @typescript-eslint/no-var-requires */
  const original = handler.instance.getPageInfoForComponent;
  handler.instance.getPageInfoForComponent = () => info;
  return run().finally(() => {
    handler.instance.getPageInfoForComponent = original;
  });
}

describe('F9 — a transient misconfiguration must not leave a permanent warning', () => {
  it('the mount before `pages` arrives warns, and the successful reset withdraws it', async () => {
    const probe = makeRouter({ pages: undefined });

    // 1 — the mount. `pages` has not been applied yet, so the router is, at this instant,
    // genuinely unconfigured and says so. This half was never wrong.
    await probe.instance.resetAsync();
    expect(probe.liveWarningKeys()).toEqual(['router/no-pages']);

    // 2 — the `pages` parameter lands and its setter schedules the reset that succeeds.
    probe.instance._internal.pages = { startPage: '/Home' };
    await withPageInfo(PAGE, () => probe.instance.resetAsync());

    // The router is showing its start page. Nothing about it is wrong, and the editor is told so.
    expect(probe.instance._internal.currentPage).toEqual(PAGE);
    expect(probe.liveWarningKeys()).toEqual([]);
    expect(probe.warningTraffic()).toEqual([
      { key: 'router/no-pages', cleared: false },
      { key: 'router/no-pages', cleared: true }
    ]);
  });

  it('reports the withdrawal under the same key the raise was filed under', async () => {
    // The `dbmodelcrudbase.clearWarnings` lesson, as a row: the subscriber keys the warning by
    // the raised **`code`**, so a clear naming anything else is a clear that clears nothing —
    // and it would look exactly like a fix from inside the router.
    const probe = makeRouter({ pages: undefined });

    await probe.instance.resetAsync();
    probe.instance._internal.pages = { startPage: '/Home' };
    await withPageInfo(PAGE, () => probe.instance.resetAsync());

    const cleared = probe.sent
      .filter((m) => m.cmd === 'showwarning')
      .map((m) => JSON.parse(m.content) as { componentName: string; nodeId: string; key: string; warning?: unknown })
      .filter((c) => c.warning === undefined);

    expect(cleared).toEqual([
      { componentName: COMPONENT, nodeId: NODE_ID, key: 'router/no-pages', warning: undefined }
    ]);
  });

  it('withdraws on `Unchanged` too — a reset onto the page already showing is not a fault', async () => {
    const probe = makeRouter({ pages: undefined });

    await probe.instance.resetAsync();
    expect(probe.liveWarningKeys()).toEqual(['router/no-pages']);

    probe.instance._internal.pages = { startPage: '/Home' };
    await withPageInfo(PAGE, async () => {
      await probe.instance.resetAsync();
      // Second reset: same page, same parameters — `unchanged`, which reports nothing and must
      // still not leave a stale diagnosis standing.
      await probe.instance.resetAsync();
    });

    expect(probe.liveWarningKeys()).toEqual([]);
  });
});

describe('F9 — a genuine misconfiguration must go on warning', () => {
  it('a Router that really has no pages stays warned across every reset', async () => {
    const probe = makeRouter({ pages: undefined });

    await probe.instance.resetAsync();
    await probe.instance.resetAsync();
    await probe.instance.resetAsync();

    // The whole point of the fix's `keep` argument: still warned, and the author's `⚠ 1` is
    // still 1 rather than having flickered to 0 and back twice.
    expect(probe.liveWarningKeys()).toEqual(['router/no-pages']);
    expect(probe.warningTraffic()).toEqual([{ key: 'router/no-pages', cleared: false }]);
  });

  it('a Pages list with no start page stays warned, under its own code', async () => {
    const probe = makeRouter({ pages: {} });

    await probe.instance.resetAsync();
    await probe.instance.resetAsync();

    expect(probe.liveWarningKeys()).toEqual(['router/no-start-page']);
  });

  it('a start page the Router does not own stays warned', async () => {
    const probe = makeRouter({ pages: { startPage: '/Ghost' } });

    await withPageInfo(undefined, async () => {
      await probe.instance.resetAsync();
      await probe.instance.resetAsync();
    });

    expect(probe.liveWarningKeys()).toEqual(['router/page-not-found']);
  });

  it('one live diagnosis at a time — a new fault replaces the old rather than adding to it', async () => {
    // `⚠ N` counts live warnings. Two codes from one node for one fault would read as two
    // problems, and the author would go looking for a second one.
    const probe = makeRouter({ pages: undefined });

    await probe.instance.resetAsync();
    expect(probe.liveWarningKeys()).toEqual(['router/no-pages']);

    probe.instance._internal.pages = {};
    await probe.instance.resetAsync();
    expect(probe.liveWarningKeys()).toEqual(['router/no-start-page']);

    probe.instance._internal.pages = { startPage: '/Ghost' };
    await withPageInfo(undefined, () => probe.instance.resetAsync());
    expect(probe.liveWarningKeys()).toEqual(['router/page-not-found']);
  });
});

describe('F9 — the clear is editor-only and never throws', () => {
  it('a deployed app has no editor connection and resets exactly as before', async () => {
    // `nodecontext.ts` only subscribes `createEditorWarningSubscriber` when there *is* an editor
    // connection, so a deployed app has neither half of the channel. The router must still reset,
    // still diagnose on the error bus (`On App Error` reads it), and reach for nothing that is
    // not there.
    const probe = makeRouter({ pages: undefined });
    const raised: string[] = [];
    const bus = new RuntimeErrorBus();
    bus.subscribe((event) => raised.push(event.code));
    probe.instance.context = { errorBus: bus };

    await expect(probe.instance.resetAsync()).resolves.toBeUndefined();
    expect(raised).toEqual(['router/no-pages']);
    expect(probe.sent).toEqual([]);
  });
});
