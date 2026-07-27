import { ipcRenderer } from 'electron';
import _ from 'underscore';

import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { ViewerConnection } from '../../../ViewerConnection';
import { CreateNewNodePanel } from '../../createnewnodepanel';
import { canAcceptDrop, onDrop } from '../../nodegrapheditor.drag';
import PopupLayer from '../../popuplayer';
import { NodeGraphEditorNode } from '../NodeGraphEditorNode';
import * as HitTester from './HitTester';
import { IVector2, MouseEventType } from './types';

import type { NodeGraphEditor } from '../../nodegrapheditor';

type MousePosition = {
  x: number;
  y: number;
  pageX?: number;
  pageY?: number;
};

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
        owner.setCanvasCursor('grabbing');
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
        owner.setCanvasCursor('inherit');
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
