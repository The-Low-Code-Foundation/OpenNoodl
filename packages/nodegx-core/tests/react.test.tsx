/**
 * The React bindings, covered without a DOM.
 *
 * Two layers, because they fail in different ways:
 *
 * 1. `createSelectorSnapshot` is where a wrong answer becomes an infinite render loop, and it is a
 *    plain function — so it is tested directly and exhaustively.
 * 2. The hooks themselves are rendered through `react-dom/server`, which needs no DOM and does
 *    exercise the real `useSyncExternalStore` path including its server snapshot.
 *
 * What is *not* covered here is re-render-on-change through a real commit, which needs a DOM the
 * repository deliberately does not carry (see `jest.config.cjs`). That is a live-QA question, and
 * EXP-002's first generated app is where it gets asked.
 */
import { renderToStaticMarkup } from 'react-dom/server';

import { collection } from '../src/collection';
import { derived } from '../src/derived';
import { resetRuntime } from '../src/internal';
import { shallowEqual, useCollection, useDerived, useStore, useValue } from '../src/react';
import { createSelectorSnapshot } from '../src/selector';
import { clearStores, store } from '../src/store';
import { value } from '../src/value';

afterEach(() => {
  resetRuntime();
  clearStores();
});

describe('createSelectorSnapshot', () => {
  it('returns the identical reference while the store has not been written to', () => {
    const chat = store('chat', { title: 'a', answer: '' });
    const snapshot = createSelectorSnapshot(chat, (s) => ({ title: s.title }));

    const first = snapshot();
    const second = snapshot();

    // Without the cache these would be two different objects and React would never settle.
    expect(second).toBe(first);
  });

  it('recomputes after a write', () => {
    const chat = store('chat', { title: 'a' });
    const snapshot = createSelectorSnapshot(chat, (s) => s.title);

    expect(snapshot()).toBe('a');
    chat.set({ title: 'b' });
    expect(snapshot()).toBe('b');
  });

  it('keeps the previous reference when the comparator says the result is equivalent', () => {
    const chat = store('chat', { title: 'a', answer: '' });
    const snapshot = createSelectorSnapshot(chat, (s) => ({ title: s.title }), shallowEqual);

    const first = snapshot();
    chat.set({ answer: 'irrelevant to this selector' });
    const second = snapshot();

    expect(second).toBe(first);
  });

  it('without a comparator, an unrelated write does produce a new reference', () => {
    // This is why generated code that selects an object must pass `shallowEqual` — asserted so the
    // requirement is visible rather than folklore.
    const chat = store('chat', { title: 'a', answer: '' });
    const snapshot = createSelectorSnapshot(chat, (s) => ({ title: s.title }));

    const first = snapshot();
    chat.set({ answer: 'x' });

    expect(snapshot()).not.toBe(first);
  });

  it('reads through peek, so building a snapshot never creates a dependency edge', () => {
    const chat = store('chat', { title: 'a' });
    const snapshot = createSelectorSnapshot(chat, (s) => s.title);

    let computations = 0;
    const upper = derived(() => {
      computations++;
      return snapshot().toUpperCase();
    });

    expect(upper.get()).toBe('A');
    chat.set({ title: 'b' });

    // The derived read the snapshot function, not the store, so it did not become stale.
    expect(upper.get()).toBe('A');
    expect(computations).toBe(1);
  });
});

describe('shallowEqual', () => {
  it('compares one level of keys', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: { deep: 1 } }, { a: { deep: 1 } })).toBe(false);
  });

  it('handles primitives, null and identical references', () => {
    const same = { a: 1 };
    expect(shallowEqual(same, same)).toBe(true);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, { a: 1 })).toBe(false);
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual('a', 'b')).toBe(false);
  });
});

describe('hooks render', () => {
  it('useValue reads the current value', () => {
    const title = value('Ada');
    function Title() {
      return <span>{useValue(title)}</span>;
    }

    title.set('Lovelace');
    expect(renderToStaticMarkup(<Title />)).toBe('<span>Lovelace</span>');
  });

  it('useValue works over a derived value', () => {
    const first = value('Ada');
    const full = derived(() => `${first.get()} Lovelace`);
    function Full() {
      return <span>{useValue(full)}</span>;
    }

    expect(renderToStaticMarkup(<Full />)).toBe('<span>Ada Lovelace</span>');
  });

  it('useStore reads through a selector', () => {
    const chat = store('chat', { title: 'Untitled conversation' });
    function Title() {
      return <span>{useStore(chat, (s) => s.title)}</span>;
    }

    chat.set({ title: 'Renamed' });
    expect(renderToStaticMarkup(<Title />)).toBe('<span>Renamed</span>');
  });

  it('useCollection renders a list', () => {
    const items = collection<string>(['a', 'b']);
    function List() {
      return (
        <ul>
          {useCollection(items).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }

    expect(renderToStaticMarkup(<List />)).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('useDerived computes from stores inside a component', () => {
    const chat = store('chat', { answer: 'one two three' });
    function WordCount() {
      const words = useDerived(() => chat.get().answer.split(' ').length);
      return <span>{words}</span>;
    }

    expect(renderToStaticMarkup(<WordCount />)).toBe('<span>3</span>');
  });
});
