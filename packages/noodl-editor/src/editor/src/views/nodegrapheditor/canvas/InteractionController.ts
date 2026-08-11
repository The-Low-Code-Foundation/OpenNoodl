import { ipcRenderer } from 'electron';
import _ from 'underscore';

import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { ViewerConnection } from '../../../ViewerConnection';
import { CreateNewNodePanel } from '../../createnewnodepanel';
import { canAcceptDrop, onDrop } from '../../nodegrapheditor.drag';
import PopupLayer from '../../popuplayer';
import { NodeGraphEditorNode } from '../NodeGraphEditorNode';
import { moveCorner, moveRun, splitRun } from '../wireRouting';
import { WireLabel } from './CanvasTheme';
import * as HitTester from './HitTester';
import { IVector2, MouseEventType } from './types';

import type { NodeGraphEditor } from '../../nodegrapheditor';
import type { NodeGraphEditorConnection } from '../NodeGraphEditorConnection';

type MousePosition = {
  x: number;
  y: number;
  pageX?: number;
  pageY?: number;
};

/** A defensive copy of a route. */
function cloneRoute(route: { xs: number[]; ys: number[] } | undefined) {
  // ⚠️ Both arrays, not a shallow spread of the object. The undo entry holds
  // this while the drag mutates the model's, and sharing either array would make
  // "rewind to where the drag started" rewind to where it ended.
  return route ? { xs: route.xs.slice(), ys: route.ys.slice() } : undefined;
}

/**
 * Input state machines for the node graph canvas (PLAT-001 extraction):
 * mouse dispatch, double-click detection, node/comment dragging, connection
 * dragging, rect multiselect, panning and wheel/zoom routing.
 *
 * All interaction *state* lives here. Model mutations (attach/detach/commit
 * move, undo groups), popups and repaint scheduling stay on the editor and are
 * reached through `owner` — the controller decides *when*, the editor decides
 * *what it means*. nodegrapheditor.ts exposes accessors for every public
 * state field so the pre-decomposition surface (comment layer, drag helpers,
 * tests) keeps working.
 */
export class InteractionController {
  // Node dragging
  draggingNodes: NodeGraphEditorNode[] | null = null;
  lastDraggingMousePos: IVector2 = { x: 0, y: 0 };
  startDraggingMousePos: IVector2 = { x: 0, y: 0 };
  dragNodesUndoGroup: UndoActionGroup;
  insertLocation: TSFixme;

  // Connection dragging
  draggingConnection: {
    fromNode: TSFixme;
    toNode?: TSFixme;
    mouseTarget?: TSFixme;
    pos?: TSFixme;
    popupOpen?: TSFixme;
  };

  /**
   * One end of an existing wire is being dragged (CAN-003).
   *
   * Deliberately a sibling of `draggingConnection` rather than a mode inside
   * it: the drop resolves to *remove old + add new*, and the connection stays
   * whole and rendered until it does.
   */
  reroutingConnection: {
    connection: NodeGraphEditorConnection;
    /** Which end is loose. The other keeps its port. */
    end: 'from' | 'to';
    pos: IVector2;
    /** Hover candidate for the loose end. */
    toNode?: NodeGraphEditorNode;
    popupOpen?: boolean;
  };

  /** Escape listener installed for the lifetime of a reroute drag. */
  private cancelRerouteOnEscape: ((evt: KeyboardEvent) => void) | undefined;

  /**
   * A wire's label chip is being slid along its curve (CAN-001). `startT` is
   * kept so the whole drag becomes one undo entry — and so a drag that ends
   * where it started pushes none.
   */
  draggingWireLabel: { connection: NodeGraphEditorConnection; startT: number | undefined };

  /**
   * A square wire's route is being moved (SIG-007).
   *
   * ⚠️ **Nothing is ever created by this drag.** Grabbing a run slides it along
   * the one axis it can travel; grabbing a corner moves the two runs that meet
   * there. An earlier build minted a new corner when you dragged a run, which
   * broke the wire under the pointer at the exact moment the hand expected it to
   * slide — a new corner is an explicit right-click instead.
   *
   * `startRoute` is the route as it was when the drag began, kept so the whole
   * drag is one undo entry and a drag that ends where it started pushes none.
   */
  draggingWireRoute: {
    connection: NodeGraphEditorConnection;
    kind: 'run' | 'corner';
    index: number;
    startRoute: { xs: number[]; ys: number[] } | undefined;
    moved: boolean;
  };

