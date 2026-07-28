import { AiAssistantModel } from '@noodl-models/AiAssistant/AiAssistantModel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { SidebarModel } from '@noodl-models/sidebar';
import { UndoQueue } from '@noodl-models/undo-queue-model';
import { EditorSettings } from '@noodl-utils/editorsettings';
import KeyboardHandler, { KeyboardCommand } from '@noodl-utils/keyboardhandler';
import { getComponentModelRuntimeType } from '@noodl-utils/NodeGraph';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import View from '../../../shared/ListenableView';
import { ComponentModel } from '../models/componentmodel';
import {
  Connection,
  NodeGraphModel,
  NodeGraphNode,
  NodeGraphNodeJSON,
  NodeGraphNodeSet
} from '../models/nodegraphmodel';
import { NodeLibrary } from '../models/nodelibrary';
import { ProjectModel } from '../models/projectmodel';
import { WarningsModel } from '../models/warningsmodel';
import { HighlightManager } from '../services/HighlightManager';
import DebugInspector from '../utils/debuginspector';
import CommentLayer from './commentlayer';
// Import test utilities for console debugging (dev only)
import '../services/HighlightManager/test-highlights';
import { CreateNewNodePanel } from './createnewnodepanel';
import { TitleBar } from './documents/EditorDocument/titlebar';
import { CanvasIcons } from './nodegrapheditor/canvas/CanvasIcons';
import { CanvasRenderer } from './nodegrapheditor/canvas/CanvasRenderer';
import { CanvasTheme } from './nodegrapheditor/canvas/CanvasTheme';
import { CanvasViewport } from './nodegrapheditor/canvas/CanvasViewport';
import * as HitTester from './nodegrapheditor/canvas/HitTester';
import { InteractionController } from './nodegrapheditor/canvas/InteractionController';
import { NodeSelector } from './nodegrapheditor/canvas/NodeSelector';
import { AABB, CenterToFitMode, IVector2, MouseEventType, PanAndScale } from './nodegrapheditor/canvas/types';
import { OverlayHost } from './nodegrapheditor/canvas/OverlayHost';
import { bindNodeGraphCanvas } from './nodegrapheditor/CanvasDOMBindings';
import { CanvasPainter } from './nodegrapheditor/CanvasPainter';
import { CanvasShell, createCanvasShell } from './nodegrapheditor/CanvasShell';
import { ConnectionPopups } from './nodegrapheditor/ConnectionPopups';
import { EditorClipboard } from './nodegrapheditor/EditorClipboard';
import { registerEditorEventBindings, registerRenderEventBindings } from './nodegrapheditor/EditorEventBindings';
import { InspectorActions } from './nodegrapheditor/InspectorActions';
import { ModelBindings } from './nodegrapheditor/ModelBindings';
import { NavigationHistory } from './nodegrapheditor/NavigationHistory';
import { NodeContextMenu } from './nodegrapheditor/NodeContextMenu';
import { ALWAYS_SHOW_WIRE_LABELS, NodeGraphEditorConnection } from './nodegrapheditor/NodeGraphEditorConnection';
import { NodeGraphEditorNode } from './nodegrapheditor/NodeGraphEditorNode';
import { NodeOperations } from './nodegrapheditor/NodeOperations';
import { OverlayViews } from './nodegrapheditor/OverlayViews';
import { SelectionActions } from './nodegrapheditor/SelectionActions';
import { ViewportActions } from './nodegrapheditor/ViewportActions';
import { ToastLayer } from './ToastLayer/ToastLayer';

// Styles
require('../styles/nodegrapheditor.css');

export { CenterToFitMode };
export type { IVector2 };

type MousePosition = {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
};

/**
 * A mouse event as the canvas sees it: usually the native `MouseEvent` handed
 * over by `CanvasDOMBindings`, but the comment layer and the canvas specs also
 * synthesise partial stand-ins. `consumed` is the editor's own propagation flag
 * and `spaceKey` is set from the keyboard handler's space-is-held state.
 */
