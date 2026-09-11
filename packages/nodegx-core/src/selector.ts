import type { Store } from './store';

/**
 * Builds the `getSnapshot` function a store selector needs.
 *
 * `useSyncExternalStore` requires `getSnapshot` to return a referentially stable result while
 * nothing has changed — return a fresh object each call and React re-renders forever. A selector
 * like `(s) => ({ title: s.title })` does exactly that, and it is a shape generated code will
 * produce whenever a component reads two fields.
 *
 * The cache is keyed on the store's write counter rather than on the selector's identity, so an
 * inline arrow written straight into the JSX costs nothing. `isEqual` is the second line of
 * defence: when the version moved but the selected result is equivalent, the *previous* reference
 * is kept, so React's own bail-out sees no change. That is where CONTRACT.md C2's "every write is
 * delivered, even an identical one" stops being a re-render.
 *
 * This lives outside `react.ts` and takes no React types, so it can be tested without a DOM — which
 * matters here, because the repository has no `jest-environment-jsdom` (see
 * `packages/noodl-core-ui/jest.config.js` for why).
 */
export function createSelectorSnapshot<T extends object, S>(
  store: Store<T>,
  selector: (state: Readonly<T>) => S,
  isEqual: (a: S, b: S) => boolean = Object.is
): () => S {
  let cachedVersion = -1;
  let cachedValue!: S;
  let hasValue = false;

  return function getSnapshot(): S {
    const version = store.version;
    if (hasValue && cachedVersion === version) return cachedValue;

    const next = selector(store.peek());
    cachedVersion = version;

    if (hasValue && isEqual(cachedValue, next)) return cachedValue;

    cachedValue = next;
    hasValue = true;
    return next;
  };
}
