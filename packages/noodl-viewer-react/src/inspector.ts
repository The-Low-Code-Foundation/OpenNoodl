import type { ReactNodeInstance } from './react-component-node';

export interface InspectorCallbacks {
  /** Receives the ids the editor should select. */
  onInspect: (nodeIds: string[]) => void;
  onHighlight: (nodeId: string) => void;
  onDisableHighlight: () => void;
}

/** The component the inspection is scoped to, when one is set. */
export interface InspectorComponent {
  name: string;
  [extra: string]: unknown;
}

/**
 * Implements the editor's "inspect element" mode inside the running app.
 *
 * Every listener is registered on `document` in the **capture** phase and blocks
 * propagation, so the app itself never sees the pointer while inspecting — that is
 * what stops buttons firing when you are only trying to point at them.
 *
 * Finding the Noodl node behind a DOM element means walking React's internals: up
 * the DOM to an element carrying a fiber key, then up the fiber tree to the first
 * component whose props carry a `noodlNode`. There is no public API for this, so it
 * is version-sensitive by nature.
 */
export default class Inspector {
  onMouseMove: (e: MouseEvent) => void;
  onClick: (e: MouseEvent) => void;
  onContextMenu: (e: MouseEvent) => void;
  onMouseOut: (e: MouseEvent) => void;
  blockEvent: (e: Event) => void;
  onDisableHighlight: () => void;
  component?: InspectorComponent;

  constructor({ onInspect, onHighlight, onDisableHighlight }: InspectorCallbacks) {
    this.onMouseMove = (e) => {
      onDisableHighlight();

      const noodlNode = this.findNoodlNode(e.target as Element);
      if (noodlNode) {
        document.body.style.cursor = 'pointer';
        onHighlight(noodlNode.id);
      } else {
        document.body.style.cursor = 'initial';
      }

      e.stopPropagation();
    };

    this.onClick = (e) => {
      onDisableHighlight();

      const noodlNode = this.findNoodlNode(e.target as Element);
      if (noodlNode) {
        onInspect([noodlNode.id]);
      }

      e.stopPropagation();
      e.preventDefault();

      //not sure how to stop React input elements from getting focus, so blurring the potential element tha got focus on click
      if (document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
    };

    this.onContextMenu = (e) => {
      const nodeIds = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((dom) => this.findNoodlNode(dom))
        .filter((node) => !!node)
        .map((node) => node.id);

      if (nodeIds.length) {
        onInspect(nodeIds);
      }

      e.stopPropagation();
      e.preventDefault();

      //not sure how to stop React input elements from getting focus, so blurring the potential element tha got focus on click
      if (document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.onMouseOut = (e) => {
      onDisableHighlight();
    };

    this.blockEvent = (e) => {
      e.stopPropagation();
    };

    this.onDisableHighlight = onDisableHighlight;
  }

  setComponent(component: InspectorComponent): void {
    this.component = component;
  }

  enable(): void {
    //blur active element, if any
    if (document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }

    //get events from capture phase, before they tunnel down the tree
    document.addEventListener('mouseenter', this.blockEvent, true);
    document.addEventListener('mouseover', this.blockEvent, true);
    document.addEventListener('mousedown', this.blockEvent, true);
    document.addEventListener('mouseup', this.blockEvent, true);
    document.addEventListener('mousemove', this.onMouseMove, true);
    document.addEventListener('mouseout', this.onMouseOut, true);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('contextmenu', this.onContextMenu, true);
  }

  disable(): void {
    document.body.style.cursor = 'initial';

    document.removeEventListener('mouseenter', this.blockEvent, true);
    document.removeEventListener('mouseover', this.blockEvent, true);
    document.removeEventListener('mousedown', this.blockEvent, true);
    document.removeEventListener('mouseup', this.blockEvent, true);
    document.removeEventListener('mousemove', this.onMouseMove, true);
    document.removeEventListener('mouseout', this.onMouseOut, true);
    document.removeEventListener('click', this.onClick, true);
    document.removeEventListener('contextmenu', this.onContextMenu, true);

    this.onDisableHighlight();
  }

  findNoodlNode(dom: Element): ReactNodeInstance | undefined {
    //walk the dom tree upwards until a dom element with react state is found
    let domFiber;
    while (!domFiber && dom) {
      // React 18 changed from __reactInternalInstance$ to __reactFiber$
      const key = Object.keys(dom).find(
        (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
      );
      domFiber = dom[key];
      if (!domFiber) dom = dom.parentElement;
    }

    //found none
    if (!domFiber) {
      return undefined;
    }

    const GetCompFiber = (fiber) => {
      let parentFiber = fiber.return;
      while (parentFiber && typeof parentFiber.type == 'string') {
        parentFiber = parentFiber.return;
      }
      return parentFiber;
    };

    //found a react node, now walk the react tree until a noodl node is found
    //(identified by having a noodlNode prop)
    let compFiber = GetCompFiber(domFiber);
    while (compFiber && (!compFiber.stateNode || !compFiber.stateNode.props || !compFiber.stateNode.props.noodlNode)) {
      compFiber = GetCompFiber(compFiber);
    }

    const noodlNode = compFiber ? compFiber.stateNode.props.noodlNode : undefined;
    if (!noodlNode) return;

    if (this.component) {
      let node = noodlNode;

      while (node) {
        if (node.parentNodeScope) {
          if (node.parentNodeScope.componentOwner.name === this.component.name) {
            return node;
          }
          node = node.parentNodeScope.componentOwner;
        } else {
          if (node.nodeScope.componentOwner.name === this.component.name) {
            return node;
          }
          node = node.nodeScope.componentOwner;
        }
      }

      return node;
    }

    return noodlNode;
  }
}
