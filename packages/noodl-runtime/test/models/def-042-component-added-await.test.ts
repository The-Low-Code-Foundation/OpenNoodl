/**
 * DEF-042 — **a throwing `componentAdded` listener must reach the caller, not the process.**
 *
 * `GraphModel.addComponent` ended with an un-awaited `this.emit('componentAdded', …)`. `emit` is
 * async, so a listener that threw rejected a promise **nobody was holding**, Node turned that into
 * an unhandled rejection, and the backend process ended — mid-`PUT`, with no HTTP response, taking
 * every other project's cloud functions with it.
 *
 * The listener is real and shipped: `NoodlRuntime.registerGraphModelListeners` subscribes to
 * `componentAdded` and calls `NodeContext.registerComponentModel`, which throws
 * `Duplicate component name` when two bundles declare the same one. **This suite wires the product's
 * own listener, in the product's own words**, rather than a stand-in that merely throws — a
 * hand-written `throw` arm alone would pass on a fix that made only hand-written throws reachable.
 *
 * ## What this suite can and cannot say
 *
 * ⚠️ **It cannot measure the crash.** Killing the process is a *process*-level consequence, and
 * jest installs its own `unhandledRejection` handler — s43's first attempt at this waited on that
 * event and ended up measuring the harness. So the crash is driven against the built `dist/cli.js`
 * over real HTTP, and the readings are recorded on the task row. What this suite pins is the seam:
 * whether the rejection **reaches an awaiting caller**, which is the whole difference.
 *
 * 🔴 **The last arm is a BOUND, not a pass.** The other 15 emits in `graphmodel.ts` are still
 * un-awaited, and it measures one of them so the code and the row cannot drift apart about it.
 *
 * ⚠️ **Reading the REVERTED arm:** with the two `await`s removed this file reports **4 red**, and
 * two of those reds are the first two arms' dropped promises **attributed to the last test** —
 * jest pins an unhandled rejection on whichever test happens to be running when it surfaces. That
 * is the defect demonstrating itself, but it makes the reverted run's attribution noisy; the
 * fixed run has no stray rejection at all (5/5, clean). Do not "fix" the noise by removing the
 * throwing arms.
 */

import GraphModel = require('../../src/models/graphmodel');
import NodeContext = require('../../src/nodecontext');

/** A component with one node, so `addComponent`'s `nodeAdded` pass has something to announce. */
function componentData(name: string) {
  return {
    id: name,
    name,
    ports: [],
    nodes: [{ id: `${name}-node`, type: 'Group', parameters: {}, ports: [], children: [] }],
    connections: [],
    roots: [`${name}-node`]
  };
}

/**
 * The subscription `NoodlRuntime.registerGraphModelListeners` makes, copied deliberately rather
 * than imported: importing `noodl-runtime.ts` pulls in the whole runtime and its browser
 * assumptions, and what is under test is the *seam*, not the wiring. ⚠️ If that function's shape
 * changes, this line has to follow it — it is named in the header for that reason.
 */
function wireRealListener(graphModel: any, context: any) {
  graphModel.on('componentAdded', (component: unknown) => context.registerComponentModel(component));
}

describe('DEF-042 — a throwing componentAdded listener reaches the caller', () => {
  it('🔴 the real listener: a duplicate component name REJECTS the import, in its own words', async () => {
    const graphModel: any = new GraphModel();
    const context: any = new NodeContext();
    wireRealListener(graphModel, context);

    // The presence control rides on the same object: the first import must SUCCEED, or the
    // rejection below would be evidence of nothing.
    await graphModel.importComponentFromEditorData(componentData('/#__cloud__/site/SetSectionAccess'));

    await expect(
      graphModel.importComponentFromEditorData(componentData('/#__cloud__/site/SetSectionAccess'))
    ).rejects.toThrow('Duplicate component name /#__cloud__/site/SetSectionAccess');
  });

  it('a caller\'s own try/catch contains it — which is what `loadWorkflow` relies on', async () => {
    const graphModel: any = new GraphModel();
    graphModel.on('componentAdded', () => {
      throw new Error('listener said no');
    });

    // Written as a try/catch rather than `.rejects` on purpose: `WorkflowRunner.loadWorkflow`
    // catches around `await candidateRunner.load(bundle)`, and this is that shape.
    let caught: unknown = null;
    try {
      await graphModel.importComponentFromEditorData(componentData('/Pages/Home'));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('listener said no');
  });

  it('CONTROL: with no listener throwing, the import resolves and the component is registered', async () => {
    const graphModel: any = new GraphModel();
    const context: any = new NodeContext();
    wireRealListener(graphModel, context);

    await expect(graphModel.importComponentFromEditorData(componentData('/Pages/Home'))).resolves.toBeUndefined();
    expect(graphModel.getComponentWithName('/Pages/Home')).toBeTruthy();
    // Registered in the context too — the listener ran, rather than the emit being skipped.
    expect(context.componentModels['/Pages/Home']).toBeTruthy();
  });

  it('a SLOW componentAdded listener has finished by the time the import resolves', async () => {
    // The ordering the fix buys, and the thing a future un-`await` would silently undo. Before
    // DEF-042 the first listener ran synchronously and the rest in microtasks that interleaved
    // with the caller's own `await`, so "registration has finished" was assumed without being true.
    const graphModel: any = new GraphModel();
    let finished = false;
    graphModel.on('componentAdded', async () => {
      await new Promise((r) => setTimeout(r, 20));
      finished = true;
    });

    await graphModel.importComponentFromEditorData(componentData('/Pages/Home'));
    expect(finished).toBe(true);
  });

  it('⚠️ BOUND: `nodeAdded` is still NOT awaited — the class is narrowed, not closed', async () => {
    // `addComponent` announces existing nodes through a synchronous `forEach(_onNodeAdded)`, and
    // `_onNodeAdded` emits without awaiting. Measured here rather than asserted in prose so that
    // the row and the code cannot drift: the day somebody awaits these too, this spec fails and
    // says so in its own name.
    const graphModel: any = new GraphModel();
    let finished = false;
    graphModel.on('nodeAdded', async () => {
      await new Promise((r) => setTimeout(r, 20));
      finished = true;
    });

    await graphModel.importComponentFromEditorData(componentData('/Pages/Home'));
    expect(finished).toBe(false);

    // …and the control that says the listener was really subscribed and really ran, so the `false`
    // above is "not awaited" and not "never called".
    await new Promise((r) => setTimeout(r, 40));
    expect(finished).toBe(true);
  });
});
