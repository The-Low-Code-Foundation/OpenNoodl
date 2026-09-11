/**
 * DEF-033 — `Substring`'s `End` port: the number the panel shows must be the number the node
 * is holding.
 *
 * ⚠️ **A declared `default:` never runs its setter.** `registerInput` writes `input.default`
 * straight into `_inputValues`; the setter is only reached from `setInputValue`. So the port's
 * declaration is what the property panel (and the node catalog) displays, and `initialize`'s
 * write is what `result`'s getter reads. Before this fix the declaration said `0` and
 * `initialize` wrote `-1` — opposite answers, not a near-miss: `-1` is "the rest of the
 * string", `0` is `''` for every input. The panel showed a number the node was not holding.
 *
 * Richard's ruling (2026-08-31, P80 lane, relayed to P18): *"just make it show the truth."*
 * The declaration moved to `-1`; the node's behaviour did not move.
 *
 * 🔴 **`result` cannot grade this fix.** A row that watches `result` passes identically before
 * and after, because the getter never read the declaration. The two rows that grade it are the
 * first two below: the declaration equals what `initialize` wrote, and the description no longer
 * explains the mismatch. The `result` rows are the control — they pin the behaviour that must
 * NOT have moved.
 */

import { createNode } from '../helpers/node-harness';

import SubstringModule = require('../../src/nodes/std-library/substring');

type Internal = { _internal: { startIndex: number; endIndex: number } };

function ports() {
  return SubstringModule.node.inputs as Record<string, { default?: unknown; description?: string }>;
}

function send(node: ReturnType<typeof createNode>['node'], values: Record<string, unknown>) {
  for (const name of Object.keys(values)) {
    node.registerInputIfNeeded(name);
    node.queueInput(name, values[name]);
  }
  node.update();
}

describe('Substring — the declared End default (DEF-033)', () => {
  it('declares the same End that initialize writes, so the panel shows the number that runs', () => {
    const sub = createNode(SubstringModule, 'Substring');
    const internal = (sub.node as unknown as Internal)._internal;

    // Both halves are read, neither is assumed: the declaration the panel renders and the
    // state the getter answers from. Before the fix these were 0 and -1.
    expect(ports().end.default).toBe(internal.endIndex);
    expect(ports().end.default).toBe(-1);
    // `Start` was never in question; it is the control that the harness reads declarations.
    expect(ports().start.default).toBe(internal.startIndex);
    expect(ports().start.default).toBe(0);
  });

  it('no longer describes End as a port to leave unset because 0 yields nothing', () => {
    const description = String(ports().end.description);
    expect(description).toContain('-1');
    expect(description).not.toMatch(/leave it unset/i);
  });

  // ── Controls: the behaviour that must not have moved ──────────────────────────────────

  it('control: an untouched End still returns the rest of the string', () => {
    const sub = createNode(SubstringModule, 'Substring');
    send(sub.node, { string: 'hello', start: 1 });
    expect(sub.out('result')).toBe('ello');
  });

  it('control: an explicit End of 0 still yields the empty string — the opposite answer', () => {
    const sub = createNode(SubstringModule, 'Substring');
    send(sub.node, { string: 'hello', start: 0, end: 0 });
    expect(sub.out('result')).toBe('');
  });

  it('control: an explicit End of -1 sent through the setter is the same answer as untouched', () => {
    const sub = createNode(SubstringModule, 'Substring');
    send(sub.node, { string: 'hello', start: 2, end: -1 });
    expect(sub.out('result')).toBe('llo');
  });
});
