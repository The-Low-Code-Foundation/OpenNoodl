import _ from 'underscore';

import { AiAssistantEvent, AiAssistantModel } from '@noodl-models/AiAssistant/AiAssistantModel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { SidebarModel } from '@noodl-models/sidebar';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';
import KeyboardHandler, { KeyboardCommand } from '@noodl-utils/keyboardhandler';
import { getComponentModelRuntimeType } from '@noodl-utils/NodeGraph';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import View from '../../../shared/view';
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
// Initialize Blockly globals early (must run before runtime nodes load)
import { initBlocklyEditorGlobals } from '../utils/BlocklyEditorGlobals';
import DebugInspector from '../utils/debuginspector';
import { ViewerConnection } from '../ViewerConnection';
import CommentLayer from './commentlayer';
// Import test utilities for console debugging (dev only)
import '../services/HighlightManager/test-highlights';
import { CreateNewNodePanel } from './createnewnodepanel';
import { TitleBar } from './documents/EditorDocument/titlebar';
import { CanvasIcons } from './nodegrapheditor/canvas/CanvasIcons';
import { CanvasRenderer } from './nodegrapheditor/canvas/CanvasRenderer';
import { CanvasViewport } from './nodegrapheditor/canvas/CanvasViewport';
import * as HitTester from './nodegrapheditor/canvas/HitTester';
import { InteractionController } from './nodegrapheditor/canvas/InteractionController';
import { NodeSelector } from './nodegrapheditor/canvas/NodeSelector';
import { AABB, CenterToFitMode, IVector2, MouseEventType, PanAndScale, Rect } from './nodegrapheditor/canvas/types';
import { OverlayHost } from './nodegrapheditor/canvas/OverlayHost';
import { ConnectionPopups } from './nodegrapheditor/ConnectionPopups';
import { EditorClipboard } from './nodegrapheditor/EditorClipboard';
import { registerEditorEventBindings } from './nodegrapheditor/EditorEventBindings';
import { InspectorActions } from './nodegrapheditor/InspectorActions';
import { ModelBindings } from './nodegrapheditor/ModelBindings';
import MouseWheelModeDetector from './nodegrapheditor/MouseWheelModeDetector';
import { NavigationHistory } from './nodegrapheditor/NavigationHistory';
import { NodeContextMenu } from './nodegrapheditor/NodeContextMenu';
import { NodeGraphEditorConnection } from './nodegrapheditor/NodeGraphEditorConnection';
import { NodeGraphEditorNode } from './nodegrapheditor/NodeGraphEditorNode';
import { NodeOperations } from './nodegrapheditor/NodeOperations';
import { OverlayViews } from './nodegrapheditor/OverlayViews';
import { SelectionActions } from './nodegrapheditor/SelectionActions';
import { ToastLayer } from './ToastLayer/ToastLayer';

initBlocklyEditorGlobals();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeGraphEditorTemplate = require('../templates/nodegrapheditor.html');

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

type NodeGraphMouseEvent = JQuery.Event & { consumed?: boolean; spaceKey?: boolean };

export class NodeGraphEditor extends View {
  el: TSFixme;
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

  commentLayer: CommentLayer;
  _disposed: boolean;
  highlighted: NodeGraphEditorNode;
  stateText: string;
  domElementContainer: HTMLDivElement;
  currentLayout: TSFixme;
  topLeftCanvasPos: number[];
  mouseWheelDetector: TSFixme;
  inspectorsModel: DebugInspector.InspectorsModel;
  clearDeleteModeTimer: NodeJS.Timeout;
  lastBlocklyTabCloseTime: number = 0; // Track when Blockly tabs close to prevent accidental deletions

  deleteModeConnection: TSFixme;
  componentName: TSFixme;
  componentFolder: string;
  highlightedConnection: TSFixme;
  createNewNodePanel: CreateNewNodePanel;

  // Interaction state lives on the controller; these accessors preserve the
  // pre-decomposition public surface (comment layer, drag helpers, tests).
  get mouseEventsEnabled() {
    return this.interaction.mouseEventsEnabled;
  }

  set mouseEventsEnabled(enabled: boolean) {
    this.interaction.mouseEventsEnabled = enabled;
  }

  get latestMousePos(): IVector2 {
    return this.interaction.latestMousePos;
  }

  set latestMousePos(pos: IVector2) {
    this.interaction.latestMousePos = pos;
  }

  get spaceKeyDown(): boolean {
    return this.interaction.spaceKeyDown;
  }

