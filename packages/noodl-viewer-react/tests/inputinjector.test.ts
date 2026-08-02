/**
 * OBS-004 — the input injector's resolution and reporting rules.
 *
 * What is worth pinning here is not "does dispatchEvent work" — it does — but the answers
 * this gives when the address is ambiguous or unreachable, because those answers are read by
 * an agent that cannot see the screen and will act on whatever it is told. A result that said
 * only "ok" for a click that landed on one of seven repeater rows would be a confidently
 * wrong answer of exactly the kind that got the last debug panel retired.
 *
 * `testEnvironment: 'node'`, so there is no DOM here — and there is no `jest-environment-jsdom`
 * in this tree. Rather than add one, the event constructors are shimmed below. That turns out
 * to be the better instrument for the one behaviour worth asserting about the dispatch, which
 * is the **sequence**: a lone `click` is what `element.click()` gives you, and it leaves a
 * component that tracks press state in a condition no real user can produce. The shim records
 * the order; a jsdom run would only tell us the events reached the element.
 *
 * Whether React's handlers actually run is not knowable in either environment and is verified
 * live against a running preview.
 */

import { performInput, resolveTargets } from '../src/inputinjector';

class FakeEvent {
  type: string;
  init: Record<string, unknown>;
  constructor(type: string, init: Record<string, unknown> = {}) {
    this.type = type;
    this.init = init;
  }
}

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.MouseEvent = FakeEvent;
  g.Event = FakeEvent;
  // ⚠️ `PointerEvent` is deliberately left undefined for most of this file, so the guard
  // around it is exercised in the branch that Safari and older WebViews actually take. One
  // test defines it to cover the other branch.
  delete g.PointerEvent;
});

/** A node that renders something. */
function visual(element: unknown) {
  return { getDOMElement: () => element };
}

/** A node that does not — a Variable, a Counter, a Cloud Function. */
function invisible() {
  return { getDOMElement: () => null };
}

function runtimeWith(nodes: Record<string, unknown[]>) {
  return {
    rootComponent: {
      nodeScope: {
        getNodesWithIdRecursive: (id: string) => (nodes[id] || []) as never
      }
    }
  };
}

/** Enough of an element for the message paths; the DOM ones are exercised live. */
function fakeElement(tagName: string) {
  return {
    tagName,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }),
    dispatchEvent: jest.fn(),
    focus: jest.fn()
  };
}

describe('resolving a target', () => {
  it('finds every rendered instance of a node id', () => {
    const a = fakeElement('DIV');
    const b = fakeElement('DIV');
    const runtime = runtimeWith({ n1: [visual(a), visual(b)] });

    expect(resolveTargets(runtime, { nodeId: 'n1' })).toEqual([a, b]);
  });

  it('drops instances that render nothing', () => {
    const a = fakeElement('DIV');
    const runtime = runtimeWith({ n1: [visual(a), invisible()] });

    expect(resolveTargets(runtime, { nodeId: 'n1' })).toEqual([a]);
  });

  it('resolves nothing before the app has a root component', () => {
    expect(resolveTargets({}, { nodeId: 'n1' })).toEqual([]);
  });
});

