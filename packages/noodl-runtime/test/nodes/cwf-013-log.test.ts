/**
 * The Log node (CWF-013), in the shared runtime.
 *
 * The half this suite holds is *destination selection*: one node, two destinations, chosen by
 * whether the runtime attached a `log` sink to the run — not by an `if (cloud)` inside the node.
 * The cloud half (the structured logger, the request id, the execution record and the redaction
 * that is the point of the whole task) is driven end to end in
 * `nodegx-backend/tests/cloud-log-node.test.ts`, because none of it exists in this package.
 */

import { createNode } from '../helpers/node-harness';

import LogModule = require('../../src/nodes/std-library/log');

interface Sunk {
  level: string;
  message: string;
  data?: unknown;
  nodeId?: string;
}

/** A node with a run context attached, the way the cloud runner attaches one per request. */
function nodeWithSink() {
  const sunk: Sunk[] = [];
  const node = createNode(LogModule, 'net.noodl.Log');
  (node.node as unknown as { nodeScope: Record<string, unknown> }).nodeScope = {
    runContext: { log: (entry: Sunk) => sunk.push(entry), requestId: 'req-1' }
  };
  return { node, sunk };
}

describe('Log (CWF-013)', () => {
  it('writes nothing until the Log signal fires', () => {
    const { node, sunk } = nodeWithSink();
    node.node.setInputValue('message', 'hello');
    node.context.updateDirtyNodes();
    expect(sunk).toEqual([]);
  });

  it('sends the line to the run s sink, at info, with NO default setter having run', () => {
    // ⚠️ A declared `default` never runs its setter. `initialize` is what actually sets `info`,
    // and if that line is deleted this node starts logging at `undefined` — which the backend
    // logger would drop on the floor, silently. This is the test that says so.
    const { node, sunk } = nodeWithSink();
    node.node.setInputValue('message', 'the thing happened');
    node.pulse('log');
    node.context.updateDirtyNodes();

    expect(sunk).toEqual([{ level: 'info', message: 'the thing happened', nodeId: 'net.noodl.Log-1' }]);
    expect(node.signals).toContain('done');
    expect(node.signals).toContain('completed');
  });

  it('carries the level and the data object', () => {
    const { node, sunk } = nodeWithSink();
    node.node.setInputValue('level', 'warn');
    node.node.setInputValue('message', 'careful');
    node.node.setInputValue('data', { orderId: 7 });
    node.pulse('log');
    node.context.updateDirtyNodes();

    expect(sunk[0].level).toBe('warn');
    expect(sunk[0].data).toEqual({ orderId: 7 });
  });

  it('falls back to info when the Level port is cleared to an empty string', () => {
    // The `length || 32` shape: a port cleared in the property panel arrives as '', not as the
    // declared default, and an unrecognised level would be dropped by the backend logger.
    const { node, sunk } = nodeWithSink();
    node.node.setInputValue('level', '');
    node.node.setInputValue('message', 'still logged');
    node.pulse('log');
    node.context.updateDirtyNodes();
    expect(sunk[0].level).toBe('info');
  });

  it('passes Value through untouched, so it can sit inline on a wire', () => {
    const { node } = nodeWithSink();
    const payload = { keep: 'me' };
    node.node.setInputValue('value', payload);
    node.context.updateDirtyNodes();
    expect(node.out('value')).toBe(payload);
  });

  it('logs an empty message rather than the string "undefined" when nothing was set', () => {
    const { node, sunk } = nodeWithSink();
    node.pulse('log');
    node.context.updateDirtyNodes();
    expect(sunk[0].message).toBe('');
  });

  describe('with no sink — the browser', () => {
    it('goes to the console at the matching level, with no cloud guard anywhere in the node', () => {
      const node = createNode(LogModule, 'net.noodl.Log');
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        node.node.setInputValue('level', 'warn');
        node.node.setInputValue('message', 'in a browser');
        node.pulse('log');
        node.context.updateDirtyNodes();
        expect(spy).toHaveBeenCalledWith('in a browser');
      } finally {
        spy.mockRestore();
      }
      expect(node.signals).toContain('done');
    });

    it('passes the data object as the console s second argument', () => {
      const node = createNode(LogModule, 'net.noodl.Log');
      const spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
      try {
        node.node.setInputValue('message', 'with data');
        node.node.setInputValue('data', { a: 1 });
        node.pulse('log');
        node.context.updateDirtyNodes();
        expect(spy).toHaveBeenCalledWith('with data', { a: 1 });
      } finally {
        spy.mockRestore();
      }
    });
  });
});