  set spaceKeyDown(pressed: boolean) {
    this.interaction.spaceKeyDown = pressed;
  }

  get draggingNodes(): NodeGraphEditorNode[] | null {
    return this.interaction.draggingNodes;
  }

  set draggingNodes(nodes: NodeGraphEditorNode[] | null) {
    this.interaction.draggingNodes = nodes;
  }

  get lastDraggingMousePos(): IVector2 {
    return this.interaction.lastDraggingMousePos;
  }

  set lastDraggingMousePos(pos: IVector2) {
    this.interaction.lastDraggingMousePos = pos;
  }

  get startDraggingMousePos(): IVector2 {
    return this.interaction.startDraggingMousePos;
  }

  set startDraggingMousePos(pos: IVector2) {
    this.interaction.startDraggingMousePos = pos;
  }

  get dragNodesUndoGroup(): UndoActionGroup {
    return this.interaction.dragNodesUndoGroup;
  }

  set dragNodesUndoGroup(group: UndoActionGroup) {
    this.interaction.dragNodesUndoGroup = group;
  }

  get draggingConnection() {
    return this.interaction.draggingConnection;
  }

  set draggingConnection(connection) {
    this.interaction.draggingConnection = connection;
  }

  get leftButtonIsDoubleClicked(): boolean {
    return this.interaction.leftButtonIsDoubleClicked;
  }

  set leftButtonIsDoubleClicked(doubleClicked: boolean) {
    this.interaction.leftButtonIsDoubleClicked = doubleClicked;
  }

  get lastMultiselected(): TSFixme {
    return this.interaction.lastMultiselected;
  }

  set lastMultiselected(nodes: TSFixme) {
    this.interaction.lastMultiselected = nodes;
  }

  get insertLocation(): TSFixme {
    return this.interaction.insertLocation;
  }

  set insertLocation(location: TSFixme) {
    this.interaction.insertLocation = location;
  }

  get multiselectMouseDown(): IVector2 {
    return this.interaction.multiselectMouseDown;
  }

  set multiselectMouseDown(pos: IVector2) {
    this.interaction.multiselectMouseDown = pos;
  }

  get multiselectMouseMove(): IVector2 {
    return this.interaction.multiselectMouseMove;
  }

  set multiselectMouseMove(pos: IVector2) {
    this.interaction.multiselectMouseMove = pos;
  }

  get lastLeftButtonPressedTime(): TSFixme {
    return this.interaction.lastLeftButtonPressedTime;
  }

  set lastLeftButtonPressedTime(time: TSFixme) {
    this.interaction.lastLeftButtonPressedTime = time;
  }

  get panMouseDown(): IVector2 {
    return this.interaction.panMouseDown;
  }

  set panMouseDown(pos: IVector2) {
    this.interaction.panMouseDown = pos;
  }

  get originMouseDown(): TSFixme {
    return this.interaction.originMouseDown;
  }

  set originMouseDown(value: TSFixme) {
    this.interaction.originMouseDown = value;
  }

  get rightClickPos(): TSFixme {
    return this.interaction.rightClickPos;
  }

  set rightClickPos(pos: TSFixme) {
    this.interaction.rightClickPos = pos;
  }
  relayoutNeeded: boolean;
  layoutAndPaintScheduled: boolean;
  activeComponent: ComponentModel;

  // Pan/zoom state lives on the viewport; these accessors preserve the
  // pre-decomposition public surface (tests and consumers read/assign both).
  get panAndScale(): PanAndScale | undefined {
    return this.viewport.panAndScale;
  }

  set panAndScale(panAndScale: PanAndScale | undefined) {
    this.viewport.panAndScale = panAndScale;
  }

  get graphAABB(): AABB {
    return this.viewport.graphAABB;
  }

  set graphAABB(aabb: AABB) {
    this.viewport.graphAABB = aabb;
  }

  public runtimeType: RuntimeType = undefined;
  keyboardCommands: KeyboardCommand[];

  /** Canvas-painted icon images; NodeGraphEditorNode reads these through the owner contract. */
  icons: CanvasIcons;

  get homeIcon() {
    return this.icons.home;
  }

  get componentIcon() {
    return this.icons.component;
  }

  get aiAssistantInnerIcon() {
    return this.icons.aiAssistantInner;
  }

  get aiAssistantOuterIcon() {
    return this.icons.aiAssistantOuter;
  }

  get warningIcon() {
    return this.icons.warning;
  }

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

