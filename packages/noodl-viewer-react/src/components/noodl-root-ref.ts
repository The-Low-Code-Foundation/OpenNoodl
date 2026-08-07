/**
 * Root-element reporting for built-in components.
 *
 * findDOMNode is gone in React 19, so the runtime can no longer discover a
 * component's root DOM element from the outside. Instead every built-in
 * component attaches this ref on its root host element, which feeds
 * `noodlNode.setDOMElement()` — the source for `getDOMElement()`, the
 * direct-DOM style fast path and the bounding-box observer.
 *
 * The callback is cached per node so its identity is stable across renders;
 * React then only invokes it on real mount/unmount instead of on every commit.
 */

type NoodlNodeLike = { setDOMElement(element: Element | null): void };

const refCache = new WeakMap<NoodlNodeLike, (el: Element | null) => void>();

export function noodlRootRef(noodlNode: NoodlNodeLike | undefined): ((el: Element | null) => void) | undefined {
  if (!noodlNode || typeof noodlNode.setDOMElement !== 'function') return undefined;

  let ref = refCache.get(noodlNode);
  if (!ref) {
    ref = (el: Element | null) => noodlNode.setDOMElement(el);
    refCache.set(noodlNode, ref);
  }
  return ref;
}