type NodeGraphMouseEvent = Partial<MouseEvent> & { consumed?: boolean; spaceKey?: boolean };

export class NodeGraphEditor extends View {
  el: HTMLElement;

  /** Typed handles on the DOM shell built by `render()`. */
  shell: CanvasShell;
  model: NodeGraphModel;
  roots: NodeGraphEditorNode[];
  connections: TSFixme[];
  inspectors: TSFixme[];
  origin: { x: number; y: number };
  navigationHistory: NavigationHistory;

  canvas: {
    desiredWidth: number;
    desiredHeight: number;
    ratio: number;
    width: number;
    height: number;
    ctx: CanvasRenderingContext2D;
  };

  selector = new NodeSelector();

  /** Pan/zoom state and coordinate math (PLAT-001 extraction). */
  viewport = new CanvasViewport();

  /** Per-frame canvas painting (PLAT-001 extraction). */
  renderer = new CanvasRenderer();

  /** Input state machines: drag, connection drag, multiselect, pan (PLAT-001 extraction). */
  interaction = new InteractionController(this);

  /** Copy/cut/paste/delete and node-set insertion (PLAT-001 wave 2 extraction). */
  clipboardActions = new EditorClipboard(this);

  /** Connection port-picker popouts shown when a dragged connection lands (PLAT-001 wave 2 extraction). */
  connectionPopups = new ConnectionPopups(this);

  /** Node toolbar + right-click context menu (PLAT-001 wave 2 extraction). */
  contextMenu = new NodeContextMenu(this);

  /** Model→view event bindings (PLAT-001 wave 2 extraction). */
  modelBindings = new ModelBindings(this);

  /** Long-lived React overlays: tabs, banner, highlight/execution, title trail (PLAT-001 wave 2 extraction). */
  overlayViews = new OverlayViews(this);

  /** Selection policy: click/multiselect semantics + panel side effects (PLAT-001 wave 2 extraction). */
  selectionActions = new SelectionActions(this);

  /** Debug-inspector hover/show behaviour and inspector registry (PLAT-001 wave 2 extraction). */
  inspectorActions = new InspectorActions(this);

  /** Model mutations from canvas gestures: create/attach/detach/commit-move (PLAT-001 wave 2 extraction). */
  nodeOperations = new NodeOperations(this);

  /** Pan/zoom side-effect coordination: comment layer + overlay sync, clamping (PLAT-001 wave 3 extraction). */
  viewportActions = new ViewportActions(this);

  /** Layout/paint pipeline: measure, AABB, per-frame FrameState assembly (PLAT-001 wave 3 extraction). */
  painter = new CanvasPainter(this);

  commentLayer: CommentLayer;
  _disposed: boolean;
  highlighted: NodeGraphEditorNode;
  stateText: string;
  domElementContainer: HTMLDivElement;
  currentLayout: TSFixme;
  topLeftCanvasPos: number[];
  mouseWheelDetector: TSFixme;
  inspectorsModel: DebugInspector.InspectorsModel;
  lastBlocklyTabCloseTime: number = 0; // Track when Blockly tabs close to prevent accidental deletions

  componentName: TSFixme;
  componentFolder: string;
  highlightedConnection: TSFixme;

  /**
   * The wire the user has clicked (CAN-003). Hover is `highlightedConnection`;
   * this is selection, and it is what Delete and the connection context menu
   * act on. Only ever one — wires are not multi-selectable.
   */
  selectedConnection: NodeGraphEditorConnection;
  createNewNodePanel: CreateNewNodePanel;

  relayoutNeeded: boolean;
  layoutAndPaintScheduled: boolean;
  activeComponent: ComponentModel;

  public runtimeType: RuntimeType = undefined;
  keyboardCommands: KeyboardCommand[];