    this.mouseEventsEnabled = true;

    this.graphAABB = {
      minX: Number.MAX_VALUE,
      maxX: -Number.MAX_VALUE,
      minY: Number.MAX_VALUE,
      maxY: -Number.MAX_VALUE
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
  }

  dispose() {
    AiAssistantModel.instance.off(this);
    KeyboardHandler.instance.deregisterCommands(this.keyboardCommands);

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
  }

  reset() {
    this.clearSelection({ disableHidePanels: true });
    this.highlighted && ViewerConnection.instance.sendNodeHighlighted(this.highlighted.model, false);
    this.highlighted = undefined; // This is not cleared in clearSelection

    // Delete existing nodes and connections
    while (this.roots.length > 0) {
      const root = this.roots[0];
      this.removeRoot(root);
      root.destruct();
    }

    // Remove all connections
    while (this.connections.length > 0) {
      const con = this.connections[0];
      con.disconnect(con);
    }

    // Remove all debug inspectors
    while (this.inspectors.length > 0) {
      this.removeInspector(this.inspectors[0]);
    }

    if (this.model) {
      // Unbind from current model
      this.model.off(this);
      this.model.commentsModel.off(this);
      for (const i in this.model.roots) {
        this.model.roots[i].forEach((model) => {
          this.modelBindings.unbindNodeModel(model);
        });
      }
    }
  }

  bindModel(model?: NodeGraphModel) {
    this.modelBindings.bindModel(model);
  }

  bindProjectModel() {
    this.modelBindings.bindProjectModel();
  }

