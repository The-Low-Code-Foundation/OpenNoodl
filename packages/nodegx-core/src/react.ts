import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { Collection } from './collection';
import { Derived } from './derived';
import { createSelectorSnapshot } from './selector';
import type { Signal } from './signal';
import type { Store } from './store';
import type { Readable } from './value';

/**
 * Subscribes a component to a {@link Value}, {@link Derived} or {@link Collection}.
 *
 * ```tsx
 * const title = useValue(pageTitle);
 * ```
 *
 * Built on `useSyncExternalStore`, so it is concurrent-safe and tearing-free, and so React's own
 * `Object.is` bail-out absorbs the redundant notifications CONTRACT.md C2 requires the library to
 * send.
 */
export function useValue<T>(source: Readable<T>): T {
  const subscribe = useCallback((onChange: () => void) => source.subscribe(onChange), [source]);
  const getSnapshot = useCallback(() => source.get(), [source]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Reads part of a {@link Store}.
 *
 * ```tsx
 * const title = useStore(chat, (s) => s.title);
 * ```
 *
 * The selector may be an inline arrow — it does not need to be referentially stable. Pass
 * `isEqual` when the selector builds an object or array, so an unchanged result does not re-render:
 *
 * ```tsx
 * const { title, answer } = useStore(chat, (s) => ({ title: s.title, answer: s.answer }), shallowEqual);
 * ```
 */
export function useStore<T extends object, S>(
  store: Store<T>,
  selector: (state: Readonly<T>) => S,
  isEqual?: (a: S, b: S) => boolean
): S {
  // The selector and comparator are read through refs so that an inline arrow does not rebuild the
  // snapshot cache on every render — which would defeat the cache entirely.
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  const getSnapshot = useMemo(
    () =>
      createSelectorSnapshot(
        store,
        (state) => selectorRef.current(state),
        (a, b) => (isEqualRef.current ?? Object.is)(a, b)
      ),
    [store]
  );

  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Reads a {@link Collection} as a plain array. */
export function useCollection<T>(source: Collection<T>): readonly T[] {
  return useValue(source);
}

/**
 * Computes a value from other reactive sources, scoped to the component.
 *
 * ```tsx
 * const wordCount = useDerived(() => chat.get().answer.split(/\s+/).length);
 * ```
 *
 * The computation is created once and disposed on unmount. `compute` is read through a ref, so an
 * inline arrow is fine; if it closes over a changing prop, pass that prop in `deps`.
 */
export function useDerived<T>(compute: () => T, deps: readonly unknown[] = []): T {
  const computeRef = useRef(compute);
  computeRef.current = compute;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the caller's declared list
  const node = useMemo(() => new Derived<T>(() => computeRef.current()), deps);

  useEffect(() => () => node.dispose(), [node]);

  return useValue(node);
}

/**
 * Runs `handler` whenever `source` emits, for as long as the component is mounted.
 *
 * ```tsx
 * useSignal(conversationCleared, () => setDraft(''));
 * ```
 *
 * The handler is read through a ref, so it may be an inline arrow closing over current props
 * without re-subscribing on every render.
 */
export function useSignal<T>(source: Signal<T>, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => source.subscribe((payload) => handlerRef.current(payload)), [source]);
}

/** A shallow comparator for selectors that build an object or array. */
export function shallowEqual<S>(a: S, b: S): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}
