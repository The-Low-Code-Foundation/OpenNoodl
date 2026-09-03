/**
 * DEF-042 (phase 80) — **a throwing event listener takes the whole backend process with it.**
 *
 * Promoted from `UNOWNED-ROWS-TO-MEASURE.md §2`. Reproduced at HEAD 2026-09-03 against the
 * committed `dist/cli.js`, no editor involved:
 *
 *   PUT /admin/workflows/projectA  → 200 {"success":true}
 *   PUT /admin/workflows/projectB  → **no response at all**; the process is gone, exit 1
 *   GET /admin/status              → connection refused
 *
 * with `Error: Duplicate component name /#__cloud__/site/SetSectionAccess` on stderr.
 *
 * 🔴 **The row's proposed fix is already in the tree and cannot see this.** `WorkflowRunner.
 * loadWorkflow` has wrapped `await candidateRunner.load(bundle)` in a try/catch since WFA-001 —
 * verified in the built bundle, not just the source — and it is written precisely to answer this
 * case ("previous version left in place"). It never ran: **no `Failed to load workflow projectB`
 * line appears in the log before the crash.**
 *
 * The reason is the mechanism these tests pin. `EventSender.prototype.emit` is **async** — it
 * awaits each listener — and `GraphModel.addComponent` is **synchronous** and calls it without
 * awaiting. The listener registered by `registerGraphModelListeners` throws
 * `Duplicate component name`; that throw rejects a promise **nobody is holding**, so it never
 * reaches the awaited chain `loadWorkflow` is watching, and Node terminates the process on the
 * unhandled rejection instead.
 *
 * ⚠️ **`graphmodel.ts` has 15 un-awaited `this.emit(...)` calls.** `componentAdded` is the one a
 * person has met; every other one is the same hazard with a different listener.
 */

import EventSender = require('../../noodl-runtime/src/eventsender');

describe('DEF-042 — an async emit called synchronously detaches its rejection', () => {
  it('emit is async, which is the precondition for everything below', () => {
    const sender = new (EventSender as any)();
    sender.on('x', () => undefined);

    // If this ever stops being a promise, the hazard is gone and these tests should be revisited
    // rather than deleted — they would be asserting a mechanism that no longer exists.
    expect(sender.emit('x', {})).toBeInstanceOf(Promise);
  });

  it('CONTROL: an AWAITED emit delivers a throwing listener to the caller, as loadWorkflow expects', async () => {
    const sender = new (EventSender as any)();
    sender.on('componentAdded', () => {
      throw new Error('Duplicate component name /#__cloud__/site/SetSectionAccess');
    });

    // This is the arm that proves the try/catch in `loadWorkflow` is correctly written: when the
    // rejection reaches it, it does exactly its job. The defect is that it never arrives.
    await expect(sender.emit('componentAdded', {})).rejects.toThrow('Duplicate component name');
  });

  it('🔴 an UN-AWAITED emit strands the rejection where no caller can catch it', async () => {
    const sender = new (EventSender as any)();
    sender.on('componentAdded', () => {
      throw new Error('Duplicate component name /#__cloud__/site/SetSectionAccess');
    });

    let caughtByCaller: unknown = null;

    /**
     * The promise `addComponent` throws away, kept here only so the test can look at it.
     *
     * ⚠️ **Observing it rather than waiting for `process.on('unhandledRejection')` is deliberate**:
     * jest installs its own handler, so that event never reaches a listener inside the suite and
     * an arm written that way measures the harness instead of the product. The process-level
     * consequence was measured where it actually happens — against the committed `dist/cli.js`,
     * where PUT 2 killed the backend with exit 1. This arm pins the *mechanism* that causes it.
     */
    let dropped: Promise<unknown> | undefined;

    // Exactly what `GraphModel.addComponent` does: a synchronous function that calls the async
    // emit and does not await it.
    function addComponentAsItIsWrittenToday() {
      dropped = sender.emit('componentAdded', {});
    }

    // …and exactly what `loadWorkflow` does around it.
    try {
      await (async () => {
        addComponentAsItIsWrittenToday();
      })();
    } catch (e) {
      caughtByCaller = e;
    }

    // The caller's try/catch sees nothing at all — which is why `loadWorkflow`'s catch,
    // correct as it is, never runs and the PUT never answers.
    expect(caughtByCaller).toBeNull();

    // And the rejection is real. In the backend process nobody is holding this, so Node prints
    // the error and exits 1 instead of the request returning 500.
    await expect(dropped).rejects.toThrow('Duplicate component name');
  });
});
