import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

import { EventDispatcher } from '../../src/shared/utils/EventDispatcher';

/**
 * FIX-007 fix 4 — the urgent health pass.
 *
 * A wire onto a **runtime-discovered** port is legitimately unresolvable until
 * the running viewer mints the ports and pushes them back (`instanceports` →
 * `setDynamicPorts` → `Model.instancePortsChanged`). Until then
 * `evaluateConnectionHealth` cannot find the target port and raises
 * `con-no-target-port` — correctly, about a wire that is about to be fine.
 *
 * The only route from "the ports arrived" back to "re-check the wire" was
 * `instancePortsChanged` → `scheduleUpdateTypes` (1 ms) → `updateTypes` →
 * `scheduleEvaluateHealth` (**2000 ms**). So a Function-node wire flashed red
 * for two seconds after it became correct, which is what the user in report 4(c)
 * was reacting to when they deleted the connection and drew it again.
 *
 * Two things had to be true for the fix to work, and each has a spec here:
 *
 * 1. An urgent request must **pre-empt** a lazy pass already in flight. The old
 *    `if (this.evaluatehealthScheduled) return` swallowed it — the graph is
 *    almost always mid-debounce during load, which is exactly when ports arrive.
 * 2. The urgent lane must be **gated**, or a viewer pushing ports for a hundred
 *    healthy nodes schedules a hundred graph-wide passes at 50 ms instead of
 *    coalescing into one at 2 s.
 */