  /**
   * Last value written to the canvas cursor, so a hover that has not changed
   * anything does not write a style on every mousemove (FH-016).
   */
  private canvasCursor = 'inherit';

  // Rect multiselect
  multiselectMouseDown: IVector2;
  multiselectMouseMove: IVector2;
  lastMultiselected: TSFixme;

  // Panning
  panMouseDown: IVector2;
  originMouseDown: TSFixme;

  // Click/double-click tracking
  rightClickPos: TSFixme;
  lastLeftButtonPressedTime: TSFixme;
  leftButtonIsDoubleClicked: boolean;

  /**
   * PNL-002: did the left button go down *on this canvas*?
   *
   * The canvas only ever sees the half of a gesture that happens over it. Drag
   * text to the right in a side-panel field, release past the panel edge, and
   * the canvas gets a bare `mouseup` — which used to clear the node selection,
   * rebuild the property panel, and take the field you were editing away from
   * you. A release is only a click on the canvas if the press was too.
   */
  leftButtonPressedOnCanvas = false;

  latestMousePos: IVector2;
  spaceKeyDown: boolean;
  mouseEventsEnabled = true;

  constructor(private owner: NodeGraphEditor) {}

  /**
   * The single writer for the canvas cursor (FH-016).
   *
   * Everything that wants a cursor comes through here so the last value is
   * always known: panning and label hover would otherwise each cache their own
   * idea of the current cursor and leave the other one stuck.
   *
   * Note this is the *canvas* element's cursor, while node hover writes
   * `owner.el.style.cursor` (the container). The canvas is the child, so its
   * cursor wins where the two disagree, and `'inherit'` is how it stands down.
   */
  private setCursor(cursor: string) {
    if (this.canvasCursor === cursor) return;
    this.canvasCursor = cursor;
    this.owner.setCanvasCursor(cursor);
  }

  startDraggingNode(node: NodeGraphEditorNode) {
    if (this.owner.readOnly) {
      return;
    }

    if (!this.draggingNodes) {
      // Collect all highlighted/selected nodes that are roots in the selection
      let selected = [];
      if (this.owner.selector.isActive(node)) {
        selected = [...this.owner.selector.nodes];
      } else {
        this.owner.selector.unselect();
        this.owner.commentLayer?.clearSelection();
        selected = [node];
      }

      const nodes = [];

      //add the roots
      for (const i in selected) {
        const n = selected[i];
        if (!n.parent || selected.indexOf(n.parent) === -1) {
          nodes.push(n);
        }
      }

      this.startDraggingNodes(nodes);
    }
  }

  startDraggingNodes(nodes: NodeGraphEditorNode[]) {
    this.draggingNodes = nodes || [];

    this.owner.setDOMLayerVisible(false);

    this.lastDraggingMousePos = this.startDraggingMousePos = this.latestMousePos;

    this.dragNodesUndoGroup = new UndoActionGroup({
      label: 'drag nodes'
    });
  }

  startDraggingConnection(fromNode: TSFixme) {
    if (this.owner.readOnly) {
      return false;
    }

    // Clear multiselect
    this.owner.selector.unselect();

    this.owner.setDOMLayerVisible(false);

    this.owner.highlighted && ViewerConnection.instance.sendNodeHighlighted(this.owner.highlighted.model, false);
    this.owner.highlighted = undefined; // Clear highlighted

    this.draggingConnection = { fromNode: fromNode };

    this.draggingConnection.mouseTarget = {
      global: {
        x: this.latestMousePos.x,
        y: this.latestMousePos.y
      }
    };
  }

