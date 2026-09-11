/**
 * NAT-005 — walking a React element tree in a runner that has no DOM.
 *
 * ## 🔴 Why this exists, and what it can and cannot see
 *
 * This checkout's jest is `testEnvironment: 'node'` with no jsdom in the tree, so the standing
 * assumption has been that a React component is ungradeable here and the answer is *source
 * analysis* — read the `.tsx` as text and match strings (`uni-011/launcher-community-tab.test.ts`
 * is the precedent). ⚠️ Source analysis is blind to a rename and cannot tell a component that
 * draws nothing from one that was never called.
 *
 * A React **element** is a plain object. A component that takes props and calls no hooks is a
 * plain function from props to elements. So a tree of such components can be evaluated here —
 * no renderer, no DOM, no `react-dom`. That is not a full render: no effects, no state, no
 * layout, no paint, and **no hooks of any kind**. It is enough to answer *"what did this draw"*,
 * which is what D15 and the four states are claims about.
 *
 * 🔴 **A component that calls a hook throws here rather than returning something wrong** —
 * React's dispatcher is null outside a render. That is the correct failure: the alternative is a
 * spec that silently grades half a tree. `views/Community.tsx` splits `CommunityTab` (pure) out
 * of `Community` (reads context) for exactly this reason.
 *
 * ⚠️ **Anything importing `common/Icon` cannot be loaded by this runner at all** — `Icon.tsx`
 * uses webpack's `require.context`, which ts-jest rejects at type-check time. It is why the
 * shared community row has no leading icon.
 *
 * @module noodl-editor/tests-unit/support/renderElements
 */
import React from 'react';

export type RenderedNode = {
  /** A DOM tag (`'div'`), or the component's name for anything this walk could not evaluate. */
  type: string;
  props: Record<string, unknown>;
  /** Whitespace-collapsed text children of this node only, not its descendants'. */
  ownText: string;
  children: RenderedNode[];
};

function isElement(value: unknown): value is React.ReactElement {
  return React.isValidElement(value);
}

/**
 * Evaluate an element tree, invoking every function component it meets.
 *
 * Returns `null` for a tree that drew nothing — `null`, `undefined`, `false`, or a component that
 * returned one of those. 🔴 That is the value D15's assertion turns on, which is why the spec
 * beside it always renders a NOT-hidden view too: `null` here is also what a component that never
 * ran would produce.
 */
export function render(node: React.ReactNode): RenderedNode | null {
  const flat = renderMany(node);
  if (flat.length === 0) return null;
  if (flat.length === 1) return flat[0];
  // A fragment or array at the root — wrap it so callers always get one node back.
  return { type: 'Fragment', props: {}, ownText: '', children: flat };
}

function renderMany(node: React.ReactNode): RenderedNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(renderMany);
  if (typeof node === 'string' || typeof node === 'number') {
    return [{ type: '#text', props: {}, ownText: String(node), children: [] }];
  }
  if (!isElement(node)) return [];

  const { type, props } = node as React.ReactElement<Record<string, unknown>>;

  // `<>…</>` — React.Fragment is a symbol, so this is checked before the callable branch narrows
  // `type` away from it.
  if ((type as unknown) === React.Fragment) return renderMany(props.children as React.ReactNode);

  // A function component: call it. ⚠️ A class component or a hook-calling function throws, and
  // that is deliberate — see the module note.
  if (typeof type === 'function') {
    const isClass = Boolean((type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent);
    if (isClass) return [asNode(type.name || 'Component', props, [])];
    return renderMany((type as (p: unknown) => React.ReactNode)(props));
  }

  if (typeof type === 'string') {
    return [asNode(type, props, renderMany(props.children as React.ReactNode))];
  }

  // `memo`, `forwardRef`, a context provider — named rather than evaluated, so a spec that
  // depends on one of these fails visibly instead of quietly finding no children.
  return [asNode('Opaque', props, renderMany(props.children as React.ReactNode))];
}

function asNode(type: string, props: Record<string, unknown>, children: RenderedNode[]): RenderedNode {
  const ownText = children
    .filter((c) => c.type === '#text')
    .map((c) => c.ownText)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return { type, props, ownText, children: children.filter((c) => c.type !== '#text') };
}

/** Every node in the tree, root first. */
export function walk(node: RenderedNode | null): RenderedNode[] {
  if (!node) return [];
  return [node, ...node.children.flatMap(walk)];
}

/** All the words the tree would show, in order, whitespace collapsed. */
export function text(node: RenderedNode | null): string {
  return walk(node)
    .map((n) => n.ownText)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nodes carrying a given class name — the mock resolves a CSS module key to the key itself. */
export function byClass(node: RenderedNode | null, className: string): RenderedNode[] {
  return walk(node).filter((n) => String(n.props.className ?? '').split(/\s+/).includes(className));
}

/**
 * Source with its comments removed, for any check that greps a `.tsx` for a forbidden construct.
 *
 * 🔴 **A comment satisfies a naive grep, and this repo has been bitten by it twice.** NAT-005's
 * own AC7 check went red the first time it ran — not on a defect, but on the sentence *"No
 * `dangerouslySetInnerHTML`, ever"* in the module note of the file it was clearing. The failure
 * mode in the other direction is the dangerous one: a file that both *uses* the construct and
 * *documents* the prohibition reads exactly the same to a checker that cannot tell them apart,
 * and the prose makes it look reviewed.
 *
 * ⚠️ Deliberately crude — it strips `/*…*\/` and `//`-to-end-of-line without parsing strings, so a
 * URL inside a string literal loses its tail. That is safe for *presence* checks on identifiers
 * and is not safe for anything that needs the source back intact.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
