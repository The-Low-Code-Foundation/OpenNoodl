/**
 * DEF-027 — a `Drag`'s child loses its CSS class, so a draggable element cannot be styled.
 *
 * Found by driving, in phase 77 (D28, `noodl-mcp/tests/ac2DragGestureDrive.test.ts`): a `Group`
 * inside a `Drag` with `cssClassName` set by connection reached the DOM carrying
 * `react-draggable` and nothing else, while a `Group` one level further in and a `Text` deeper
 * still — same kind of connection, same `Component Inputs` node — kept theirs. Those two
 * controls are what made it about `Drag` rather than about `cssClassName`.
 *
 * ## The mechanism, which is the spread's and not the node's
 *
 * `react-draggable` does try to merge: it clones its child with
 * `clsx(children.props.className || '', 'react-draggable', …)`. But the child it clones is the
 * `NoodlReactComponent` **wrapper** element, and the node's `render` creates that with only
 * `{key, noodlNode, ref}` — the author's class lives on `noodlNode.props` and is not read until
 * one level deeper. So the library's merge has nothing to see and hands down a bare
 * `react-draggable`, which then arrives in `otherProps` and, being last in the spread, replaced
 * the node's own `className`.
 *
 * It failed silently the whole way: accepted at the door, stored in the graph, survived the
 * deploy, absent at runtime, with nothing logged and nothing to search for.
 *
 * ## Why these rows render the real `Drag` and the real wrapper
 *
 * Both halves of the mechanism have to be real or the spec grades a reconstruction: the
 * library's injection is what supplies the competing class, and the wrapper's spread is what
 * used to discard the author's. Only the *node data* is a fixture here — `noodlNode.props`,
 * which is genuinely just data. The leaf is the real `Text` component, so `className` is read
 * off the element the way every visual node reads it.
 *
 * 🔴 The no-Drag row is the control that excludes the competing reading — "a `className` on a
 * node does not apply" — and the no-class row is the one that catches a merge that stringifies
 * an absent half into the literal `"undefined"`.
 *
 * The end-to-end consequence is graded where it was found, in real Chrome, by
 * `ac2DragGestureDrive.test.ts`'s `probe-card-a` rows.
 */

/* eslint-env jest */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Drag } from '../src/components/visual/Drag/Drag';
import { Text } from '../src/components/visual/Text/Text';
import { NoodlReactComponent } from '../src/react-component-node';

type AnyProps = Record<string, any>;

beforeAll(() => {
  (globalThis as unknown as { Noodl: unknown }).Noodl = { baseUrl: '/' };
});

/** `Text` resolves its colour through the node context — the same fixture NDA-012's rows use. */
const nodeContext = { frameNumber: 0, styles: { resolveColor: (c: unknown) => c } };

/**
 * The members `NoodlReactComponent.render` reads. `renderToStaticMarkup` never commits, so the
 * ref callback and `componentDidMount` do not run and are not stubbed.
 */
function makeNode(className: string | undefined, reactComponent: unknown, children: React.ReactNode = null) {
  return {
    style: {},
    props: { text: 'row', ...(className === undefined ? {} : { className }) },
    reactComponent,
    noodlNodeAsProp: true,
    useFrame: false,
    context: nodeContext,
    getVisualParentNode: () => undefined,
    renderChildren: () => children,
    setDOMElement: () => undefined,
    _flushPendingInnerActions: () => undefined
  } as AnyProps;
}

/** A node wrapped in the real `Drag`, rendered the way the viewer renders it. */
function renderInDrag(className: string | undefined) {
  const child = React.createElement(NoodlReactComponent as unknown as React.FC<AnyProps>, {
    noodlNode: makeNode(className, Text)
  });

  return renderToStaticMarkup(
    React.createElement(Drag as unknown as React.FC<AnyProps>, {
      axis: 'both',
      scale: 1,
      enabled: true,
      useParentBounds: false,
      noodlNode: { children: [], context: {} },
      children: child
    })
  );
}

function classAttr(html: string): string {
  const match = html.match(/class="([^"]*)"/);
  return match ? match[1] : '';
}

describe('DEF-027 — a Drag child keeps the CSS class its author gave it', () => {
  it('FINDING — the authored class and the library\'s own both reach the element', () => {
    const cls = classAttr(renderInDrag('probe-card-a'));

    expect(cls).toContain('probe-card-a');
    expect(cls).toContain('react-draggable');
  });

  it('control — the same node outside a Drag has always kept its class', () => {
    const html = renderToStaticMarkup(
      React.createElement(NoodlReactComponent as unknown as React.FC<AnyProps>, {
        noodlNode: makeNode('probe-card-a', Text)
      })
    );

    expect(classAttr(html)).toContain('probe-card-a');
    expect(classAttr(html)).not.toContain('react-draggable');
  });

  it('control — a Drag child with no authored class carries the library\'s class alone', () => {
    const cls = classAttr(renderInDrag(undefined));

    expect(cls).toContain('react-draggable');
    expect(cls).not.toContain('undefined');
  });

  it('control — an empty cssClassName is the unauthored default and adds nothing', () => {
    const cls = classAttr(renderInDrag(''));

    expect(cls).toContain('react-draggable');
    expect(cls).not.toContain('undefined');
  });

  it('the parent still wins on style, which is the precedence this did not change', () => {
    const html = renderToStaticMarkup(
      React.createElement(NoodlReactComponent as unknown as React.FC<AnyProps>, {
        noodlNode: { ...makeNode('probe-card-a', Text), style: { color: 'red' } },
        style: { color: 'blue' }
      })
    );

    expect(html).toContain('color:blue');
    expect(html).not.toContain('color:red');
  });
});