  //A request animation frame timer that renders the entire node graph while there are animations to play
  //TODO: only render when an animated node is visible
  startNodeAnimations() {
    if (this.isPlayingNodeAnimations) {
      return;
    }

    this.isPlayingNodeAnimations = true;

    const animate = () => {
      this.paint();

      if (this.isPlayingNodeAnimations) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  stopNodeAnimations() {
    this.isPlayingNodeAnimations = false;
  }

  render() {
    const _this = this;

    // Expose editor instance to window for console debugging (dev only)
    // Used by test utilities: window.testHighlightManager.testBasicHighlight()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__nodeGraphEditor = this;

    this.el = this.bindView($(NodeGraphEditorTemplate), this);

    this.domElementContainer = this.el.find('#nodegraph-dom-layer').get(0);
    this.commentLayer = new CommentLayer(this);
    this.commentLayer.setReadOnly(this.readOnly);

    // Bind canvas
    this.bindCanvas();

    // Bind model
    this.bindModel(this.model);

    this.bindProjectModel();

    //bind ai assistant
    AiAssistantModel.instance.on(
      AiAssistantEvent.ProcessingUpdated,
      () => {
        AiAssistantModel.instance.getProcessingNodeIds().length
          ? this.startNodeAnimations()
          : this.stopNodeAnimations();
      },
      this
    );

    // Rerender if warnings model changed
    WarningsModel.instance.on(
      'warningsChanged',
      function () {
        _this.repaint();
      },
      this
    );

    // When the node library is changed we may need to rerender
    NodeLibrary.instance.on(
      ['moduleRegistered', 'moduleUnregistered', 'typeAdded', 'typeRemoved', 'libraryUpdated'],
      function () {
        // We must re-resolve ports as they could have changed
        _.each(_this.connections, function (c) {
          c.resolvePorts();
        });

        // Relayout and paint
        _this.relayout();
        _this.repaint();
      },
      this
    );

    // May change warning status
    EventDispatcher.instance.on(
      ['Model.portAdded', 'Model.portRemoved'],
      function () {
        _this.relayout();
        _this.repaint();
      },
      this
    );

    // The module for the graph we are editing has been unregistered
    NodeLibrary.instance.on(
      'moduleUnregistered',
      function (args) {
        if (_this.model && args.model === _this.model.owner.owner) {
          _this.switchToComponent();
        }
      },
      this
    );

    // The component we are editing has been removed
    NodeLibrary.instance.on(
      'typeRemoved',
      function (args) {
        if (_this.model && args.model === _this.model.owner) {
          _this.switchToComponent();
        }
      },
      this
    );

    //the comment layer is using react-dnd which caches the parent position the first time a comment is rendered.
    //it's crucial that the parent position is correct, so delay the rendering a tick so all the DOM elements are in the right place
    setTimeout(() => {
      this.commentLayer.renderTo(this.el.find('#comment-layer-bg').get(0), this.el.find('#comment-layer-fg').get(0));
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
    this.currentLayout = layout;

    //make sure the canvas is bound and rendering happens at the same frame, otherwise it'll flicker
    this.bindCanvas();
    this.layout();
    this.paint();

    if (this.model && this.canvas.width && this.canvas.height) {
      let panAndScale = this.getPanAndScale();
      panAndScale = this.clampPanAndScale(panAndScale);
      this.setPanAndScale(panAndScale);
    }
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
    const _this = this;

    const canvas = this.$('#nodegraphcanvas')[0];
    const ctx = (this.canvas.ctx = canvas.getContext('2d', { alpha: true }));

    // Support retina display
    this.canvas.ratio = this.getDevicePixelRatio(ctx);

    const width = $(canvas).width();
    const height = $(canvas).height();

    canvas.width = width * this.canvas.ratio;
    canvas.height = height * this.canvas.ratio;

    this.canvas.width = canvas.width;
    this.canvas.height = canvas.height;

    this.viewport.setCanvasMetrics(canvas.width, canvas.height, this.canvas.ratio);

    // Bind mouse events
    const topLeft = function (canvas: HTMLCanvasElement) {
      const { x, y } = canvas.getBoundingClientRect();
      return [x, y];
    };

    this.topLeftCanvasPos = topLeft(canvas);

    const events = {
      mousedown: 'down',
      mouseup: 'up',
      mousemove: 'move',
      mouseout: 'out',
      mouseover: 'over'
    };

    for (const i in events) {
      const type = events[i];
      $(canvas)
        .off(i)
        .on(i, (evt) => {
          // @ts-expect-error
          evt.spaceKey = _this.spaceKeyDown; // This is set by the KeyboardHandler
          this.mouse(
            type,
            {
              x: evt.pageX - this.topLeftCanvasPos[0],
              y: evt.pageY - this.topLeftCanvasPos[1],
              pageX: evt.pageX,
              pageY: evt.pageY
            },
            evt
          );
        });

      $(canvas).on('mouseover', (evt) => {
        this.topLeftCanvasPos = topLeft(canvas);
      });
    }

    this.mouseWheelDetector = new MouseWheelModeDetector();

    $(canvas)
      .off('wheel')
      .on('wheel', (e) => {
        this.handleMouseWheelEvent(e.originalEvent);
      });
  }

  setSpaceKeyDown(pressed) {
    if (this.spaceKeyDown === pressed) {
      return;
    }

    this.spaceKeyDown = pressed;
    this.canvas.ctx.canvas.style.cursor = pressed ? 'grab' : 'inherit';
  }

  handleMouseWheelEvent(event, args?) {
    this.interaction.handleMouseWheelEvent(event, args);
  }

  updateZoomLevel(x, y, deltaZ) {
    let panAndScale = this.viewport.zoomAtPoint(x, y, deltaZ, this.getPanAndScale());
    panAndScale = this.clampPanAndScale(panAndScale);
    this.setPanAndScale(panAndScale);
    this.overlayViews.updateHighlightOverlay();

    this.relayout();
    this.repaint();
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
    let panAndScale = this.getPanAndScale();
    panAndScale.x += dx;
    panAndScale.y += dy;
    panAndScale = this.clampPanAndScale(panAndScale);
    this.setPanAndScale(panAndScale);
    this.overlayViews.updateHighlightOverlay();

    /* for(var i in this.roots) {
      this.roots[i].x += dx;
      this.roots[i].y += dy;

      this.roots[i].updateModel();
    }*/
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

      if (args?.replaceHistory) {
        this.navigationHistory.reset();
        this.navigationHistory.push(component);
      } else if (args?.pushHistory) {
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
    this.panAndScale = undefined;
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
    this.mouseEventsEnabled = enabled;
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
    if (!this.model) {
      return;
    }

    this.forEachNode(function (node) {
      node.measuredSize = undefined;
    });

    _.each(this.roots, function (node) {
      node.measure();
      node.setPosition(node.x, node.y);
      node.layout();
    });

    this.calculateAABB();
  }

  repaint() {
    if (!this.layoutAndPaintScheduled) {
      window.requestAnimationFrame(this.layoutAndPaint.bind(this));
      this.layoutAndPaintScheduled = true;
    }
  }

  calculateAABB() {
    const rects: Rect[] = this.roots.map((node) => ({
      x: node.x,
      y: node.y,
      width: node.measuredSize.width,
      height: node.measuredSize.height
    }));

    for (const comment of this.model.commentsModel.comments) {
      rects.push({ x: comment.x, y: comment.y, width: comment.width, height: comment.height });
    }

    this.viewport.updateGraphAABB(rects);
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
    if (!this.canvas.width || !this.canvas.height) {
      return;
    }

    const ctx = this.canvas.ctx;
    const panAndScale = this.getPanAndScale();

    const transform = `scale(${panAndScale.scale}) translate(${panAndScale.x}px, ${panAndScale.y}px)`;
    this.domElementContainer.style.transform = transform;

    this.commentLayer && this.commentLayer.setPanAndScale(panAndScale);

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!NodeLibrary.instance.isLoaded()) {
      // Don't paint if we don't have a node library yet
      return;
    }

    // Draw a multiselect box when there is a multi-selection (single-node
    // selections draw their own highlight)
    const showMultiselectBox = this.selector.nodes.length > 0 && !this.selector.nodes[0].selected;

    this.renderer.paint(ctx, {
      panAndScale,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      ratio: this.canvas.ratio,
      roots: this.roots,
      connections: this.connections,
      draggingNodes: this.draggingNodes,
      draggingConnection: this.draggingConnection,
      insertLocation: this.insertLocation,
      multiselectAABB: showMultiselectBox ? this.calculateNodesAABB(this.selector.nodes) : undefined,
      multiselectMouseDown: this.multiselectMouseDown,
      multiselectMouseMove: this.multiselectMouseMove
    });
  }

  // This function is used during the tests to verify that the view of the node graph editor
  // matches the model
  verifyWithModel() {
    const _this = this;

    let verified = true;
    function assert(cond) {
      if (!cond) verified = false;
    }

    this.forEachNode(function (node) {
      const model = node.model;

      assert(_this.findNodeWithId(model.id) == node);

      // Make sure parent are correctly linked
      if (node.parent) assert(_this.findNodeWithId(model.parent.id) === node.parent);
      else assert(!model.parent);
    });

    return verified;
  }

  /**
   * @returns The center of all the root nodes in the graph.
   */
  public getCenterRootPanAndScale(): PanAndScale {
    return this.viewport.centerOn(
      this.roots.map((root) => ({ x: root.x, y: root.y, width: root.nodeSize.width, height: root.nodeSize.height }))
    );
  }

  /**
   * @returns The center of all the nodes in the graph.
   */
  public getCenterPanAndScale(): PanAndScale {
    return this.viewport.centerOn(
      this.roots.map((root) => ({
        x: root.x,
        y: root.y,
        width: root.measuredSize.width,
        height: root.measuredSize.height
      }))
    );
  }

  /**
   * Center the camera in the middle of all the nodes.
   *
   * @returns The current pan and scale.
   */
  public centerToFit(mode: CenterToFitMode) {
    switch (mode) {
      default:
      case CenterToFitMode.RootNodes: {
        this.setPanAndScale(this.getCenterRootPanAndScale());
        break;
      }

      case CenterToFitMode.AllNodes: {
        this.setPanAndScale(this.getCenterPanAndScale());
        break;
      }
    }

    return this.panAndScale;
  }

  getPanAndScale() {
    if (this.panAndScale) {
      return this.panAndScale;
    }

    if (!this.model || !this.canvas.width || !this.canvas.height || !this.roots.length) {
      return { scale: 1, x: 0, y: 0 };
    }

    return this.centerToFit(CenterToFitMode.RootNodes);
  }

  setPanAndScale(panAndScale: PanAndScale) {
    this.panAndScale = panAndScale;
    this.commentLayer && this.commentLayer.setPanAndScale(panAndScale);
    this.overlayViews.updateHighlightOverlay();
    this.overlayViews.updateExecutionOverlay();
  }

  clampPanAndScale(panAndScale: PanAndScale) {
    if (!this.model || this.model.roots.length === 0) return panAndScale;

    return this.viewport.clamp(panAndScale);
  }

  calculateNodesAABB(nodes: readonly NodeGraphEditorNode[]): AABB {
    return CanvasViewport.rectsAABB(
      nodes.map((n) => ({ x: n.global.x, y: n.global.y, width: n.nodeSize.width, height: n.nodeSize.height }))
    );
  }

  nodesetFromSelection() {
    return this.clipboardActions.nodesetFromSelection();
  }

  extractSelectionToComponent() {
    this.clipboardActions.extractSelectionToComponent();
  }
}