  /** Canvas-painted icon images; NodeGraphEditorNode reads these as `owner.icons.*`. */
  icons: CanvasIcons;

  readOnly: boolean;

  nodesIdsAnimating: string[];
  isPlayingNodeAnimations: boolean;

  /** All React roots over the canvas go through this host (PLAT-001 extraction). */
  overlays = new OverlayHost();

  constructor(args) {
    super();

    this.el = args.el;
    this.model = args.model;
    this.roots = [];
    this.connections = [];
    this.inspectors = [];
    this.origin = { x: 0, y: 0 };
    this.navigationHistory = new NavigationHistory({ owner: this });
    // this.breadcrumbs = [];
    this.canvas = {
      desiredWidth: 100,
      desiredHeight: 100,
      ratio: NaN,
      width: NaN,
      height: NaN,
      ctx: undefined
    };

    if (import.meta.webpackHot) {
      import.meta.webpackHot.accept('./createnewnodepanel');
    }

    // EventDispatcher/Sidebar subscriptions (context = this editor, detached
    // in dispose) and the canvas keyboard commands.
    this.keyboardCommands = registerEditorEventBindings(this);
    KeyboardHandler.instance.registerCommands(this.keyboardCommands);

    // Load icons using webpack require to ensure proper bundling
    this.icons = new CanvasIcons(() => this.repaint());

    // Theme change (UIX-005/UIX-008): CanvasTheme re-resolves its colours,
    // we repaint. Context = this editor, detached in dispose.
    CanvasTheme.instance.on(() => this.repaint(), this);

    // Same shape of concern for the wire-label setting (CAN-001): flipping it
    // changes what every wire paints, so the canvas has to hear about it.
    EditorSettings.instance.on(
      'updated',
      (args) => {
        if (args?.key === ALWAYS_SHOW_WIRE_LABELS) this.repaint();
      },
      this
    );
  }

  dispose() {
    AiAssistantModel.instance.off(this);
    KeyboardHandler.instance.deregisterCommands(this.keyboardCommands);

    CanvasTheme.instance.off(this);
    EditorSettings.instance.off(this);
    EventDispatcher.instance.off(this);
    NodeLibrary.instance.off(this);
    ProjectModel.instance && ProjectModel.instance.off(this);
    WarningsModel.instance.off(this);

    this.inspectorsModel?.off(this);

    this.commentLayer && this.commentLayer.dispose();

    // Clean up React roots. Pre-PLAT-001 this only unmounted the highlight
    // overlay and canvas tabs roots; the banner, execution overlay and title
    // roots leaked. unmountAll covers every root registered with the host.
    this.overlays.unmountAll();
    this.contextMenu.releaseToolbarHandle();

    SidebarModel.instance.off(this);

    this.reset();

    this._disposed = true;
  }

  setReadOnly(readOnly: boolean) {
    this.readOnly = readOnly;
    this.commentLayer?.setReadOnly(readOnly);

    // Update banner visibility when read-only status changes
    if (this.overlays.hasSlot('editor-banner')) {
      this.overlayViews.renderEditorBanner();
    }

    // PAR-003: the HUD's AI pill is hidden on read-only canvases
    this.overlayViews.updateCanvasHud();
  }

  reset() {
    this.modelBindings.reset();
  }

  bindModel(model?: NodeGraphModel) {
    this.modelBindings.bindModel(model);
  }

  bindProjectModel() {
    this.modelBindings.bindProjectModel();
  }

  startNodeAnimations() {
    this.painter.startNodeAnimations();
  }

  stopNodeAnimations() {
    this.painter.stopNodeAnimations();
  }

