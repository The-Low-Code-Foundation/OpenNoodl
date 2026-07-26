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

//These should not be blocked, it causes some annoying behaviour when using hover
const pointerEventsNotToBlock: Set<string> = new Set(['onMouseLeave', 'onMouseOut']);

type PointerHandler = (event: any) => void;

export interface PointerListenerProps {
  /** Noodl stores its own pointer callbacks here rather than on the props root. */
  pointer?: Partial<Record<PointerEventName, PointerHandler | undefined>>;
  /** When set, every listener stops propagation (except the hover-sensitive pair). */
  blockTouch?: boolean;
  /** Present when the node passes itself to its React component. */
  noodlNode?: ReactNodeInstance;
  [prop: string]: any;
}

export type PointerListeners = Partial<Record<PointerEventName, PointerHandler | undefined>>;

/**
 * Derives the pointer-event props to spread onto a rendered element.
 *
 * Precedence per event: with `blockTouch` set, a Noodl callback wins over a
 * third-party one and both get `stopPropagation` appended, and an event with no
 * listener at all still gets a blocker installed. Without `blockTouch`, a
 * third-party listener on the props root wins over Noodl's.
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

  if (props.noodlNode) {
    for (const p in newProps) {
      const f = newProps[p as PointerEventName];
      if (f) {
        newProps[p as PointerEventName] = (e) => {
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