describe('FIX-007 fix 4 — ports arriving clear a stale warning without the 2 s wait', () => {
  const COMPONENT = { name: '/Specs/UrgentHealthPass' };

  const CONNECTION = {
    fromId: 'source',
    fromProperty: 'out-text',
    toId: 'fn',
    toProperty: 'in-items'
  };

  let graph: TSFixme;
  let fnNode: TSFixme;

  function node(type: string, id: string) {
    return NodeGraphNode.fromJSON({ type, id, x: 0, y: 0 });
  }

  function warn(connection: TSFixme, key: string) {
    WarningsModel.instance.setWarning(
      { component: COMPONENT, connection, key },
      { message: 'spec warning', level: 'error' }
    );
  }

  beforeEach(() => {
    // WarningsModel is a global singleton; leftovers from another spec would key
    // into this component's slot and decide these assertions.
    WarningsModel.instance.clearAllWarnings();

    graph = new NodeGraphModel();
    graph.owner = COMPONENT;

    fnNode = node('javascript_function', 'fn');
    graph.addRoot(fnNode);
    graph.addRoot(node('layer', 'source'));
    graph.connections.push(CONNECTION);
  });

  afterEach(() => {
    graph.dispose();
    WarningsModel.instance.clearAllWarnings();
  });

  describe('hasUnresolvedPortWarning — the gate on the fast lane', () => {
    it('is true only for a warning that ports arriving could actually clear', () => {
      expect(graph.hasUnresolvedPortWarning('fn')).toBe(false);

      warn(CONNECTION, 'con-no-target-port');
      expect(graph.hasUnresolvedPortWarning('fn')).toBe(true);
    });

    it('answers for the source end too — an `out-` port is minted just as late', () => {
      warn(CONNECTION, 'con-no-source-port');
      expect(graph.hasUnresolvedPortWarning('source')).toBe(true);
    });

    /**
     * The distinction the fix rests on. A type mismatch is a wire that is wrong
     * about types, and a port appearing does not make that verdict stale — so it
     * must not buy a fast pass. Without this the gate degrades into "does this
     * node have any warning at all", which is nearly always true on a graph the
     * user is actively fixing.
     */
    it('is false for a warning ports cannot resolve', () => {
      warn(CONNECTION, 'con-type-mismatch');
      expect(graph.hasUnresolvedPortWarning('fn')).toBe(false);
    });

    it('is false for a node the warned wire does not touch', () => {
      warn(CONNECTION, 'con-no-target-port');
      expect(graph.hasUnresolvedPortWarning('elsewhere')).toBe(false);
    });
  });

  describe('scheduleEvaluateHealth', () => {
    it('runs a lazy pass at 2 s, not before', () => {
      jasmine.clock().install();
      try {
        const evaluate = spyOn(graph, 'evaluateHealth');

        graph.scheduleEvaluateHealth();

        jasmine.clock().tick(1999);
        expect(evaluate).not.toHaveBeenCalled();

        jasmine.clock().tick(2);
        expect(evaluate).toHaveBeenCalledTimes(1);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    /**
     * 🔴 The regression this fix exists to prevent. Before the deadline compare,
     * the urgent request hit `if (scheduled) return` and the pass still landed at
     * 2 s — the fix would have been dead code in the one situation it is for.
     */
    it('lets an urgent request pre-empt a lazy pass already in flight', () => {
      jasmine.clock().install();
      try {
        const evaluate = spyOn(graph, 'evaluateHealth');

        graph.scheduleEvaluateHealth();
        graph.scheduleEvaluateHealth({ urgent: true });

        jasmine.clock().tick(60);
        expect(evaluate).toHaveBeenCalledTimes(1);

        // And the pre-empted lazy timer does not fire a second, pointless pass.
        jasmine.clock().tick(2000);
        expect(evaluate).toHaveBeenCalledTimes(1);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('does not let a lazy request delay an urgent one already in flight', () => {
      jasmine.clock().install();
      try {
        const evaluate = spyOn(graph, 'evaluateHealth');

        graph.scheduleEvaluateHealth({ urgent: true });
        graph.scheduleEvaluateHealth();

        jasmine.clock().tick(60);
        expect(evaluate).toHaveBeenCalledTimes(1);
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });

  describe('the instancePortsChanged listener', () => {
    it('takes the fast lane when the node has a stale unresolved-port warning', () => {
      jasmine.clock().install();
      try {
        const evaluate = spyOn(graph, 'evaluateHealth');
        warn(CONNECTION, 'con-no-target-port');

        EventDispatcher.instance.emit('Model.instancePortsChanged', { model: fnNode });

        jasmine.clock().tick(60);
        expect(evaluate).toHaveBeenCalledTimes(1);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    /**
     * The common case, and the one that keeps the fast lane affordable: ports
     * arriving for a node whose wires are already healthy schedules nothing at
     * all. `scheduleUpdateTypes`' ordinary 1 ms → 2 s route still covers it.
     */
    it('stays on the lazy lane when there is no stale warning to clear', () => {
      jasmine.clock().install();
      try {
        const evaluate = spyOn(graph, 'evaluateHealth');

        EventDispatcher.instance.emit('Model.instancePortsChanged', { model: fnNode });

        jasmine.clock().tick(60);
        expect(evaluate).not.toHaveBeenCalled();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    /**
     * Scoping. `Model.instancePortsChanged` is global — every graph in the
     * project hears every node's ports arrive. Without the `owner === this`
     * check, one Function node's ports would start a health pass in every open
     * component.
     */
    it('ignores a node that belongs to another graph', () => {
      jasmine.clock().install();
      try {
        const evaluate = spyOn(graph, 'evaluateHealth');
        warn(CONNECTION, 'con-no-target-port');

        const otherGraph = new NodeGraphModel();
        const stranger = node('javascript_function', 'fn');
        otherGraph.addRoot(stranger);

        EventDispatcher.instance.emit('Model.instancePortsChanged', { model: stranger });

        jasmine.clock().tick(60);
        expect(evaluate).not.toHaveBeenCalled();

        otherGraph.dispose();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    /**
     * `setDynamicPorts` runs during `ComponentModel.fromJSON` before the owner is
     * assigned — the same window `ViewerConnection` guards for. Reading through
     * the missing graph there once threw a TypeError that aborted the caller.
     */
    it('survives a node that has no graph yet', () => {
      const orphan = node('javascript_function', 'orphan');

      expect(() => EventDispatcher.instance.emit('Model.instancePortsChanged', { model: orphan })).not.toThrow();
    });
  });

  /**
   * A pending pass on a disposed graph walks nodes whose component is gone.
   * Nothing held the timer handle before this fix, so nothing could cancel it.
   */
  it('cancels a pending pass when the graph is disposed', () => {
    jasmine.clock().install();
    try {
      const evaluate = spyOn(graph, 'evaluateHealth');

      graph.scheduleEvaluateHealth({ urgent: true });
      graph.dispose();

      jasmine.clock().tick(2100);
      expect(evaluate).not.toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