  render() {
    // Expose editor instance to window for console debugging (dev only)
    // Used by test utilities: window.testHighlightManager.testBasicHighlight()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__nodeGraphEditor = this;

    this.shell = createCanvasShell();
    this.el = this.shell.root;

    this.domElementContainer = this.shell.domLayer;
    this.commentLayer = new CommentLayer(this);
    this.commentLayer.setReadOnly(this.readOnly);

    // Bind canvas
    this.bindCanvas();

    // Bind model
    this.bindModel(this.model);

    this.bindProjectModel();

    // Model/library subscriptions (context = this editor, detached in dispose)
    registerRenderEventBindings(this);

    //the comment layer is using react-dnd which caches the parent position the first time a comment is rendered.
    //it's crucial that the parent position is correct, so delay the rendering a tick so all the DOM elements are in the right place
    setTimeout(() => {
      this.commentLayer.renderTo(this.shell.commentLayerBg, this.shell.commentLayerFg);
    }, 1);

    // Render the highlight overlay
    setTimeout(() => {
      this.overlayViews.renderHighlightOverlay();
    }, 1);

    // Render the canvas tabs
    setTimeout(() => {
      this.overlayViews.renderCanvasTabs();
    }, 1);

    // Render the editor banner (for read-only mode)
    setTimeout(() => {
      this.overlayViews.renderEditorBanner();
    }, 1);

    // Render the execution overlay (CF11-007)
    setTimeout(() => {
      this.overlayViews.renderExecutionOverlay();
    }, 1);

    // Render the canvas HUD (PAR-003: AI pill + zoom cluster)
    setTimeout(() => {
      this.overlayViews.renderCanvasHud();
    }, 1);

    this.relayout();
    this.repaint();

    return this.el;
  }

  /**
   * Get node bounds for the viewport-tracking overlays (documented overlay
   * contract). Maps a node id to its current graph-space bounds.
   */
  getNodeBounds = (nodeId: string) => this.overlayViews.getNodeBounds(nodeId);

  /**
   * Set canvas visibility (hide when Logic Builder is open, show when closed)
   */
  setCanvasVisibility(visible: boolean) {
    this.overlayViews.setCanvasVisibility(visible);
  }

  // This is called by the parent view (frames view) when the size and position
  // changes
  resize(layout) {
    this.viewportActions.resize(layout);
  }

  // ------------------------- Cut n paste (EditorClipboard) --------------------------------
  getSelectedNodes(): NodeGraphEditorNode[] {
    return this.clipboardActions.getSelectedNodes();
  }

  copySelected() {
    return this.clipboardActions.copySelected();
  }

  delete() {
    return this.clipboardActions.delete();
  }

  copy() {
    this.clipboardActions.copy();
  }

  cut() {
    return this.clipboardActions.cut();
  }

  insertNodeSet(args: { nodeset: NodeGraphNodeSet; x: number; y: number; toastMessage: string }) {
    return this.clipboardActions.insertNodeSet(args);
  }

  paste() {
    this.clipboardActions.paste();
  }

  // --------------------------------- Undo n redo ------------------------------------------
  undo() {
    if (this.readOnly) {
      return false;
    }

    const action = UndoQueue.instance.undo();
    if (action) {
      ToastLayer.showInteraction('Undo ' + action.label);
    } else {
      ToastLayer.showInteraction('Nothing to undo');
    }
  }

  redo() {
    if (this.readOnly) {
      return false;
    }

    const action = UndoQueue.instance.redo();
    if (action) {
      ToastLayer.showInteraction('Redo ' + action.label);
    } else {
      ToastLayer.showInteraction('Nothing to redo');
    }
  }

  getDevicePixelRatio(ctx) {
    return CanvasViewport.devicePixelRatio(ctx);
  }

  bindCanvas() {
    bindNodeGraphCanvas(this);
  }

  setSpaceKeyDown(pressed) {
    if (this.interaction.spaceKeyDown === pressed) {
      return;
    }

    this.interaction.spaceKeyDown = pressed;
    this.canvas.ctx.canvas.style.cursor = pressed ? 'grab' : 'inherit';
  }

  isSpaceKeyDown(): boolean {
    return this.interaction.spaceKeyDown;
  }

  getLatestMousePos(): IVector2 {
    return this.interaction.latestMousePos;
  }