describe('what the caller is told when it cannot act', () => {
  it('distinguishes a node that is not running from one that renders no DOM', () => {
    // ⚠️ The distinction an agent needs. "Not running" means look at navigation — the node is
    // on a page that is not open. "Renders no DOM" means stop trying to click it; a Variable
    // is in the walk and in the dictionary and will never be clickable.
    const runtime = runtimeWith({ headless: [invisible(), invisible()] });

    const missing = performInput(runtime, { nodeId: 'nope', action: 'click' });
    expect(missing.ok).toBe(false);
    expect(missing.message).toContain('is running');
    expect(missing.message).toContain('not open');

    const headless = performInput(runtime, { nodeId: 'headless', action: 'click' });
    expect(headless.ok).toBe(false);
    expect(headless.message).toContain('renders no DOM');
    expect(headless.message).toContain('2 instance(s)');
  });

  it('says so when the app has not finished loading', () => {
    const result = performInput({}, { nodeId: 'n1', action: 'click' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no root component');
  });

  it('rejects a request with no address at all', () => {
    expect(performInput(runtimeWith({}), { action: 'click' }).message).toContain('No target');
  });

  it('refuses setText without a value rather than clearing the field', () => {
    const runtime = runtimeWith({ n1: [visual(fakeElement('INPUT'))] });
    const result = performInput(runtime, { nodeId: 'n1', action: 'setText' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('needs a "value"');
  });

  it('names the action it did not understand', () => {
    const runtime = runtimeWith({ n1: [visual(fakeElement('DIV'))] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(performInput(runtime, { nodeId: 'n1', action: 'shake' as any }).message).toContain('"shake"');
  });

  it('reports an out-of-range index against the count that was matched', () => {
    const runtime = runtimeWith({ row: [visual(fakeElement('DIV')), visual(fakeElement('DIV'))] });
    const result = performInput(runtime, { nodeId: 'row', action: 'click', index: 5 });
    expect(result.ok).toBe(false);
    expect(result.matched).toBe(2);
    expect(result.message).toContain('2 instance(s)');
  });
});

describe('ambiguity is reported, never hidden', () => {
  it('warns when a node id resolved to several instances and no index was given', () => {
    // The Repeater case: one node id, one row each. Acting on index 0 silently would let a
    // caller conclude it had clicked *the* button.
    const runtime = runtimeWith({ card: [visual(fakeElement('DIV')), visual(fakeElement('DIV')), visual(fakeElement('DIV'))] });

    const result = performInput(runtime, { nodeId: 'card', action: 'click' });
    expect(result.ok).toBe(true);
    expect(result.matched).toBe(3);
    expect(result.message).toContain('3 instances matched');
    expect(result.message).toContain('index');
  });

  it('stays quiet when the caller chose an instance deliberately', () => {
    const runtime = runtimeWith({ card: [visual(fakeElement('DIV')), visual(fakeElement('DIV'))] });

    const result = performInput(runtime, { nodeId: 'card', action: 'click', index: 1 });
    expect(result.ok).toBe(true);
    expect(result.matched).toBe(2);
    expect(result.message).not.toContain('⚠️');
  });

  it('reports matched even on an unambiguous success', () => {
    const runtime = runtimeWith({ n1: [visual(fakeElement('BUTTON'))] });
    expect(performInput(runtime, { nodeId: 'n1', action: 'click' })).toMatchObject({ ok: true, matched: 1 });
  });
});

describe('what a click actually dispatches', () => {
  /** The events an element received, in order. */
  function sequence(el: ReturnType<typeof fakeElement>): string[] {
    return el.dispatchEvent.mock.calls.map((call: unknown[]) => (call[0] as FakeEvent).type);
  }

  it('sends the whole press sequence, not just a click', () => {
    // ⚠️ The reason this is not `element.click()`. Noodl's Button tracks its `pressed` visual
    // state from `mousedown`/`mouseup`; a lone `click` leaves it in a state no real user can
    // produce, and the node's own `pressed` output never fires.
    const el = fakeElement('BUTTON');
    performInput(runtimeWith({ n1: [visual(el)] }), { nodeId: 'n1', action: 'click' });

    expect(sequence(el)).toEqual(['mousedown', 'mouseup', 'click']);
  });

  it('includes the pointer events where the platform has them', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    g.PointerEvent = FakeEvent;
    try {
      const el = fakeElement('BUTTON');
      performInput(runtimeWith({ n1: [visual(el)] }), { nodeId: 'n1', action: 'click' });
      expect(sequence(el)).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    } finally {
      delete g.PointerEvent;
    }
  });

  it('bubbles, or React never sees it', () => {
    // React attaches its listeners once at the root container and relies on native bubbling.
    // A non-bubbling event reaches the element and not a single `onClick` in the app.
    const el = fakeElement('BUTTON');
    performInput(runtimeWith({ n1: [visual(el)] }), { nodeId: 'n1', action: 'click' });

    for (const call of el.dispatchEvent.mock.calls) {
      expect((call[0] as FakeEvent).init.bubbles).toBe(true);
    }
  });

  it('aims at the centre of the element', () => {
    const el = fakeElement('BUTTON');
    el.getBoundingClientRect = () => ({ left: 100, top: 40, width: 20, height: 10 });
    performInput(runtimeWith({ n1: [visual(el)] }), { nodeId: 'n1', action: 'click' });

    const first = el.dispatchEvent.mock.calls[0][0] as FakeEvent;
    expect(first.init.clientX).toBe(110);
    expect(first.init.clientY).toBe(45);
  });

  it('focuses the element between press and release, as a real click does', () => {
    const el = fakeElement('INPUT');
    performInput(runtimeWith({ n1: [visual(el)] }), { nodeId: 'n1', action: 'click' });
    expect(el.focus).toHaveBeenCalled();
  });

  it('refuses to set text on something that has none', () => {
    const el = fakeElement('DIV');
    const result = performInput(runtimeWith({ n1: [visual(el)] }), { nodeId: 'n1', action: 'setText', value: 'x' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not an input or textarea');
  });
});

describe('the reply always comes back', () => {
  it('turns a throwing element into a message rather than an exception', () => {
    // ⚠️ This runs inside a socket message handler. A throw would be swallowed there and the
    // caller would wait out its timeout with no idea why.
    const exploding = {
      tagName: 'DIV',
      getBoundingClientRect: () => {
        throw new Error('detached');
      }
    };
    const runtime = runtimeWith({ n1: [visual(exploding)] });

    const result = performInput(runtime, { nodeId: 'n1', action: 'click' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('detached');
  });

  it('echoes the requestId so a caller can match reply to request', () => {
    const runtime = runtimeWith({ n1: [visual(fakeElement('BUTTON'))] });
    expect(performInput(runtime, { requestId: 'r7', nodeId: 'n1', action: 'click' }).requestId).toBe('r7');
    expect(performInput(runtime, { requestId: 'r8', action: 'click' }).requestId).toBe('r8');
  });
});

describe('selectors', () => {
  it('matches through a supplied document', () => {
    const el = fakeElement('BUTTON');
    const doc = { querySelectorAll: () => [el] } as unknown as Document;
    expect(resolveTargets(runtimeWith({}), { selector: '.buy' }, doc)).toEqual([el]);
  });

  it('reports the selector back when nothing matched', () => {
    const doc = { querySelectorAll: () => [] } as unknown as Document;
    const result = performInput(runtimeWith({}), { selector: '.buy', action: 'click' }, doc);
    expect(result.message).toContain('.buy');
  });

  it('matches nothing when there is no document, rather than throwing', () => {
    expect(resolveTargets(runtimeWith({}), { selector: '.buy' })).toEqual([]);
  });
});
