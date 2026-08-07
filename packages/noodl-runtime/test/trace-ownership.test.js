const NodeContext = require('../src/nodecontext');

/**
 * HUD-004 — the trace has owners.
 *
 * The trace was **one global boolean** on the NodeContext and the message that set it carried no
 * identity at all. Two peers share that switch — the editor's Record button and
 * `nodegx-observe`'s `start_trace` — and two things followed, both live and neither noticed on
 * purpose:
 *
 *  1. an agent's `stop_trace` disarmed a human's recording, silently; and
 *  2. an agent's `start_trace` **destroyed** it — `setTraceEnabled(true)` replaced the buffer
 *     unconditionally, so arming while somebody else was mid-recording deleted everything they
 *     had captured.
 *
 * The second one is data loss rather than confusion, and it is the reason this file exists. What
 * is asserted here is the *lifetime of the buffer*, not the boolean: a fix that made the boolean
 * a set and still recreated the buffer on every arm would pass a "capture is still on" test and
 * lose the recording anyway.
 */
describe('trace ownership', () => {
  function context() {
    const ctx = new NodeContext();
    // The dictionary send on arming is the only thing that reaches for a connection.
    ctx.editorConnection = undefined;
    // `traceEdgeSend` stamps `platform.getCurrentTime()` on every event. ⚠️ It is
    // `performance.now()` in the real viewer — milliseconds since the *preview page* loaded and
    // not a wall clock — which is why nothing in this suite compares it to `Date.now()`.
    let clock = 0;
    ctx.platform = { getCurrentTime: () => ++clock };
    return ctx;
  }

  /** One edge event, so a buffer has something in it to lose. */
  function record(ctx, port) {
    return ctx.traceEdgeSend('button', port, 'counter', 'increment', 'signal', 'signal');
  }

  it("does not destroy another owner's recording when a second peer arms", () => {
    const ctx = context();

    ctx.setTraceEnabled(true, 'editor-1');
    record(ctx, 'click');
    record(ctx, 'click');
    expect(ctx.getTraceEvents().length).toBe(2);

    // The agent arrives mid-recording. This is the line that used to be data loss.
    ctx.setTraceEnabled(true, 'observe-1');

    expect(ctx.getTraceEvents().length).toBe(2);
    expect(ctx.traceEnabled).toBe(true);
  });

  it("does not let one peer's stop disarm another peer's recording", () => {
    const ctx = context();

    ctx.setTraceEnabled(true, 'editor-1');
    ctx.setTraceEnabled(true, 'observe-1');
    record(ctx, 'click');

    ctx.setTraceEnabled(false, 'observe-1');

    // Still capturing, and still holding what it had.
    expect(ctx.traceEnabled).toBe(true);
    record(ctx, 'click');
    expect(ctx.getTraceEvents().length).toBe(2);
  });

  it('drops the buffer only when the last owner leaves', () => {
    const ctx = context();

    ctx.setTraceEnabled(true, 'editor-1');
    ctx.setTraceEnabled(true, 'observe-1');
    record(ctx, 'click');

    ctx.setTraceEnabled(false, 'editor-1');
    expect(ctx.traceEnabled).toBe(true);

    ctx.setTraceEnabled(false, 'observe-1');
    expect(ctx.traceEnabled).toBe(false);
    // Dropped, rather than merely stopped — the storage is not held by an app nobody is
    // debugging, which is the invariant OBS-001 set.
    expect(ctx.getTraceEvents()).toEqual([]);
    expect(ctx.traceEdgeSend('a', 'out', 'b', 'in', 'x', 'value')).toBe(0);
  });

  it('releases a peer that went away without disarming', () => {
    const ctx = context();

    ctx.setTraceEnabled(true, 'editor-1');
    ctx.setTraceEnabled(true, 'observe-1');

    // The MCP process was killed; the relay says so on its behalf.
    ctx.releaseTraceOwner('observe-1');
    expect(ctx.traceEnabled).toBe(true);

    // ⚠️ And the human's Stop now actually stops. Without the release above the set never
    // empties and this line does nothing at all — the failure that makes a crashed agent trace
    // forever.
    ctx.setTraceEnabled(false, 'editor-1');
    expect(ctx.traceEnabled).toBe(false);
  });

  it('ignores a release with no owner, rather than disarming the anonymous one', () => {
    const ctx = context();

    ctx.setTraceEnabled(true);
    ctx.releaseTraceOwner(undefined);
    ctx.releaseTraceOwner('');

    expect(ctx.traceEnabled).toBe(true);
  });

  it('behaves exactly as before for a peer that sends no owner', () => {
    const ctx = context();

    ctx.setTraceEnabled(true);
    record(ctx, 'click');
    expect(ctx.getTraceEvents().length).toBe(1);

    // One legacy key: a second anonymous arm is the same owner arming twice, so it is a no-op
    // rather than a buffer replacement — which is a strict improvement and not a regression,
    // because the only peer that could have been the "other" anonymous one is now named.
    ctx.setTraceEnabled(true);
    expect(ctx.getTraceEvents().length).toBe(1);

    ctx.setTraceEnabled(false);
    expect(ctx.traceEnabled).toBe(false);
    expect(ctx.getTraceEvents()).toEqual([]);
  });

  describe('getTraceState', () => {
    it('reports nothing held and nothing written before anyone arms', () => {
      const ctx = context();
      expect(ctx.getTraceState()).toEqual({ enabled: false, owners: [], highestSeq: 0 });
    });

    it('reports the owners and where the buffer has got to', () => {
      const ctx = context();

      ctx.setTraceEnabled(true, 'editor-1');
      ctx.setTraceEnabled(true, 'observe-1');
      record(ctx, 'click');
      record(ctx, 'click');

      const state = ctx.getTraceState();
      expect(state.enabled).toBe(true);
      expect(state.owners.slice().sort()).toEqual(['editor-1', 'observe-1']);
      // ⚠️ The **last seq assigned**, not the next one. A peer joining reads from after this, so
      // an off-by-one here hands it somebody else's last event or hides its own first.
      expect(state.highestSeq).toBe(2);
      expect(ctx.getTraceEvents(state.highestSeq)).toEqual([]);
    });
  });
});