  handleMouseWheelEvent(event, args?) {
    this.interaction.handleMouseWheelEvent(event, args);
  }

  updateZoomLevel(x, y, deltaZ) {
    this.viewportActions.updateZoomLevel(x, y, deltaZ);
  }

  forEachNode(callback) {
    HitTester.forEachNode(this.roots, callback);
  }

  addNodeToSelection(node: NodeGraphEditorNode) {
    this.selectionActions.addNodeToSelection(node);
  }

  startDraggingNode(node: NodeGraphEditorNode) {
    this.interaction.startDraggingNode(node);
  }

  setDOMLayerVisible(visible) {
    this.domElementContainer.style.display = visible ? '' : 'none';

    if (visible) {
      for (const inspector of this.inspectors) {
        inspector.render();
      }
    }
  }

  startDraggingNodes(nodes) {
    this.interaction.startDraggingNodes(nodes);
  }

  startDraggingConnection(fromNode) {
    return this.interaction.startDraggingConnection(fromNode);
  }

  removeRoot(node) {
    const idx = this.roots.indexOf(node);
    idx !== -1 && this.roots.splice(idx, 1);
  }

  moveRoots(dx, dy) {
    this.viewportActions.moveRoots(dx, dy);
  }

  createNewNode(type: ComponentModel, pos: IVector2, options: Partial<NodeGraphNodeJSON> = {}) {
    this.nodeOperations.createNewNode(type, pos, options);
  }

  deselect(args?: { disableHidePanels: boolean }) {
    this.selectionActions.deselect(args);
  }

  clearSelection(args?: { disableHidePanels: boolean }) {
    this.selectionActions.clearSelection(args);
  }

  updateTitle() {
    this.overlayViews.updateTitle();
  }

  switchToComponent(
    component?: ComponentModel,
    args?: {
      node?: NodeGraphNode;
      pushHistory?: boolean;
      replaceHistory?: boolean;
    }
  ) {
    if (!component) {
      this.activeComponent?.off(this);
      this.activeComponent = undefined;
      this.runtimeType = undefined;
      this.updateTitle();
      this.bindModel();

      this.relayout();
      this.repaint();

      this.commentLayer.setComponentModel(undefined);

      // Clear all highlights when closing/switching away from component
      HighlightManager.instance.clearAll();

      return;
    }

    // Update the runtime type, this is required for the node picker
    this.runtimeType = getComponentModelRuntimeType(component);

    if (this.activeComponent !== component) {
      this.activeComponent?.off(this);

      // Clear highlights when switching to a different component
      HighlightManager.instance.clearAll();

      this.activeComponent = component;

      /**
       * F48, closed as a rule rather than per caller (WFA-006).
       *
       * `NavigationHistory` resolves every entry through
       * `ProjectModel.getComponentWithName`, which cannot find a workflow — so an
       * entry pushed for one is a dead stop that back/forward silently refuses to
       * move through. WFA-004 kept workflows out by passing `pushHistory: false`
       * at its one call site; WFA-006 adds a second door (the trail's crumb back
       * from a descent), and a rule that every caller has to remember is a rule
       * that gets forgotten. Decided by runtime type, in the place that has just
       * computed it.
       */
      const canPushHistory = this.runtimeType !== RuntimeType.Workflow;

      if (args?.replaceHistory) {
        this.navigationHistory.reset();
        if (canPushHistory) this.navigationHistory.push(component);
      } else if (args?.pushHistory && canPushHistory) {
        this.navigationHistory.push(component);
      }

      TitleBar.instance.getWarningsAmount(component);
      this.bindModel(component.graph);

      this.commentLayer.setComponentModel(component);

      //If the components graph model is changed, rebind the new model
      //Can be triggered when a user reset a component in the git panel
      component.on(
        'graphModelBound',
        () => {
          this.bindModel(component.graph);
        },
        this
      );

      // Notify HighlightManager of component change for cross-component path highlighting
      HighlightManager.instance.setCurrentComponent(component.fullName);

      EventDispatcher.instance.emit('activeComponentChanged', { component });
    }

    this.notifyListeners('activeComponentChanged', {
      model: component,
      args: args
    });

    // Should we select a node
    this.viewport.panAndScale = undefined;
    if (args?.node) {
      const node = this.findNodeWithId(args.node.id);
      if (node) {
        this.clearSelection();
        this.selectNode(node);

        this.relayout(); // Need to relayout twice the first time a new model is set...
        this.layout();

        const panAndScale = this.getPanAndScale();
        this.moveRoots(
          -panAndScale.x + this.currentLayout.width / 2 / panAndScale.scale - node.global.x - node.nodeSize.width / 2,
          -panAndScale.y + this.currentLayout.height / 2 / panAndScale.scale - node.global.y - node.nodeSize.height / 2
        );
      }
    }

    this.relayout(); // Need to relayout twice the first time a new model is set...
    this.layout();
    this.repaint();
  }

