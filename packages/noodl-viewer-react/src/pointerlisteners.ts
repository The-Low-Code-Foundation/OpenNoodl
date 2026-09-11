import type { ReactNodeInstance } from './react-component-node';

const pointerEvents = [
  'onClick',
  'onMouseDown',
  'onMouseMove',
  'onMouseUp',
  'onMouseEnter',
  'onMouseLeave',
  'onMouseOver',
  'onMouseOut',
  'onTouchStart',
  'onTouchMove',
  'onTouchEnd',
  'onTouchCancel',
  'onPointerDown',
  'onPointerMove',
  'onPointerUp',
  'onPointerCancel'
] as const;

export type PointerEventName = (typeof pointerEvents)[number];

/**
 * DEF-029 — the file-drag events, deliberately *not* folded into the sixteen above.
 *
 * `blockTouch` installs a `stopPropagation` blocker on every event it covers, including ones
 * with no listener at all. Folding the drag events in would therefore mean a child with
 * "Block Pointer Events" switched on silently kills the drop zone it sits inside: the parent's
 * `dragover` never runs, so it never calls `preventDefault`, so the browser refuses the drop
 * over that region — a dead area with no diagnosis anywhere. Blocking is also not what that
 * port promises; its description is about pointer events reaching the nodes this one sits
 * inside, and a file drag is not one of them.
 *
 * Nesting is settled where it can be reasoned about instead: a node that actually *handles* a
 * drop stops it there, which is the rule `clickBubbling` already applies to clicks.
 */
const dragEvents = ['onDragEnter', 'onDragOver', 'onDragLeave', 'onDrop'] as const;

export type DragEventName = (typeof dragEvents)[number];

//These should not be blocked, it causes some annoying behaviour when using hover
const pointerEventsNotToBlock: Set<string> = new Set(['onMouseLeave', 'onMouseOut']);

type PointerHandler = (event: any) => void;

/**
 * FH-015 — whether a click on this element also reaches the Click of the nodes it sits inside.
 *
 * - `auto` (the default): the click stops here as soon as this node's own Click output is
 *   connected. A Favourite button inside a clickable card runs Favourite and not the card.
 * - `always`: the pre-FH-015 behaviour — every click bubbles, so an ancestor's Click fires too.
 * - `never`: clicks stop here whether this node's Click is wired or not.
 */
export type ClickBubblingMode = 'auto' | 'always' | 'never';

export interface PointerListenerProps {
  /** Noodl stores its own pointer callbacks here rather than on the props root. */
  pointer?: Partial<Record<PointerEventName | DragEventName, PointerHandler | undefined>>;
  /** When set, every listener stops propagation (except the hover-sensitive pair). */
  blockTouch?: boolean;
  /** See {@link ClickBubblingMode}. Absent means `auto`. */
  clickBubbling?: ClickBubblingMode;
  /** Present when the node passes itself to its React component. */
  noodlNode?: ReactNodeInstance;
  [prop: string]: any;
}

/**
 * Does a click that lands on this element stop here, or carry on to the ancestors?
 *
 * Evaluated when the click happens rather than when the element renders, deliberately: a
 * connection made in the editor while the preview is running does not re-render the node, so
 * a render-time answer would be stale exactly when an author is testing the wiring.
 */
function stopsClickPropagation(props: PointerListenerProps): boolean {
  const mode: ClickBubblingMode = props.clickBubbling || 'auto';

  if (mode === 'always') return false;
  if (mode === 'never') return true;

  const node = props.noodlNode;
  if (!node || typeof node.hasOutput !== 'function') return false;

  // `getOutput` throws for a port that was never registered, so ask first. A node with no
  // Click port at all — and a Click port with nothing wired to it — keeps bubbling, which is
  // what makes this inert for every element that is not doing anything with the click.
  if (!node.hasOutput('onClick')) return false;
  return node.getOutput('onClick').hasConnections();
}

export type PointerListeners = Partial<Record<PointerEventName | DragEventName, PointerHandler | undefined>>;

/**
 * Derives the pointer-event props to spread onto a rendered element.
 *
 * Precedence per event: with `blockTouch` set, a Noodl callback wins over a
 * third-party one and both get `stopPropagation` appended, and an event with no
 * listener at all still gets a blocker installed. Without `blockTouch`, a
 * third-party listener on the props root wins over Noodl's.
 *
 * Without `blockTouch`, the click alone is still governed by `clickBubbling` — see
 * {@link ClickBubblingMode}.
 *
 * When the props carry a `noodlNode`, every resulting handler is wrapped so the
 * runtime flushes dirty nodes after the callback — that is what makes a click
 * update the graph in the same frame.
 */
export default function pointerProps(props: PointerListenerProps): PointerListeners {
  const newProps: PointerListeners = {};

  for (const eventName of pointerEvents) {
    if (props.blockTouch && !pointerEventsNotToBlock.has(eventName)) {
      //Noodl stores pointer event callbacks in props.pointer
      if (props.pointer && props.pointer[eventName]) {
        newProps[eventName] = (e) => {
          props.pointer[eventName](e);
          e.stopPropagation();
        };
      }
      //some third party library might add pointer event callbacks as well, so look for callbacks directly on the props object
      else if (props[eventName]) {
        newProps[eventName] = (e) => {
          props[eventName](e);
          e.stopPropagation();
        };
      } else {
        //there was no existing listener, so create a new one that just blocks
        newProps[eventName] = (e) => {
          e.stopPropagation();
        };
      }
    }
    //check if third party code added a listener
    else if (props[eventName]) {
      newProps[eventName] = props[eventName];
    }
    //check if Noodl added a listener
    else if (props.pointer) {
      newProps[eventName] = props.pointer[eventName];
    }
  }

  // DEF-029. Purely additive: a drag event is copied across only when something installed a
  // handler for it, and only the file-drop ports do. A node without them renders exactly the
  // props it did before, which is why no existing project changes behaviour here.
  for (const eventName of dragEvents) {
    if (props.pointer && props.pointer[eventName]) {
      newProps[eventName] = props.pointer[eventName];
    } else if (props[eventName]) {
      newProps[eventName] = props[eventName];
    }
  }

  // FH-015 slice 2. Click-through used to be the only behaviour: every visual node gets a live
  // `onClick` at init whether or not its Click port is wired, and nothing called
  // `stopPropagation` unless `blockTouch` was on — so a child's click always ran the ancestor's
  // Click as well. `blockTouch` is not the answer to that, because it stops all sixteen events
  // and takes the parent's hover with it. This stops the click alone, and only where the click
  // is being used for something.
  if (!props.blockTouch) {
    const mode: ClickBubblingMode = props.clickBubbling || 'auto';
    const existing = newProps.onClick;

    if (existing || mode === 'never') {
      newProps.onClick = (e) => {
        existing && existing(e);
        if (stopsClickPropagation(props)) e.stopPropagation();
      };
    }
  }

  if (props.noodlNode) {
    for (const p in newProps) {
      const f = newProps[p as PointerEventName | DragEventName];
      if (f) {
        newProps[p as PointerEventName | DragEventName] = (e) => {
          // `this` is `undefined` here — the arrow captures it from module scope,
          // which is strict-mode. Kept verbatim rather than simplified to `f(e)`
          // so this conversion stays type-only.
          f.call(this, e);
          props.noodlNode.context.updateDirtyNodes();
        };
      }
    }
  }

  return newProps;
}
