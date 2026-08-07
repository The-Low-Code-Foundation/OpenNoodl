import type { ReactNodeInstance } from './react-component-node';

/** The slice of `NoodlRuntime` the highlighter reaches for. */
interface HighlighterRuntime {
  rootComponent?: {
    nodeScope: {
      getNodesWithIdRecursive(nodeId: string): ReactNodeInstance[];
    };
  };
  eventEmitter: {
    once(event: string, callback: () => void): void;
  };
  [extra: string]: unknown;
}

/**
 * Draws the editor's hover and selection outlines over the running app.
 *
 * The outlines live in one fixed, pointer-events-none div appended to `body`,
 * and are repositioned every animation frame rather than anchored to the target
 * elements — nothing tells us when a node moves, so polling is the only option.
 * The loop stops itself once nothing is highlighted or selected.
 */
export class Highlighter {
  highlightedNodes: Map<ReactNodeInstance, HTMLDivElement>;
  selectedNodes: Map<ReactNodeInstance, HTMLDivElement>;
  noodlRuntime: HighlighterRuntime;
  isUpdatingHighlights: boolean;
  highlightRootDiv: HTMLDivElement;
  windowBorderDiv: HTMLDivElement;

  constructor(noodlRuntime: HighlighterRuntime) {
    this.highlightedNodes = new Map();
    this.selectedNodes = new Map();
    this.noodlRuntime = noodlRuntime;

    this.isUpdatingHighlights = false;

    //create the div that holds the highlight and selection UI
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.top = '0';
    div.style.left = '0';
    div.style.overflow = 'hidden';
    div.style.position = 'fixed';
    div.style.zIndex = '1000000000';
    div.style.pointerEvents = 'none';
    document.body.appendChild(div);
    this.highlightRootDiv = div;

    this.windowBorderDiv = this.createHighlightDiv();
    this.windowBorderDiv.style.position = 'absolute';
    this.windowBorderDiv.style.top = '0';
    this.windowBorderDiv.style.left = '0';
    this.windowBorderDiv.style.boxShadow = 'inset 0 0 0 3px #2CA7BA';
    this.windowBorderDiv.style.opacity = '1.0';
    this.windowBorderDiv.style.width = '100vw';
    this.windowBorderDiv.style.height = '100vh';
  }

  createHighlightDiv(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.top = '0';
    div.style.left = '0';
    div.style.outline = '2px solid #2CA7BA';
    div.style.opacity = '1.0';
    return div;
  }

  /**
   * @param enabled Unused — the whole window-border feature returns immediately.
   * Kept because `viewer.jsx` and the editor's highlight API both call it.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setWindowSelected(enabled: boolean): void {
    return; //disable this feature for now, needs some iteration

    /*if (enabled) {
      this.highlightRootDiv.appendChild(this.windowBorderDiv);
    } else {
      this.windowBorderDiv.parentNode && this.windowBorderDiv.parentNode.removeChild(this.windowBorderDiv);
    }*/
  }

  updateHighlights(): void {
    const items = Array.from(this.highlightedNodes.entries()).concat(Array.from(this.selectedNodes.entries()));

    for (const item of items) {
      const domNode = item[0].getDOMElement && item[0].getDOMElement();

      if (!domNode) {
        //user has deleted this node, just remove it
        // NOTE: this only ever deletes from `highlightedNodes`, but `items` is the
        // concatenation of both maps — a *selected* node whose element has gone is
        // therefore never removed from `selectedNodes`, so it is revisited (and its
        // div `remove()`d again) on every subsequent frame. Recorded rather than
        // fixed: the correct disposal semantics are a behavioural decision.
        this.highlightedNodes.delete(item[0]);
        item[1].remove();
        continue;
      }

      const rect = domNode.getBoundingClientRect();
      const highlight = item[1];

      highlight.style.transform = `translateX(${rect.x}px) translateY(${rect.y}px)`;
      highlight.style.width = rect.width + 'px';
      highlight.style.height = rect.height + 'px';
    }

    this.isUpdatingHighlights = this.highlightedNodes.size > 0 || this.selectedNodes.size > 0;

    if (this.isUpdatingHighlights) {
      requestAnimationFrame(this.updateHighlights.bind(this));
    }
  }

  highlightNodesWithId(nodeId: string): void {
    //gather all nodes with a DOM node we can highlight, that aren't already highlighted
    const nodes = getNodes(this.noodlRuntime, nodeId)
      .filter((node) => node.getRef)
      .filter((node) => !this.highlightedNodes.has(node));

    for (const node of nodes) {
      const highlight = this.createHighlightDiv();

      this.highlightRootDiv.appendChild(highlight);
      this.highlightedNodes.set(node, highlight);
    }

    if ((this.selectedNodes.size > 0 || this.highlightedNodes.size > 0) && !this.isUpdatingHighlights) {
      this.updateHighlights();
    }
  }

  disableHighlight(): void {
    // `Array.from(...entries())` rather than `for…of` over the Map directly: this
    // project targets es5 without `downlevelIteration`, so iterating a Map is a
    // compile error. Same traversal, same order.
    for (const item of Array.from(this.highlightedNodes.entries())) {
      const highlight = item[1];
      if (highlight) {
        highlight.remove();
      }
    }
    this.highlightedNodes.clear();
  }

  selectNodesWithId(nodeId: string): ReactNodeInstance[] {
    //we don't track when nodes are created, so if there's no root component, wait a while and then highlight so we can get all the instances
    //TODO: track nodes as they're created so newly created nodes can be selected if their IDs match
    if (!this.noodlRuntime.rootComponent) {
      this.noodlRuntime.eventEmitter.once('rootComponentUpdated', () => {
        setTimeout(() => {
          this.selectNodesWithId(nodeId);
        }, 300);
      });
    }

    const nodes = getNodes(this.noodlRuntime, nodeId)
      .filter((node) => node.getRef)
      .filter((node) => !this.selectedNodes.has(node));

    for (const node of nodes) {
      const selection = this.createHighlightDiv();

      this.highlightRootDiv.appendChild(selection);
      this.selectedNodes.set(node, selection);
    }

    if (this.selectedNodes.size > 0) {
      this.setWindowSelected(false);
    }

    if ((this.selectedNodes.size > 0 || this.highlightedNodes.size > 0) && !this.isUpdatingHighlights) {
      this.updateHighlights();
    }

    return nodes;
  }

  deselectNodes(): void {
    // See `disableHighlight` — es5 target, so no direct Map iteration.
    for (const item of Array.from(this.selectedNodes.entries())) {
      const selection = item[1];
      if (selection) {
        selection.remove();
      }
    }
    this.selectedNodes.clear();
  }
}

function getNodes(noodlRuntime: HighlighterRuntime, nodeId: string): ReactNodeInstance[] {
  if (!noodlRuntime.rootComponent) {
    return [];
  }
  return noodlRuntime.rootComponent.nodeScope.getNodesWithIdRecursive(nodeId);
}