  getActiveComponent(): ComponentModel {
    return this.activeComponent;
  }

  selectNode(node: NodeGraphEditorNode) {
    this.selectionActions.selectNode(node);
  }

  setHighlightedNode(node: NodeGraphEditorNode, atPosition?) {
    this.inspectorActions.setHighlightedNode(node, atPosition);
  }

  setHighlightedConnection(c: NodeGraphEditorConnection, atPosition?) {
    return this.inspectorActions.setHighlightedConnection(c, atPosition);
  }

  selectConnection(c: NodeGraphEditorConnection) {
    this.selectionActions.selectConnection(c);
  }

  /**
   * The wire under a point, if any (CAN-003). Right-click asks this rather than
   * reading the hover state, so a menu opens on the wire the cursor is on even
   * if no move event landed on it first.
   */
  findConnectionAtPoint(pos: { x: number; y: number }): NodeGraphEditorConnection | undefined {
    for (const connection of this.connections) {
      if (connection.hitTest(pos)) return connection;
    }
  }

  openConnectionRightClickMenu(c: NodeGraphEditorConnection) {
    this.contextMenu.openConnectionRightClickMenu(c);
  }

  /** Port picker for a reroute drop, with the wire's other end pinned (CAN-003). */
  openReroutePanels() {
    this.connectionPopups.openForReroute();
  }

  //hide all other inspectors that aren't pinned
  hideInspectors() {
    this.inspectorActions.hideInspectors();
  }

  getInspectorForConnection(c) {
    return this.inspectorActions.getInspectorForConnection(c);
  }

  getInspectorForNode(node) {
    return this.inspectorActions.getInspectorForNode(node);
  }

  removeInspector(inspector) {
    this.inspectorActions.removeInspector(inspector);
  }

  isPointInsideNodes(pos: { x: number; y: number }, nodes: readonly NodeGraphEditorNode[]) {
    return HitTester.isPointInsideNodes(pos, nodes);
  }

  multiselectNodes(x, y, x2, y2, mode) {
    this.selectionActions.multiselectNodes(x, y, x2, y2, mode);
  }

  isHighlighted(node) {
    return this.selectionActions.isHighlighted(node);
  }

  openConnectionPanels() {
    this.connectionPopups.open();
  }

  closeConnectionPanels() {
    this.connectionPopups.close();
  }

  detachNode(node) {
    this.nodeOperations.detachNode(node);
  }

  attachNode(parent, node, index) {
    this.nodeOperations.attachNode(parent, node, index);
  }

  nudgeNode(node: NodeGraphEditorNode, x: number, y: number) {
    this.nodeOperations.nudgeNode(node, x, y);
  }

  snapNodeToGrid(node: NodeGraphEditorNode) {
    this.nodeOperations.snapNodeToGrid(node);
  }

  commitMoveNode(node) {
    this.nodeOperations.commitMoveNode(node);
  }