  /**
   * Grab one end of an existing wire (CAN-003). The model is not touched here
   * — the connection paints with a loose end and the drop decides what it
   * means: over a node it rewires, over empty canvas it deletes, Escape
   * cancels.
   */
  startReroutingConnection(connection: NodeGraphEditorConnection, end: 'from' | 'to') {
    if (this.owner.readOnly) {
      return false;
    }

    this.owner.selector.unselect();
    this.owner.setDOMLayerVisible(false);

    this.owner.highlighted && ViewerConnection.instance.sendNodeHighlighted(this.owner.highlighted.model, false);
    this.owner.highlighted = undefined;

    this.reroutingConnection = { connection, end, pos: this.latestMousePos };
    connection.rerouting = { end, pos: this.latestMousePos };

    // Escape has to reach us even though the canvas is not a focusable element
    // with a key handler of its own.
    this.cancelRerouteOnEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') this.cancelReroutingConnection();
    };
    window.addEventListener('keydown', this.cancelRerouteOnEscape);
  }

  /**
   * End a reroute drag without changing anything. Every exit path goes through
   * here: the DOM layer, the hidden viewer window and the Escape listener are
   * all global state that would otherwise be left switched off.
   */
  cancelReroutingConnection() {
    if (!this.reroutingConnection) return;

    const rerouting = this.reroutingConnection;
    rerouting.connection.rerouting = undefined;
    if (rerouting.toNode) rerouting.toNode.borderHighlighted = false;

    this.reroutingConnection = undefined;

    if (this.cancelRerouteOnEscape) {
      window.removeEventListener('keydown', this.cancelRerouteOnEscape);
      this.cancelRerouteOnEscape = undefined;
    }

    ipcRenderer.send('viewer-show');
    this.owner.setDOMLayerVisible(true);
    this.owner.repaint();
  }

  /** Grab a wire's label chip to slide it along the curve (CAN-001). */
  startDraggingWireLabel(connection: NodeGraphEditorConnection) {
    if (this.owner.readOnly) {
      return false;
    }

    // `this.model.labelT`, never `this.labelT` — the view copies model fields
    // once, at construction, so the view's copy is a snapshot.
    this.draggingWireLabel = { connection, startT: connection.model.labelT };
    this.setCursor('grabbing');
  }

  /** Grab a run of a square wire and slide it (SIG-007). */
  startDraggingWireRun(connection: NodeGraphEditorConnection, index: number) {
    if (this.owner.readOnly) {
      return false;
    }

    this.draggingWireRoute = {
      connection,
      kind: 'run',
      index,
      startRoute: cloneRoute(connection.model.route),
      moved: false
    };
    this.setCursor('grabbing');
  }

  /**
   * Pull a new bend out of a run's "+" (SIG-007).
   *
   * 🔴 **Splitting and dragging are one gesture, deliberately.** Splitting alone
   * does not move the wire — by design, so that adding never also bends — which
   * means a click on the "+" would look like it did nothing at all. Handing the
   * drag straight to the run the split created turns it into "pull a bend out of
   * the wire", which is the thing the mark is inviting you to do.
   */
  startAddingWireCorner(connection: NodeGraphEditorConnection, runIndex: number, pos: IVector2) {
    if (this.owner.readOnly) {
      return false;
    }

    const base = connection.curve;
    if (!base) return false;

    const startRoute = cloneRoute(connection.model.route);
    connection.model.route = splitRun(base, connection.wireRoute(), runIndex, pos);

    // The split inserts a run perpendicular to the one that was clicked, one
    // index along — that is the one now under the pointer, and the one a drag
    // should move.
    this.draggingWireRoute = {
      connection,
      kind: 'run',
      index: runIndex + 1,
      startRoute,
      moved: false
    };
    this.setCursor('grabbing');
    this.owner.repaint();
  }

  /** Grab a corner of a square wire and move both the runs that meet there. */
  startDraggingWireCorner(connection: NodeGraphEditorConnection, index: number) {
    if (this.owner.readOnly) {
      return false;
    }

    this.draggingWireRoute = {
      connection,
      kind: 'corner',
      index,
      startRoute: cloneRoute(connection.model.route),
      moved: false
    };
    this.setCursor('grabbing');
  }

  handleMouseWheelEvent(event: TSFixme, args?: TSFixme) {
    event.preventDefault();

    const pointerDeviceType = this.owner.mouseWheelDetector.changeMode(event);

    if (pointerDeviceType === 'mouse' || event.ctrlKey || event.metaKey) {
      const zoomFactor = pointerDeviceType === 'mouse' ? 1 / 100 : 1 / 10;

      //this function can be called by the comment layer (when a mousewheel event is fired on a comment DOM node)
      //this will send it's own offsets that should override the event offset
      const offsetX = args && args.hasOwnProperty('offsetX') ? args.offsetX : event.offsetX;
      const offsetY = args && args.hasOwnProperty('offsetY') ? args.offsetY : event.offsetY;

      this.owner.updateZoomLevel(offsetX, offsetY, -event.deltaY * zoomFactor);
    } else {
      // Move all roots and relayout
      const panAndScale = this.owner.getPanAndScale();
      const scale = panAndScale.scale;

      this.owner.moveRoots(-event.deltaX / scale, -event.deltaY / scale);
      this.owner.relayout();
      this.owner.repaint();
    }
  }

  doDragNodesAndComments(draggingNodes: TSFixme, type: MouseEventType, pos: IVector2, evt: TSFixme) {
    if (type === 'move') {
      // Move all dragging nodes that are root nodes
      const dx = pos.x - this.lastDraggingMousePos.x;
      const dy = pos.y - this.lastDraggingMousePos.y;

      for (const n of draggingNodes) {
        if (!n.parent) {
          n.x += dx;
          n.y += dy;
        }
      }

      this.owner.commentLayer.moveSelectedComments(dx, dy);

      this.lastDraggingMousePos = pos;

      // If we have dragged more than a given threshold, disconnect all nodes that are
      // currently in the hierarchy.
      if (
        Math.abs(pos.x - this.startDraggingMousePos.x) > NodeGraphEditorNode.attachedThreshold ||
        Math.abs(pos.y - this.startDraggingMousePos.y) > NodeGraphEditorNode.attachedThreshold
      ) {
        for (const n of draggingNodes) {
          if (n.parent) this.owner.detachNode(n.model);
        }
      }

      // If the nodes are detached
      const detached = draggingNodes.length && !_.some(draggingNodes, (n) => n.parent);
      if (detached) {
        for (const i in this.owner.roots) {
          // Don't attached to any nodes that are part of the current dragging
          // nodes
          if (draggingNodes.indexOf(this.owner.roots[i]) !== -1) continue;

          this.insertLocation = this.owner.roots[i].shouldAttach(pos, draggingNodes);
          if (this.insertLocation) break;
        }
      }

      evt.consumed = true;
      this.owner.relayout();
      this.owner.repaint();
    } else if (type === 'up') {
      const isClick =
        Math.abs(pos.x - this.startDraggingMousePos.x) < 5 && Math.abs(pos.y - this.startDraggingMousePos.y) < 5;

      // No insert location simply move the nodes
      // Update the model for all dragging nodes
      if (!isClick && (this.owner.commentLayer.getSelectedComments().length || draggingNodes.length)) {
        //nodes or comments are selected, and we've moved the mouse since the down event
        //this means we've dragged elements around, so consume the event
        for (const n of draggingNodes) {
          this.owner.commitMoveNode(n);
        }

        this.owner.commentLayer.commitSelectedComments({ undo: this.dragNodesUndoGroup });

        evt.consumed = true;
      }

      if (this.insertLocation) {
        // We have a new location for the insert it and relayout
        // Notify the model that a node should be attached
        const loc = this.insertLocation;
        for (let index = draggingNodes.length - 1; index >= 0; index--) {
          const n = draggingNodes[index];
          this.owner.attachNode(loc.parent.model, n.model, loc.index);
        }
        this.insertLocation = undefined;
        evt.consumed = true;
      }

      // Commit undo action group
      if (this.dragNodesUndoGroup && !this.dragNodesUndoGroup.isEmpty()) {
        this.dragNodesUndoGroup.pushAndDo({
          do: () => {
            setTimeout(() => {
              this.owner.layout();
              this.owner.updateNodeToolbar();
            }, 1);
          },
          undo: () => {
            setTimeout(() => {
              this.owner.layout();
              this.owner.updateNodeToolbar();
            }, 1);
          }
        });

        UndoQueue.instance.push(this.dragNodesUndoGroup);
      }
      this.dragNodesUndoGroup = undefined;

      this.draggingNodes = undefined;
    }
  }

  doDragging(type: MouseEventType, pos: IVector2, evt: TSFixme) {
    // Node is being dragged to a new position
    if (this.draggingNodes) {
      this.doDragNodesAndComments(this.draggingNodes, type, pos, evt);
      if (evt.consumed) return true;
    }

    // A wire's label is being slid along its curve (CAN-001)
    if (this.draggingWireLabel) {
      const { connection, startT } = this.draggingWireLabel;

      if (type === 'move') {
        // `findClosestPointOnCurve` is the binary subdivision the canvas
        // already has; the clamp is what keeps the chip off the node cards.
        const t = Math.min(WireLabel.maxT, Math.max(WireLabel.minT, connection.findClosestPointOnCurve(pos)));
        connection.model.labelT = t;

        evt.consumed = true;
        this.owner.repaint();
      } else if (type === 'up') {
        const t = connection.model.labelT;
        this.draggingWireLabel = undefined;
        // The chip followed the pointer, so it is still under it: back to the
        // hover cursor, not to nothing.
        this.setCursor('grab');

        if (t !== startT) {
          // One undo entry for the whole drag: rewind to where it started and
          // let the setter record the move as a single change.
          connection.model.labelT = startT;
          this.owner.model.updateConnection(connection.model, { labelT: t }, { undo: true, label: 'move wire label' });
        }

        evt.consumed = true;
        this.owner.repaint();
      }
      return true;
    }

    // A square wire's route is being moved (SIG-007)
    if (this.draggingWireRoute) {
      const drag = this.draggingWireRoute;
      const { connection } = drag;

      if (type === 'move') {
        const base = connection.curve;
        const route = connection.wireRoute();
        if (base) {
          const next =
            drag.kind === 'corner'
              ? moveCorner(base, route, drag.index, pos)
              : moveRun(base, route, drag.index, pos);

          connection.model.route = next;
          drag.moved = true;
          evt.consumed = true;
          this.owner.repaint();
        }
      } else if (type === 'up') {
        const route = connection.model.route;
        this.draggingWireRoute = undefined;
        this.setCursor('grab');

        // ⚠️ `moved` is not the test here — an "add" has already changed the route
        // on mouse-down, so a click on the "+" that never travels still has a
        // change to record. Comparing the routes covers both gestures.
        if (JSON.stringify(route ?? null) !== JSON.stringify(drag.startRoute ?? null)) {
          // One undo entry for the whole drag: rewind, then let the model verb
          // record the change — the same shape as the wire label drag above.
          connection.model.route = drag.startRoute;
          this.owner.model.updateConnection(
            connection.model,
            { route },
            { undo: true, label: drag.kind === 'corner' ? 'move wire corner' : 'move wire run' }
          );
        }

        // A press that never moved is still a click, and the connection's own
        // `up` handler selects on it. Not consumed, so it gets there.
        if (drag.moved) evt.consumed = true;
        this.owner.repaint();
      }
      return true;
    }

    // An existing wire's end is being dragged (CAN-003)
    if (this.reroutingConnection && !this.reroutingConnection.popupOpen) {
      const rerouting = this.reroutingConnection;
      // The end that stays put decides which node a candidate may not be.
      const pinnedNode =
        rerouting.end === 'to' ? rerouting.connection.fromNode : rerouting.connection.toNode;

      if (type === 'move') {
        ipcRenderer.send('viewer-hide');

        rerouting.pos = pos;
        rerouting.connection.rerouting = { end: rerouting.end, pos };

        if (rerouting.toNode) rerouting.toNode.borderHighlighted = false;

        let toNode: NodeGraphEditorNode;
        for (const i in this.owner.roots) {
          toNode = this.owner.roots[i].shouldConnect(pos, pinnedNode);
          if (toNode) break;
        }

        if (toNode && toNode !== pinnedNode) {
          toNode.borderHighlighted = true;
          rerouting.toNode = toNode;
        } else {
          rerouting.toNode = undefined;
        }

        evt.consumed = true;
        this.owner.repaint();
      } else if (type === 'up') {
        if (rerouting.toNode) {
          // Over a node: ask for the moved end's port, with the other end
          // pinned. The popup resolves it as remove + add in one undo group.
          rerouting.popupOpen = true;
          this.owner.openReroutePanels();
          evt.stopPropagation && evt.stopPropagation();
        } else {
          // Over empty canvas: this is the delete gesture now.
          const model = rerouting.connection.model;
          this.cancelReroutingConnection();
          this.owner.removeConnection(model);
        }

        evt.consumed = true;
        this.owner.repaint();
      }
      return true;
    }

    // A new connections is being dragged
    if (this.draggingConnection && !this.draggingConnection.popupOpen) {
      if (type === 'move') {
        // Hide viewer to get it out of the way
        ipcRenderer.send('viewer-hide');

        this.draggingConnection.pos = pos;

        this.draggingConnection.mouseTarget.global = pos;
        if (this.draggingConnection.toNode) this.draggingConnection.toNode.borderHighlighted = false;

        let toNode;
        for (const i in this.owner.roots) {
          toNode = this.owner.roots[i].shouldConnect(pos, this.draggingConnection.fromNode);
          if (toNode) break;
        }

        if (toNode && toNode != this.draggingConnection.fromNode) {
          toNode.borderHighlighted = true;
          this.draggingConnection.toNode = toNode;
        } else {
          this.draggingConnection.toNode = undefined;
        }

        this.owner.repaint();
      } else if (type === 'up') {
        // Show the viewer again
        ipcRenderer.send('viewer-show');

        if (this.draggingConnection.toNode) {
          // We have a potential new connection
          this.draggingConnection.popupOpen = true;

          this.owner.openConnectionPanels();
          evt.stopPropagation();
        } else {
          // No new connection, clear it
          this.draggingConnection.fromNode.borderHighlighted = false;
          this.draggingConnection = undefined;
        }

        this.owner.repaint();
      }
      return true;
    }

    // Multi select in action
    if (this.multiselectMouseDown) {
      if (type === 'move') {
        let mode = 'select';
        if (evt.shiftKey) mode = 'union';
        else if (evt.ctrlKey) mode = 'reduce';

        this.multiselectMouseMove = pos;
        this.owner.multiselectNodes(
          this.multiselectMouseDown.x,
          this.multiselectMouseDown.y,
          this.multiselectMouseMove.x,
          this.multiselectMouseMove.y,
          mode
        );
        this.owner.repaint();
      } else if (type === 'up') {
        const isClick =
          Math.abs(pos.x - this.multiselectMouseDown.x) < 5 && Math.abs(pos.y - this.multiselectMouseDown.y) < 5;

        if (isClick) {
          this.owner.commentLayer.clearSelection();
        }

        this.multiselectMouseDown = this.multiselectMouseMove = undefined;
        if (!this.owner.selector.active) this.owner.selector.unselect();

        this.owner.repaint();
      }
      return true;
    }
  }

  mouse(type: MouseEventType, pos: MousePosition, evt: TSFixme, args?: TSFixme) {
    if (!this.mouseEventsEnabled || !this.owner.model) {
      return false;
    }

    const owner = this.owner;
    const panAndScale = owner.getPanAndScale();
    const scale = panAndScale.scale;
    const scaledPos = owner.relativeCoordsToNodeGraphCords(pos);

    if (type === 'down' && evt.button === 0) {
      this.leftButtonPressedOnCanvas = true;

      //hide inspectors that aren't pinned
      owner.hideInspectors();
      owner.hideNodeToolbar();
    }

    //Elements in the dom layer (e.g. inspectors) are hidden when a node or connection is being dragged
    //Show them again if a mouse up event is triggered
    else if (type === 'up') {
      owner.setDOMLayerVisible(true);
      owner.updateNodeToolbar();
    }

    // The gesture ends here whatever else this release does, so consume the
    // flag now — the checks below read the snapshot, not the field, because
    // several of the paths between here and them return early.
    const leftButtonPressedOnCanvas = this.leftButtonPressedOnCanvas;
    if (type === 'up' && evt.button === 0) {
      this.leftButtonPressedOnCanvas = false;
    }

    // Check for double clicks
    if (evt.button === 0 && evt.type === 'mousedown') {
      const lastPressed = this.lastLeftButtonPressedTime;
      const now = Date.now();

      if (now - lastPressed < 500) {
        // click interval here!
        this.leftButtonIsDoubleClicked = true;
      } else {
        this.leftButtonIsDoubleClicked = false;
      }

      this.lastLeftButtonPressedTime = now;
    }

    this.latestMousePos = scaledPos;

    if (!this.doDragging(type, scaledPos, evt)) {
      // If we are in "connection mode" then don't do any mouse tracking
      // until it is canceled
      const isPanning = this.panMouseDown || (evt.spaceKey && evt.button === 0);

      if (!isPanning && !(this.draggingConnection && this.draggingConnection.popupOpen)) {
        for (const i in owner.roots) {
          owner.roots[i].propagateMouse(type, scaledPos, evt);
        }
      }

      // Pass mouse to connections
      if (!evt.consumed) {
        for (const i in owner.connections) {
          owner.connections[i].mouse(type, scaledPos, evt);
        }
      }

      // A wire label chip is a grab handle, and until FH-016 nothing on the
      // canvas said so. Owned here rather than in the connection because a node
      // card consumes every `move` it contains, so a connection that set the
      // cursor itself would have no event left to unset it with once the
      // pointer moved off the chip onto a card.
      if (type === 'move' && !this.panMouseDown && !this.draggingNodes && !this.draggingWireLabel) {
        const overLabel = owner.connections.some((c) => c.isPointInLabel && c.isPointInLabel(scaledPos));

        // SIG-007 — **the cursor is the whole affordance for a square wire.**
        // Nothing is painted along a run to say it can be moved (a highlight on
        // every hovered run would be a second, louder wire), so the pointer
        // becomes a resize arrow along the one axis that run can travel, and a
        // corner reports both. If you cannot see it, you will not try it.
        let routeCursor: string | undefined;
        for (const c of owner.connections) {
          if (!c.showsRouteHandles || !c.showsRouteHandles()) continue;
          if (c.cornerHandleAt(scaledPos) !== undefined) {
            routeCursor = 'move';
            break;
          }
          const axis = c.runAxisAt(scaledPos);
          if (axis) {
            routeCursor = axis === 'x' ? 'ew-resize' : 'ns-resize';
            break;
          }
        }

        this.setCursor(routeCursor ?? (overLabel ? 'grab' : 'inherit'));
      } else if (type === 'out' && !this.panMouseDown) {
        this.setCursor('inherit');
      }

      // If a drag item is current in place indicate if
      // a drop can be accepted
      if (PopupLayer.instance.isDragging()) {
        const dragItem = PopupLayer.instance.dragItem;

        // Indicate drop acceptable
        if (type === 'move') {
          if (canAcceptDrop(owner, dragItem)) {
            PopupLayer.instance.indicateDropType('add');
          } else {
            PopupLayer.instance.indicateDropType('none');
          }
        } else if (type === 'out') {
          PopupLayer.instance.indicateDropType('none');
          PopupLayer.instance.setDragMessage();
        }
        // Make the drop
        else if (type === 'up') {
          // Create the new component that was dropped
          if (canAcceptDrop(owner, dragItem)) {
            evt.consumed = onDrop(owner, dragItem, scaledPos);
          }
        }
      }

      if (evt.consumed) {
        return true;
      }

      // Clear selection on left mouse up when no node is
      // highlighted — but only if the press that this release ends happened on
      // the canvas. See `leftButtonPressedOnCanvas`.
      if (
        !owner.readOnly &&
        type === 'up' &&
        evt.button === 0 &&
        leftButtonPressedOnCanvas &&
        !evt.shiftKey &&
        owner.highlighted === undefined &&
        owner.highlightedConnection === undefined
      ) {
        owner.clearSelection();
        owner.repaint();
      }

      // Pan view on right mouse drag, middle mouse drag, or space + left mouse
      if (type === 'down' && (evt.button === 2 || evt.button === 1 || (evt.spaceKey && evt.button === 0))) {
        this.panMouseDown = pos;
        this.setCursor('grabbing');
        evt.consumed = true;
      } else if (type === 'move' && this.panMouseDown) {
        // Move all roots and relayout
        owner.moveRoots((pos.x - this.panMouseDown.x) / scale, (pos.y - this.panMouseDown.y) / scale);
        this.panMouseDown = pos;
        owner.relayout();
        owner.repaint();
        evt.consumed = true;
      } else if ((type === 'up' || type === 'out') && this.panMouseDown) {
        this.panMouseDown = this.originMouseDown = undefined;
        this.setCursor('inherit');
      }

      // Handle right click
      if (type === 'down' && evt.button === 2) {
        this.rightClickPos = pos;
      } else if (type === 'up' && evt.button === 2 && this.rightClickPos) {
        if (
          owner.model &&
          !owner.readOnly &&
          Math.abs(pos.x - this.rightClickPos.x) + Math.abs(pos.y - this.rightClickPos.y) < 10
        ) {
          PopupLayer.instance.hidePopup();
          evt.consumed = true;

          // A wire under the cursor claims the menu first (CAN-003 / F54).
          // Asked before the node hit test because a wire's endpoints sit on a
          // node's edge, and the wire is the smaller, more specific target.
          const connectionUnderCursor = owner.findConnectionAtPoint(scaledPos);
          if (connectionUnderCursor) {
            // SIG-007 passes the click point: *Delete anchor* has to know which
            // anchor was right-clicked, and the menu has no other way to learn it.
            owner.openConnectionRightClickMenu(connectionUnderCursor, scaledPos);
            this.rightClickPos = undefined;
            return true;
          }

          // Check if we're right-clicking on a node (selected or not)
          let nodeUnderCursor: NodeGraphEditorNode = null;

          // First check if clicking on already selected nodes
          if (HitTester.isPointInsideNodes(scaledPos, owner.selector.nodes)) {
            nodeUnderCursor = HitTester.findNodeContaining(scaledPos, owner.selector.nodes);
          }

          // If not on a selected node, check all nodes
          if (!nodeUnderCursor) {
            nodeUnderCursor = HitTester.findNodeAtPoint(scaledPos, owner.roots);
          }

          if (nodeUnderCursor) {
            // Select the node if it isn't already selected
            if (!owner.selector.isActive(nodeUnderCursor)) {
              owner.clearSelection();
              owner.commentLayer?.clearSelection();
              nodeUnderCursor.selected = true;
              owner.selector.select([nodeUnderCursor]);
              owner.repaint();
            }

            // Show context menu
            owner.openRightClickMenu();
          } else if (
            CreateNewNodePanel.shouldShow({
              component: owner.model.owner,
              parentModel: owner.highlighted ? owner.highlighted.model : undefined
            })
          ) {
            owner.createNewNodePanel = new CreateNewNodePanel({
              model: owner.model,
              parentModel: owner.highlighted ? owner.highlighted.model : undefined,
              pos: scaledPos,
              runtimeType: owner.runtimeType
            });
            owner.createNewNodePanel.render();

            PopupLayer.instance.showPopup({
              content: owner.createNewNodePanel,
              /*attachToPoint:{x:pos.pageX, y:pos.pageY},*/
              position: 'screen-center',
              isBackgroundDimmed: true,
              onClose: () => owner.createNewNodePanel.dispose()
            });
          }
          // If clicking empty space with no valid actions, do nothing (no broken tooltip)
        }
        this.rightClickPos = undefined;
      }

      // Start multi select, move is handled in the do dragging function
      if (
        !owner.readOnly &&
        !evt.consumed &&
        type === 'down' &&
        evt.button === 0 &&
        !evt.spaceKey &&
        owner.highlighted === undefined &&
        owner.highlightedConnection === undefined &&
        this.draggingConnection === undefined &&
        !(args && args.eventPropagatedFromCommentLayer)
      ) {
        // Store last multi select reduce and union operations
        this.lastMultiselected = owner.selector.nodes;

        // reset current multi selection if it's not the start of a new multi select operation (ctrl or shift is pressed)
        if (!evt.ctrlKey && !evt.shiftKey) {
          owner.commentLayer.clearMultiselection();
          owner.clearSelection();
        } else {
          owner.selector.select(this.lastMultiselected);
        }

        this.multiselectMouseDown = scaledPos;

        owner.repaint();
      }
    }

    const needRepaint =
      type != 'over' && type !== 'out' && !(type === 'move' && !this.rightClickPos && evt.button !== 0);

    if (needRepaint) {
      owner.relayout();
      owner.repaint();
    }

    return evt.consumed;
  }
}
