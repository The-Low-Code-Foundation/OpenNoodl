/**
 * NDA-008 §1 — "both modes animate, with the same transition inputs" (success criterion 2).
 *
 * Replace had no animation *surface at all*: `replaceAsync` deleted every current page before
 * the new one existed, so there was never anything to transition from, and the stack entry it
 * pushed carried no `transition` at all. Push, meanwhile, always animated. That is the split
 * Richard called sad — you picked your semantics and the animation capability came bundled
 * with the choice instead of being an independent axis.
 *
 * The target model is one mechanism, two policies: replace is "push, then drop the previous
 * entries once the transition completes". These rows pin that, and pin just as hard that the
 * *default* did not move — an existing replace must not start animating.
 */

/* eslint-env jest */

/**
 * The transition registry, faked so the test can hold an animation open.
 *
 * With the real `PushTransition` under `testEnvironment: node` there is no `window.performance`,
 * so `start()` completes synchronously — and "dropped immediately" would be indistinguishable
 * from "dropped when the transition ended", which is the entire distinction under test. The
 * registry lookup itself is still exercised: `replaceAsync` indexes this object by name.
 */
const constructed: Array<{ type: string; from: unknown; to: unknown; end?: () => void }> = [];

jest.mock('../src/nodes/navigation/transitions', () => {
  function make(type: string) {
    return class FakeTransition {
      record: { type: string; from: unknown; to: unknown; end?: () => void };
      constructor(from: unknown, to: unknown) {
        this.record = { type, from, to };
        constructed.push(this.record);
      }
      forward() {
        /* the animated frame; nothing here reads styles */
      }
      start(args: { end?: () => void }) {
        // Held open deliberately — the test calls `end` when it wants the animation to finish.
        this.record.end = args.end;
      }
    };
  }
  return { __esModule: true, default: { None: make('None'), Push: make('Push'), Popup: make('Popup') } };
});

import PageStackModule from '../src/nodes/navigation/navigation-stack';

type AnyFn = (...args: any[]) => any;

interface FakePage {
  id: string;
  deleted: boolean;
  position?: string;
  addChild: AnyFn;
  setInputValue: AnyFn;
}

interface FakeStack {
  _internal: any;
  children: FakePage[];
  deleted: string[];
  outputs: Record<string, unknown>;
  [key: string]: any;
}

let pageCounter = 0;

function makePage(id: string): FakePage {
  const page: FakePage = {
    id,
    deleted: false,
    addChild() {
      /* the page's content; nothing here reads it */
    },
    setInputValue(name: string, value: unknown) {
      if (name === 'position') page.position = value as string;
    }
  };
  return page;
}

/**
 * A Component Stack reduced to what `replaceAsync` touches. The definition's own `methods` are
 * bound onto it, the same approach as `nda-016-layout-sizemode.test.ts` — a whole node scope
 * and a mounted React tree are not needed to exercise a navigation policy.
 */
function makeStack(existing: FakePage[]): FakeStack {
  const stack: FakeStack = {
    _internal: {
      pages: [{ id: 'p1', label: 'One' }, { id: 'p2', label: 'Two' }],
      pageInfo: {},
      stack: existing.map((page) => ({ from: null, page, pageId: 'p1', pageInfo: { label: 'One' } })),
      isTransitioning: false
    },
    children: existing.slice(),
    deleted: [],
    outputs: {},
    nodeScope: {
      createNode: async () => makePage('content'),
      deleteNode: (page: FakePage) => {
        page.deleted = true;
        stack.deleted.push(page.id);
      }
    }
  } as unknown as FakeStack;

  // Bind the definition's own methods first, *then* the collaborators this test stands in for.
  // The other order silently loses: `Object.keys(methods)` includes `_findPage`,
  // `setPageOutputs`, `createPageContainer` and `_updateUrlWithTopPage`, so binding second
  // overwrites the fakes and `replaceAsync` returns early on a page it cannot find — which
  // looks exactly like the feature not working.
  const methods = (PageStackModule as any).node.methods as Record<string, AnyFn>;
  for (const key of Object.keys(methods)) stack[key] = methods[key].bind(stack);

  // The child list too: `createNodeFromReactComponent` folds the shared visual-node methods
  // into `node.methods`, so `addChild`/`removeChild`/`getChildren` are the real ones and drag
  // in React scheduling this test has no use for.
  stack.getChildren = () => stack.children;
  stack.addChild = (child: FakePage) => {
    stack.children.push(child);
  };
  stack.removeChild = (child: FakePage) => {
    const i = stack.children.indexOf(child);
    if (i !== -1) stack.children.splice(i, 1);
  };
  stack.createPageContainer = () => makePage('new-' + ++pageCounter);
  stack._findPage = (pageId: string) => ({
    id: pageId,
    label: pageId === 'p2' ? 'Two' : 'One',
    component: '/Page'
  });
  stack.setPageOutputs = (outputs: Record<string, unknown>) => {
    Object.assign(stack.outputs, outputs);
  };
  stack._updateUrlWithTopPage = () => {
    /* history; irrelevant here */
  };

  return stack;
}