  removeConnection(con) {
    this.nodeOperations.removeConnection(con);
  }

  updateNodeToolbar() {
    this.contextMenu.updateNodeToolbar();
  }

  hideNodeToolbar() {
    this.contextMenu.hideNodeToolbar();
  }

  setMouseEventsEnabled(enabled) {
    this.interaction.mouseEventsEnabled = enabled;
  }

  relativeCoordsToNodeGraphCords(pos: { x: number; y: number }): { x: number; y: number } {
    return this.viewport.canvasToGraph(pos, this.getPanAndScale());
  }

  mouse(type: MouseEventType, pos: MousePosition, evt: NodeGraphMouseEvent, args?: TSFixme) {
    return this.interaction.mouse(type, pos, evt, args);
  }

  setCanvasCursor(cursor: string) {
    this.canvas.ctx.canvas.style.cursor = cursor;
  }

  openRightClickMenu() {
    this.contextMenu.openRightClickMenu();
  }

  layoutAndPaint() {
    if (!this.el) {
      return;
    }

    if (this._disposed) return;

    if (this.relayoutNeeded) this.layout();

    this.paint();

    this.relayoutNeeded = this.layoutAndPaintScheduled = false;
  }

  relayout() {
    this.relayoutNeeded = true;
  }

  layout() {
    this.painter.layout();
  }

  repaint() {
    if (!this.layoutAndPaintScheduled) {
      window.requestAnimationFrame(this.layoutAndPaint.bind(this));
      this.layoutAndPaintScheduled = true;
    }
  }

  calculateAABB() {
    this.painter.calculateAABB();
  }

  findNodeWithId(id: string): NodeGraphEditorNode {
    return HitTester.findNodeWithId(this.roots, id);
  }

  findConnectionWithModel(model: Connection): NodeGraphEditorConnection {
    return HitTester.findConnectionWithModel(this.connections, model);
  }

  findConnectionWithKey(key: string): NodeGraphEditorConnection {
    return HitTester.findConnectionWithKey(this.connections, key);
  }

  findInspectorWithModel(model) {
    return this.inspectors.find((inspector) => inspector.model === model);
  }

  paint() {
    this.painter.paint();
  }

  // This function is used during the tests to verify that the view of the node graph editor
  // matches the model
  verifyWithModel() {
    let verified = true;
    const assert = (cond) => {
      if (!cond) verified = false;
    };

    this.forEachNode((node) => {
      const model = node.model;

      assert(this.findNodeWithId(model.id) == node);

      // Make sure parent are correctly linked
      if (node.parent) assert(this.findNodeWithId(model.parent.id) === node.parent);
      else assert(!model.parent);
    });

    return verified;
  }

  public getCenterRootPanAndScale(): PanAndScale {
    return this.viewportActions.getCenterRootPanAndScale();
  }

  public getCenterPanAndScale(): PanAndScale {
    return this.viewportActions.getCenterPanAndScale();
  }

  /**
   * Center the camera in the middle of all the nodes.
   *
   * @returns The current pan and scale.
   */
  public centerToFit(mode: CenterToFitMode) {
    return this.viewportActions.centerToFit(mode);
  }

  getPanAndScale() {
    return this.viewportActions.getPanAndScale();
  }

  setPanAndScale(panAndScale: PanAndScale) {
    this.viewportActions.setPanAndScale(panAndScale);
  }

  clampPanAndScale(panAndScale: PanAndScale) {
    return this.viewportActions.clampPanAndScale(panAndScale);
  }

  calculateNodesAABB(nodes: readonly NodeGraphEditorNode[]): AABB {
    return this.viewportActions.calculateNodesAABB(nodes);
  }

  nodesetFromSelection() {
    return this.clipboardActions.nodesetFromSelection();
  }

  extractSelectionToComponent() {
    this.clipboardActions.extractSelectionToComponent();
  }
}
