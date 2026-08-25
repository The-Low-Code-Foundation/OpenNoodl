import {
  BoxModelOverlay,
  clipsAtRadius,
  overlayRadii,
  radiiToCss,
  readCornerRadii,
  type RectLike
} from './box-model-overlay';
import type { ReactNodeInstance } from './react-component-node';
import { TransformOriginCrosshair } from './transform-origin-crosshair';

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
  /**
   * FB-016 — the box model, drawn for one element at a time.
   *
   * Owned here rather than created per highlighted node: two chips saying the same thing cover
   * the content the author is trying to read, and the hovered node and the selected node are
   * usually the same element anyway.
   */
  boxOverlay: BoxModelOverlay;
  /**
   * 🔴 **The box model draws in design mode only, and this flag is the whole of that gate.**
   * `NoodlEditorHighlightAPI.selectNode` is called whenever the editor's selection changes —
   * in preview mode too — so without it, clicking a node in the graph would drop a chip of CSS
   * facts over a running app nobody asked to inspect.
   */
  designMode: boolean;
  /**
   * FB-016 scope 4 — the transform-origin crosshair, drawn while the editor's transform-origin
   * field has focus.
   *
   * ⚠️ **Deliberately *not* behind `designMode`, unlike the box model.** That gate exists because
   * selection is pushed across the bridge in preview mode too, so a chip would appear over a
   * running app nobody asked to inspect. This one cannot: it is on only while an author is holding
   * focus in one specific property field, which is an explicit ask in either mode — and the teal
   * selection outline, whose trigger is the same kind of deliberate act, is not gated either.
   */
  originCrosshair: TransformOriginCrosshair;
  transformOriginFocused: boolean;

  constructor(noodlRuntime: HighlighterRuntime) {
    this.highlightedNodes = new Map();
    this.selectedNodes = new Map();
    this.noodlRuntime = noodlRuntime;

    this.isUpdatingHighlights = false;
    this.designMode = false;
    this.transformOriginFocused = false;

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

    this.boxOverlay = new BoxModelOverlay(div);
    this.originCrosshair = new TransformOriginCrosshair(div);

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

  /**
   * Follows `NoodlEditorInspectorAPI.setEnabled`, which is design mode itself (DES-001).
   */
  setDesignMode(enabled: boolean): void {
    this.designMode = enabled;
    if (!enabled) {
      this.boxOverlay.clear();
    }
  }

  /**
   * FB-016 scope 4 — follows focus on the editor's transform-origin field.
   *
   * The rAF loop is kicked here rather than waited for: an author who selects a node and goes
   * straight to the properties panel leaves the pointer behind, and the loop may well already
   * have settled by the time the field takes focus.
   */
  setTransformOriginFocus(enabled: boolean): void {
    this.transformOriginFocused = enabled;

    if (!enabled) {
      this.originCrosshair.clear();
      return;
    }

    if ((this.selectedNodes.size > 0 || this.highlightedNodes.size > 0) && !this.isUpdatingHighlights) {
      this.updateHighlights();
    }
  }

  updateHighlights(): void {
    const items = Array.from(this.highlightedNodes.entries()).concat(Array.from(this.selectedNodes.entries()));

    let focus: { element: HTMLElement; computed: CSSStyleDeclaration; rect: RectLike } | null = null;
    let focusIsHovered = false;
    /**
     * The crosshair's subject, which is the **selected** node and not the hovered one — the
     * opposite preference to the box model's, for the opposite reason. The properties panel edits
     * the selection, so the field that turns the crosshair on is describing that node; and the
     * pointer is over the panel at the time, so whatever it happens to be hovering is incidental.
     */
    let selectedFocus: { element: HTMLElement; computed: CSSStyleDeclaration; rect: RectLike } | null = null;

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

      // FB-016 scope 5 — a rectangle drawn over a rounded element is what one test user read as
      // *"corner radius rendered as a box outline — possible render bug"*. `outline` follows
      // `border-radius`, so rounding the div rounds the teal line with it.
      const computed = window.getComputedStyle(domNode);
      highlight.style.borderRadius = radiiToCss(
        overlayRadii({
          radii: readCornerRadii(computed),
          borderRect: rect,
          clips: clipsAtRadius(domNode.tagName, computed),
          childRects: childRects(domNode)
        })
      );

      // The hovered node wins the box model; a selection keeps it once the pointer has left for
      // the properties panel, which is exactly when an author is changing the numbers it explains.
      const hovered = this.highlightedNodes.has(item[0]);
      if (!focus || (hovered && !focusIsHovered)) {
        focus = { element: domNode, computed, rect };
        focusIsHovered = hovered;
      }

      if (!selectedFocus && this.selectedNodes.has(item[0])) {
        selectedFocus = { element: domNode, computed, rect };
      }
    }

    if (this.designMode && focus) {
      this.boxOverlay.update(focus.element, focus.computed, focus.rect);
    } else {
      this.boxOverlay.clear();
    }

    const originSubject = selectedFocus || focus;
    if (this.transformOriginFocused && originSubject) {
      // The box chip is placed first (just above), so its rect is this frame's — the crosshair's
      // label is moved clear of it rather than drawn on top, which is what the first drive showed.
      this.originCrosshair.update(
        originSubject.element,
        originSubject.computed,
        originSubject.rect,
        this.boxOverlay.chipRect()
      );
    } else {
      this.originCrosshair.clear();
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

/** Only element children can paint over a corner, and only the first few are worth asking. */
function childRects(element: HTMLElement): RectLike[] {
  const rects: RectLike[] = [];
  const children = element.children;
  const count = Math.min(children.length, 40);
  for (let i = 0; i < count; i++) {
    rects.push(children[i].getBoundingClientRect());
  }
  return rects;
}

function getNodes(noodlRuntime: HighlighterRuntime, nodeId: string): ReactNodeInstance[] {
  if (!noodlRuntime.rootComponent) {
    return [];
  }
  return noodlRuntime.rootComponent.nodeScope.getNodesWithIdRecursive(nodeId);
}