beforeEach(() => {
  constructed.length = 0;
});

describe('NDA-008 §1: replace animates with the same machinery as push', () => {
  test('with a transition, the outgoing page survives until the animation ends', async () => {
    const outgoing = makePage('outgoing');
    const stack = makeStack([outgoing]);

    await stack.replaceAsync({ target: 'p2', transition: { type: 'Push' } });

    // The whole point. Before this, `replaceAsync` deleted every child before creating the new
    // page, so there was nothing left to animate away from.
    expect(outgoing.deleted).toBe(false);
    expect(constructed).toHaveLength(1);
    expect(constructed[0].type).toBe('Push');
    expect(constructed[0].from).toBe(outgoing);

    // ...and it is still a child, so both pages are on screen for the duration.
    expect(stack.children).toContain(outgoing);
    expect(stack._internal.isTransitioning).toBe(true);

    constructed[0].end!();

    expect(outgoing.deleted).toBe(true);
    expect(stack.children).not.toContain(outgoing);
    expect(stack._internal.isTransitioning).toBe(false);
  });

  test('replace still replaces — the stack is one deep, with nothing to go back to', async () => {
    const stack = makeStack([makePage('outgoing')]);

    await stack.replaceAsync({ target: 'p2', transition: { type: 'Push' } });

    // The one difference from push: the outgoing entry does not stay in the stack.
    expect(stack._internal.stack).toHaveLength(1);
    expect(stack._internal.stack[0].from).toBeNull();
    expect(stack.outputs.stackDepth).toBe(1);
  });

  test('the default is unchanged — no transition means the old behaviour exactly', async () => {
    const outgoing = makePage('outgoing');
    const stack = makeStack([outgoing]);

    await stack.replaceAsync({ target: 'p2' });

    // Back-compat pin. Push defaults to `Push`; matching it here would silently add an
    // animation to every replace node already in every project.
    expect(constructed).toHaveLength(0);
    expect(outgoing.deleted).toBe(true);
    expect(stack._internal.isTransitioning).toBe(false);
  });

  test('an explicit None is not an animation either', async () => {
    const outgoing = makePage('outgoing');
    const stack = makeStack([outgoing]);

    await stack.replaceAsync({ target: 'p2', transition: { type: 'None' } });

    expect(constructed).toHaveLength(0);
    expect(outgoing.deleted).toBe(true);
  });

  test('the first replace, with nothing showing yet, does not try to animate from nothing', async () => {
    const stack = makeStack([]);

    await stack.replaceAsync({ target: 'p2', transition: { type: 'Push' } });

    // `PushTransition` dereferences `from.setStyle`, so constructing one against a null
    // outgoing page would throw rather than degrade.
    expect(constructed).toHaveLength(0);
    expect(stack._internal.stack).toHaveLength(1);
  });

  test('every outgoing page is dropped, not every other one', async () => {
    // `getChildren()` hands back the live array, and the original loop removed while iterating
    // it by index — so with two children it deleted one and left the other mounted for ever.
    const a = makePage('a');
    const b = makePage('b');
    const stack = makeStack([a, b]);

    await stack.replaceAsync({ target: 'p2' });

    expect(stack.deleted.sort()).toEqual(['a', 'b']);
    expect(stack.children.map((c) => c.id)).toEqual(expect.not.arrayContaining(['a', 'b']));
  });

  test('a replace during a transition is still refused', async () => {
    const stack = makeStack([makePage('outgoing')]);
    stack._internal.isTransitioning = true;

    await stack.replaceAsync({ target: 'p2', transition: { type: 'Push' } });

    expect(constructed).toHaveLength(0);
    expect(stack._internal.stack).toHaveLength(1);
  });
});
