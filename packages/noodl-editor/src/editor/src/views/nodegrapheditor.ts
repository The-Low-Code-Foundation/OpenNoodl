import { clipboard, ipcRenderer } from 'electron';
import _ from 'underscore';
import React from 'react';

import { AiAssistantEvent, AiAssistantModel } from '@noodl-models/AiAssistant/AiAssistantModel';
import { BasicNodeType } from '@noodl-models/nodelibrary/BasicNodeType';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { UndoQueue, UndoActionGroup } from '@noodl-models/undo-queue-model';
import { EditorSettings } from '@noodl-utils/editorsettings';
import { canExtractToComponent, extractToComponent } from '@noodl-utils/ExtractToComponent';
import { KeyCode } from '@noodl-utils/keyboard/KeyCode';
import KeyboardHandler, { KeyboardCommand } from '@noodl-utils/keyboardhandler';
import { Model } from '@noodl-utils/model';
import { getComponentModelRuntimeType } from '@noodl-utils/NodeGraph';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { PopupToolbar, PopupToolbarProps } from '@noodl-core-ui/components/popups/PopupToolbar';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import View from '../../../shared/view';
import { CanvasTabsProvider } from '../contexts/CanvasTabsContext';
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
import { guid } from '../utils/utils';
import { ViewerConnection } from '../ViewerConnection';
import { ExecutionOverlay } from './CanvasOverlays/ExecutionOverlay';
import { HighlightOverlay } from './CanvasOverlays/HighlightOverlay';
import { CanvasTabs } from './CanvasTabs';
import CommentLayer from './commentlayer';
import { EditorBanner } from './EditorBanner';
// Import test utilities for console debugging (dev only)
import '../services/HighlightManager/test-highlights';
import { ConnectionPopup } from './ConnectionPopup';
import { CreateNewNodePanel } from './createnewnodepanel';
import { TitleBar } from './documents/EditorDocument/titlebar';
import { NodeGraphComponentTrail } from './NodeGraphComponentTrail';
import Inspectors from './nodegrapheditor.debuginspectors';
import { CanvasIcons } from './nodegrapheditor/canvas/CanvasIcons';
import { CanvasRenderer } from './nodegrapheditor/canvas/CanvasRenderer';
import { CanvasViewport } from './nodegrapheditor/canvas/CanvasViewport';
import * as HitTester from './nodegrapheditor/canvas/HitTester';
import { InteractionController } from './nodegrapheditor/canvas/InteractionController';
import {
  AABB,
  CenterToFitMode,
  IVector2,
  MouseEventType,
  PanAndScale,
  Rect,
  SnapSpacing
} from './nodegrapheditor/canvas/types';
import { OverlayHandle, OverlayHost } from './nodegrapheditor/canvas/OverlayHost';
import MouseWheelModeDetector from './nodegrapheditor/MouseWheelModeDetector';
import { NavigationHistory } from './nodegrapheditor/NavigationHistory';
import { NodeGraphEditorConnection } from './nodegrapheditor/NodeGraphEditorConnection';
import { NodeGraphEditorNode } from './nodegrapheditor/NodeGraphEditorNode';
import PopupLayer from './popuplayer';
import { showContextMenuInPopup } from './ShowContextMenuInPopup';
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

class Selector {
  private _selected: NodeGraphEditorNode[] = [];

  public get active() {
    return this._selected.length > 0;
  }

  public get nodes(): readonly NodeGraphEditorNode[] {
    return this._selected;
  }

  public isActive(node: NodeGraphEditorNode) {
    return this._selected.indexOf(node) !== -1;
  }

  public select(nodes: NodeGraphEditorNode[]) {
    this._selected = nodes;
  }

  public unselect() {
    //remove selection highlight, if any
    if (this._selected.length === 1) {
      this._selected[0].selected = false;
    }

    this._selected = [];
  }

  public unselectNode(node: NodeGraphEditorNode) {
    const index = this._selected.indexOf(node);
    if (index === -1) {
      return;
    }

    //remove selection highlight, if any
    if (node.selected) {
      node.selected = false;
    }

    this._selected.splice(index, 1);
  }
}

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

  selector = new Selector();

  /** Pan/zoom state and coordinate math (PLAT-001 extraction). */
  viewport = new CanvasViewport();

  /** Per-frame canvas painting (PLAT-001 extraction). */
  renderer = new CanvasRenderer();

  /** Input state machines: drag, connection drag, multiselect, pan (PLAT-001 extraction). */
  interaction = new InteractionController(this);

  commentLayer: CommentLayer;
  _disposed: boolean;
  highlighted: NodeGraphEditorNode;
  stateText: string;
  domElementContainer: HTMLDivElement;
  currentLayout: TSFixme;
  clipboard: TSFixme;
  topLeftCanvasPos: number[];
  mouseWheelDetector: TSFixme;
  curtop = 0;
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
  showInspectorTimeout: NodeJS.Timeout;

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
  private toolbarOverlay: OverlayHandle | null = null;

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

    EventDispatcher.instance.on(
      ['DebugInspectorConnectionPulseChanged'],
      () => {
        this.repaint();
      },
      this
    );

    EventDispatcher.instance.on(
      'ProjectModel.instanceHasChanged',
      (args) => {
        args.oldInstance && args.oldInstance.off(this);
        if (ProjectModel.instance === undefined) return;

        this.bindProjectModel();
        this.navigationHistory.discardInvalidEntries();
      },
      this
    );

    // Listen for component switch requests from ComponentsPanel
    EventDispatcher.instance.on(
      'ComponentPanel.SwitchToComponent',
      (args: { component: ComponentModel; pushHistory?: boolean }) => {
        if (args.component) {
          this.switchToComponent(args.component, {
            pushHistory: args.pushHistory
          });
        }
      },
      this
    );

    // Listen for Logic Builder tab opened - hide canvas
    EventDispatcher.instance.on(
      'LogicBuilder.TabOpened',
      () => {
        console.log('[NodeGraphEditor] Logic Builder tab opened - hiding canvas');
        this.setCanvasVisibility(false);
      },
      this
    );

    // Listen for all Logic Builder tabs closed - show canvas
    EventDispatcher.instance.on(
      'LogicBuilder.AllTabsClosed',
      () => {
        console.log('[NodeGraphEditor] All Logic Builder tabs closed - showing canvas');
        // Track close time to prevent accidental node deletions during focus transition
        this.lastBlocklyTabCloseTime = Date.now();
        this.setCanvasVisibility(true);
      },
      this
    );

    // Listen for Logic Builder tab open requests (for opening tabs from property panel)
    EventDispatcher.instance.on(
      'LogicBuilder.OpenTab',
      (args: { nodeId: string; nodeName: string; workspace: string }) => {
        console.log('[NodeGraphEditor] Opening Logic Builder tab for node:', args.nodeId);
        // The CanvasTabs context will handle the actual tab opening
      },
      this
    );

    if (import.meta.webpackHot) {
      import.meta.webpackHot.accept('./createnewnodepanel');
    }

    this.keyboardCommands = [
      {
        handler: () => this.setSpaceKeyDown(true),
        keybinding: KeyCode.Space,
        type: 'down'
      },
      {
        handler: () => this.setSpaceKeyDown(false),
        keybinding: KeyCode.Space,
        type: 'up'
      },
      {
        handler: () => {
          for (const node of this.selector.nodes) {
            this.nudgeNode(node, node.x + SnapSpacing, node.y);
          }
        },
        keybinding: KeyCode.RightArrow,
        type: 'down'
      },
      {
        handler: () => {
          for (const node of this.selector.nodes) {
            this.nudgeNode(node, node.x - SnapSpacing, node.y);
          }
        },
        keybinding: KeyCode.LeftArrow,
        type: 'down'
      },
      {
        handler: () => {
          for (const node of this.selector.nodes) {
            this.nudgeNode(node, node.x, node.y - SnapSpacing);
          }
        },
        keybinding: KeyCode.UpArrow,
        type: 'down'
      },
      {
        handler: () => {
          for (const node of this.selector.nodes) {
            this.nudgeNode(node, node.x, node.y + SnapSpacing);
          }
        },
        keybinding: KeyCode.DownArrow,
        type: 'down'
      }
    ];

    KeyboardHandler.instance.registerCommands(this.keyboardCommands);

    // Load icons using webpack require to ensure proper bundling
    this.icons = new CanvasIcons(() => this.repaint());

    SidebarModel.instance.on(
      SidebarModelEvent.activeChanged,
      (activeId) => {
        const isNodePanel = activeId === 'PropertyEditor' || activeId === 'PortEditor';
        if (isNodePanel === false) {
          //deselect nodes when switching away from property editor or port editor
          this.deselect({ disableHidePanels: true });
          this.repaint();
        }
      },
      this
    );
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
    this.toolbarOverlay = null;

    SidebarModel.instance.off(this);

    this.reset();

    this._disposed = true;
  }

  setReadOnly(readOnly: boolean) {
    this.readOnly = readOnly;
    this.commentLayer?.setReadOnly(readOnly);

    // Update banner visibility when read-only status changes
    if (this.overlays.hasSlot('editor-banner')) {
      this.renderEditorBanner();
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
          this.unbindNodeModel(model);
        });
      }
    }
  }

  bindModel(model?: NodeGraphModel) {
    const _this = this;

    this.reset();

    this.model = model;
    this.stateText = this.readOnly ? 'Read Only' : null;
    this.updateTitle();
    if (!model) return;

    // Create views for the content of the model
    this.roots = [];
    for (const i in model.roots) {
      const node = NodeGraphEditorNode.createFromModel(model.roots[i], this);

      model.roots[i].forEach(function (model) {
        _this.bindNodeModel(model);
      });

      this.roots.push(node);
    }

    this.connections = [];
    for (const i in model.connections) {
      NodeGraphEditorConnection.createFromModel(model.connections[i], this);
    }

    // Listen to when a node is attached in the model and
    // change the view accordingly
    model.on(
      'nodeAdded',
      function (args) {
        const node = NodeGraphEditorNode.createFromModel(args.model, _this);
        _this.bindNodeModel(args.model);

        if (args.model.parent) {
          const parent = _this.findNodeWithId(args.model.parent.id);
          const index = args.model.parent.children.indexOf(args.model);
          parent.insertChild(node, index);
        } else {
          _this.roots.push(node);
        }

        if (!args?.disableSelect) {
          _this.clearSelection();

          //let the event loop do one tick before selecting, there might be other listeners that want to modify some paramters (like the router adapter)
          setTimeout(() => {
            if (_this.selector.active) {
              return;
            }
            _this.selectNode(node);
            _this.relayout();
            _this.repaint();
          }, 1);
        } else {
          _this.relayout();
          _this.repaint();
        }
      },
      this
    );

    model.commentsModel.on(
      'commentAdded',
      ({ comment, args }) => {
        this.clearSelection();

        if (args && args.focusComment) {
          this.commentLayer && this.commentLayer.focusComment(comment.id);
        }
      },
      this
    );

    model.on(
      'nodeRemoved',
      (args) => {
        const node = this.findNodeWithId(args.model.id);
        if (!node) return; // The node was not found

        // If the highlighted node is delete empty the reference
        if (this.highlighted === node) {
          this.highlighted && ViewerConnection.instance.sendNodeHighlighted(this.highlighted.model, false);
          this.highlighted = undefined;
        }

        //de-select in case it's active
        this.selector.unselectNode(node);

        const inspector = this.getInspectorForNode(node);
        inspector && inspector.remove();

        this.unbindNodeModel(args.model);

        if (node.parent) {
          node.parent.removeChild(node);
          node.destruct();
        } else {
          this.removeRoot(node);
          node.destruct();
        }

        this.clearSelection();
        this.relayout();
        this.repaint();

        if (!this.selector.active) {
          this.updateNodeToolbar();
        }
      },
      this
    );

    model.on(
      'nodeAttached',
      function (args) {
        const node = _this.findNodeWithId(args.model.id);
        const parent = _this.findNodeWithId(args.parent.id);
        parent.insertChild(node, args.index);
        _this.removeRoot(node);

        _this.relayout();
        _this.repaint();
      },
      this
    );

    // Listen to when a node is detached in the model
    model.on(
      'nodeDetached',
      function (args) {
        const node = _this.findNodeWithId(args.model.id);
        node && node.detach();
        _this.roots.push(node);

        _this.relayout();
        _this.repaint();
      },
      this
    );

    // Connections
    model.on(
      'connectionAdded',
      function (args) {
        NodeGraphEditorConnection.createFromModel(args.model, _this, _this.canvas.ctx);

        _this.relayout();
        _this.repaint();
      },
      this
    );

    model.on(
      'connectionRemoved',
      function (args) {
        const con = _this.findConnectionWithModel(args.model);
        con && con.disconnect();

        const inspector = _this.getInspectorForConnection(con);
        inspector && inspector.remove();

        _this.relayout();
        _this.repaint();
      },
      this
    );

    model.on(
      'connectionPortChanged',
      function (args) {
        const con = _this.findConnectionWithModel(args.model);
        con.fromProperty = args.model.fromProperty;
        con.toProperty = args.model.toProperty;

        con.resolvePorts();

        _this.relayout();
        _this.repaint();
      },
      this
    );

    this.layout();
    this.paint();

    // Bind connection inspector and models after the first paint so they know what x and y position to attach to
    this.bindDebugInspector();
  }

  bindNodeModel(model) {
    const _this = this;

    model.on(
      ['labelChanged', 'portRearranged', 'typeRenamed'],
      function () {
        _this.relayout();
        _this.repaint();
      },
      this
    );
  }

  unbindNodeModel(model) {
    model.off(this);
  }

  bindDebugInspector() {
    const _this = this;

    // Add inspector views
    function createConnectionInspector(model) {
      const connection = _this.findConnectionWithKey(model.connectionKey);
      if (connection && connection.isHealthy()) {
        // Is this a connection in this graph
        return new Inspectors.ConnectionInspector({
          model,
          connection,
          owner: _this,
          parentElement: _this.domElementContainer
        });
      }
    }

    function createNodeInspector(model) {
      const node = _this.findNodeWithId(model.nodeId);
      if (node) {
        return new Inspectors.NodeInspector({
          model,
          node,
          owner: _this,
          parentElement: _this.domElementContainer
        });
      }
    }

    function createInspector(model) {
      if (model.type === 'connection') {
        return createConnectionInspector(model);
      } else {
        return createNodeInspector(model);
      }
    }

    const inspectorsModel = DebugInspector.InspectorsModel.instanceForProject(ProjectModel.instance);
    this.inspectorsModel = inspectorsModel;
    inspectorsModel.getInspectors().forEach((model) => {
      const inspector = createInspector(model);
      if (inspector) {
        this.inspectors.push(inspector);
        inspector.render();
      }
    });

    inspectorsModel.off(this);
    inspectorsModel.on(
      'inspectorAdded',
      (args) => {
        const inspector = createInspector(args.model);
        if (inspector) {
          this.inspectors.push(inspector);
          inspector.render();
        }
      },
      this
    );

    inspectorsModel.on(
      'inspectorRemoved',
      (args) => {
        const inspector = this.findInspectorWithModel(args.model);
        this.removeInspector(inspector);
      },
      this
    );
  }

  bindProjectModel() {
    const _this = this;

    ProjectModel.instance.on(
      'componentRemoved',
      (e) => {
        _this.navigationHistory.onComponentRemoved(e.model);
      },
      this
    );

    ProjectModel.instance.on(
      'componentRenamed',
      (e) => {
        _this.updateTitle();
      },
      this
    );
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
      this.renderHighlightOverlay();
    }, 1);

    // Render the canvas tabs
    setTimeout(() => {
      this.renderCanvasTabs();
    }, 1);

    // Render the editor banner (for read-only mode)
    setTimeout(() => {
      this.renderEditorBanner();
    }, 1);

    // Render the execution overlay (CF11-007)
    setTimeout(() => {
      this.renderExecutionOverlay();
    }, 1);

    this.relayout();
    this.repaint();

    return this.el;
  }

  /**
   * Render the CanvasTabs React component
   */
  renderCanvasTabs() {
    this.overlays.renderSlot(
      'canvas-tabs',
      this.el.find('#canvas-tabs-root').get(0),
      React.createElement(
        CanvasTabsProvider,
        null,
        React.createElement(CanvasTabs, {
          onWorkspaceChange: this.handleBlocklyWorkspaceChange.bind(this)
        })
      )
    );
  }

  /**
   * Handle workspace changes from Blockly editor
   */
  handleBlocklyWorkspaceChange(nodeId: string, workspace: string, code: string) {
    console.log(`[NodeGraphEditor] Workspace changed for node ${nodeId}`);

    const node = this.findNodeWithId(nodeId);
    if (!node) {
      console.warn(`[NodeGraphEditor] Node ${nodeId} not found`);
      return;
    }

    // Save workspace JSON to node model
    node.model.setParameter('workspace', workspace);

    // Save generated JavaScript code to node model
    // This triggers the runtime's parameterUpdated listener which calls updatePorts()
    node.model.setParameter('generatedCode', code);

    console.log(`[NodeGraphEditor] Saved workspace and generated code for node ${nodeId}`);
  }

  /**
   * Render the EditorBanner React component (for read-only mode)
   */
  renderEditorBanner() {
    // Only show banner if in read-only mode
    this.overlays.renderSlot(
      'editor-banner',
      this.el.find('#editor-banner-root').get(0),
      this.readOnly
        ? React.createElement(EditorBanner, {
            onDismiss: this.handleDismissBanner.bind(this)
          })
        : null
    );
  }

  /**
   * Handle banner dismiss
   */
  handleDismissBanner() {
    console.log('[NodeGraphEditor] Banner dismissed');
    // Banner handles its own visibility via state
  }

  /**
   * Get node bounds for the highlight overlay
   * Maps node IDs to their screen coordinates
   */
  getNodeBounds = (nodeId: string) => {
    const node = this.findNodeWithId(nodeId);
    if (!node) return null;

    return {
      x: node.global.x,
      y: node.global.y,
      width: node.nodeSize.width,
      height: node.nodeSize.height
    };
  };

  /**
   * Render the HighlightOverlay React component
   */
  renderHighlightOverlay() {
    // Get current viewport state
    const panAndScale = this.getPanAndScale();
    const viewport = {
      x: panAndScale.x,
      y: panAndScale.y,
      zoom: panAndScale.scale
    };

    // Render the overlay
    this.overlays.renderSlot(
      'highlight-overlay',
      this.el.find('#highlight-overlay-layer').get(0),
      React.createElement(HighlightOverlay, {
        viewport,
        getNodeBounds: this.getNodeBounds
      })
    );
  }

  /**
   * Update the highlight overlay with new viewport state
   * Called whenever pan/zoom changes
   */
  updateHighlightOverlay() {
    if (this.overlays.hasSlot('highlight-overlay')) {
      this.renderHighlightOverlay();
    }
  }

  /**
   * Render the ExecutionOverlay React component (CF11-007)
   *
   * Mounts into #execution-overlay-layer. The React component manages its own
   * pinned-execution state via EventDispatcher ('execution:pinToCanvas').
   * We re-render on every pan/zoom so the viewport prop stays current.
   */
  renderExecutionOverlay() {
    const panAndScale = this.getPanAndScale();
    const viewport = {
      x: panAndScale.x,
      y: panAndScale.y,
      zoom: panAndScale.scale
    };

    this.overlays.renderSlot(
      'execution-overlay',
      this.el.find('#execution-overlay-layer').get(0),
      React.createElement(ExecutionOverlay, {
        viewport,
        getNodeBounds: this.getNodeBounds
      })
    );
  }

  /**
   * Update the execution overlay with new viewport state.
   * Called whenever pan/zoom changes (same cadence as updateHighlightOverlay).
   */
  updateExecutionOverlay() {
    if (this.overlays.hasSlot('execution-overlay')) {
      this.renderExecutionOverlay();
    }
  }

  /**
   * Set canvas visibility (hide when Logic Builder is open, show when closed)
   */
  setCanvasVisibility(visible: boolean) {
    const canvasElement = this.el.find('#nodegraphcanvas');
    const commentLayerBg = this.el.find('#comment-layer-bg');
    const commentLayerFg = this.el.find('#comment-layer-fg');
    const highlightOverlay = this.el.find('#highlight-overlay-layer');
    const componentTrail = this.el.find('.nodegraph-component-trail-root');

    if (visible) {
      // Show canvas and related elements
      canvasElement.css('display', 'block');
      commentLayerBg.css('display', 'block');
      commentLayerFg.css('display', 'block');
      highlightOverlay.css('display', 'block');
      componentTrail.css('display', 'flex');
      this.domElementContainer.style.display = '';
    } else {
      // Hide canvas and related elements
      canvasElement.css('display', 'none');
      commentLayerBg.css('display', 'none');
      commentLayerFg.css('display', 'none');
      highlightOverlay.css('display', 'none');
      componentTrail.css('display', 'none');
      this.domElementContainer.style.display = 'none';
    }
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

  // --------------------------------- Cut n paste ------------------------------------------
  getSelectedNodes(): NodeGraphEditorNode[] {
    return [...this.selector.nodes];
  }

  copySelected() {
    const nodes = this.selector.nodes;

    // Make sure all nodes can be copied
    const _invalid = nodes.filter((n) => !n.model.canBeCopied());
    if (_invalid.length !== 0) {
      ToastLayer.showError('One or more of these nodes cannot be copied.');
      return;
    }

    // Update coordinates so they are pasted correctly
    const nodeModels = nodes.map((n) => {
      n.x = n.global.x;
      n.y = n.global.y;
      n.updateModel();
      return n.model;
    });

    const nodeset = this.model.getNodeSetWithNodes(nodeModels);
    nodeset.comments = this.commentLayer.getSelectedComments();

    if (nodes.length > 0 || nodeset.comments.length > 0) {
      this.clipboard = nodeset.clone();
      this.clipboard.strip();
      clipboard.writeText(JSON.stringify(this.clipboard.toJSON()));
    } else {
      this.clipboard = undefined;
    }

    ToastLayer.showInteraction('Copied');

    return nodeset;
  }

  delete() {
    if (this.readOnly) {
      return false;
    }

    // Guard against accidental deletions during Blockly tab close transition
    // This prevents nodes from being deleted if a Blockly tab was just closed
    const timeSinceBlocklyClose = Date.now() - this.lastBlocklyTabCloseTime;
    if (timeSinceBlocklyClose < 200) {
      console.warn('[NodeGraphEditor] Ignoring delete during Blockly tab close transition');
      return false;
    }

    const nodes = [...this.selector.nodes];

    // Make sure all nodes can be deleted
    const _invalid = nodes.filter((n) => !n.model.canBeDeleted());
    if (_invalid.length !== 0) {
      ToastLayer.showError('One or more of these nodes cannot be deleted.');
      return;
    }

    const undo = new UndoActionGroup({ label: 'delete nodes' });

    if (this.commentLayer && this.commentLayer.hasSelection()) {
      this.commentLayer.deleteSelection({ undo: undo });
    }

    const models = _.pluck(nodes, 'model');
    this.model.removeNodeSet(this.model.getNodeSetWithNodes(models), {
      undo: undo
    });

    UndoQueue.instance.push(undo);
  }

  copy() {
    this.copySelected();
  }

  cut() {
    if (this.readOnly) {
      return false;
    }

    const nodeset = this.copySelected();
    if (nodeset === undefined) return;

    const undoCut = new UndoActionGroup({ label: 'cut' });
    this.model.removeNodeSet(nodeset, { undo: undoCut });
    UndoQueue.instance.push(undoCut);

    ToastLayer.showInteraction('Cut');
  }

  getNodeSetFromClipboard() {
    try {
      const text = clipboard.readText();
      if (!text) return;

      var json = JSON.parse(text);
    } catch (e) {
      // Failed to parse clipboard text as json
      return;
    }

    return NodeGraphNodeSet.fromJSON(json);
  }

  insertNodeSet({
    nodeset,
    x,
    y,
    toastMessage
  }: {
    nodeset: NodeGraphNodeSet;
    x: number;
    y: number;
    toastMessage: string;
  }): NodeGraphNodeSet | null {
    if (this.readOnly) {
      return null;
    }

    const ns = nodeset.clone();

    // Check create status for all node types
    const component = this.model.owner;
    const errors: string[] = [];

    const _this = this;
    function checkCreateStatus(nodes: NodeGraphNodeSet['nodes']) {
      for (const node of nodes) {
        if (node.type instanceof ComponentModel) {
          const status = component.getCreateStatus({
            type: node.type
          });

          if (!status.creatable) {
            errors.push(status.message);
          }
        } else if (node.type instanceof BasicNodeType) {
          if (node.type.runtimeTypes && !node.type.runtimeTypes.includes(_this.runtimeType)) {
            errors.push('One or more of these nodes cannot be created here.');
          }
        }

        checkCreateStatus(node.children);
      }
    }

    checkCreateStatus(ns.nodes);

    if (errors.length > 0) {
      // There were create errors
      const msg = {};
      for (let j = 0; j < errors.length; j++) {
        msg[errors[j]] = true;
      }
      let _msg = '';
      for (const i in msg) {
        _msg += i;
      }
      ToastLayer.showError(_msg);
      return;
    }

    ns.setOriginPosition({ x, y });

    const undoNodeSet = new UndoActionGroup({ label: 'paste' });
    this.model.insertNodeSet(ns, { undo: undoNodeSet });
    undoNodeSet.push({
      undo: () => {
        this.clearSelection();
        this.commentLayer.clearSelection();
      }
    });
    UndoQueue.instance.push(undoNodeSet);

    // Select all nodes
    const multiselected = [];
    for (const i in ns.nodes) {
      const model = ns.nodes[i];
      model.forEach((m) => {
        multiselected.push(this.findNodeWithId(m.id));
      });
    }

    this.selector.select(multiselected);

    //and comments
    if (ns.comments) {
      this.commentLayer.setSelectedCommentIds(ns.comments.map((c) => c.id));
    }

    this.layout();
    this.updateNodeToolbar();
    this.repaint();

    ToastLayer.showInteraction(toastMessage);

    return ns;
  }

  paste() {
    const ns = this.getNodeSetFromClipboard() || this.clipboard;
    if (!ns) return;

    this.insertNodeSet({
      nodeset: ns,
      x: this.latestMousePos.x,
      y: this.latestMousePos.y,
      toastMessage: 'Paste'
    });
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
    this.updateHighlightOverlay();

    this.relayout();
    this.repaint();
  }

  forEachNode(callback) {
    HitTester.forEachNode(this.roots, callback);
  }

  addNodeToSelection(node: NodeGraphEditorNode) {
    if (this.readOnly) {
      return;
    }

    const currentMultiselect = [...this.selector.nodes];

    this.deselect();

    const index = currentMultiselect.indexOf(node);
    if (index === -1) {
      currentMultiselect.push(node);
    } else {
      currentMultiselect.splice(index, 1);
    }

    this.selector.select(currentMultiselect);

    this.repaint();
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
    this.updateHighlightOverlay();

    /* for(var i in this.roots) {
      this.roots[i].x += dx;
      this.roots[i].y += dy;

      this.roots[i].updateModel();
    }*/
  }

  createNewNode(type: ComponentModel, pos: IVector2, options: Partial<NodeGraphNodeJSON> = {}) {
    const node = NodeGraphNode.fromJSON({
      type: type.name,
      x: pos.x,
      y: pos.y,
      id: guid(),
      ...options
    });

    if (this.highlighted) {
      this.highlighted.model.addChild(node, { undo: true, label: 'create' });
    } else {
      this.model.addRoot(node, { undo: true, label: 'create' });
    }

    this.clearSelection();
    this.relayout();
    this.repaint();
  }

  deselect(args?: { disableHidePanels: boolean }) {
    this.commentLayer?.clearMultiselection();
    this.selector.unselect();

    if (!args?.disableHidePanels) {
      SidebarModel.instance?.hidePanels();
    }

    // Broadcast a deselect event
    this.notifyListeners('deselect');
  }

  clearSelection(args?: { disableHidePanels: boolean }) {
    this.deselect(args);

    // Clear dragging connection
    if (this.draggingConnection) {
      this.closeConnectionPanels();
      this.draggingConnection.fromNode.borderHighlighted = false;
      this.draggingConnection.toNode.borderHighlighted = false;
      this.draggingConnection = undefined;
    }

    // Clear any connections that are being deleted
    this.setHighlightedConnection(undefined);
    this.deleteModeConnection = undefined;

    // Close open popup
    PopupLayer.instance.hideAllModalsAndPopups();
    PopupLayer.instance.hideTooltip();
  }

  updateTitle() {
    const rootElem = this.el[0].querySelector('.nodegraph-component-trail-root') as HTMLElement;

    if (this.activeComponent) {
      const fullName = this.activeComponent.fullName;
      const nameParts = fullName.split('/');
      const firstItem = nameParts.shift();
      const componentTrail = [];

      for (let i = 0; i < nameParts.length; i++) {
        let part = '';

        for (let j = 0; j <= i; j++) {
          part += '/' + nameParts[j];
        }

        componentTrail.push({
          name: nameParts[i],
          fullName: part,
          stateText: this.stateText,
          // TODO: this returns undefined if the component is a folder,
          // but if a folder and a component has the same name the result
          // of this check will be wrong. i think this is a rare edge case though
          component: ProjectModel.instance.getComponentWithName(part),
          isCurrent: i === nameParts.length - 1,
          isFolderComponent: nameParts.length > 1 && !fullName.endsWith(part)
        });
      }

      const componentName = nameParts.pop();
      this.componentName = componentName;

      if (nameParts.length) {
        this.componentFolder = nameParts.join(' / ') + ' /';
      } else {
        this.componentFolder = '';
      }

      const props = {
        componentTrail,
        onSwitchToComponent: this.switchToComponent.bind(this),
        onHistoryForward: this.navigationHistory.goForward.bind(this.navigationHistory),
        onHistoryBack: this.navigationHistory.goBack.bind(this.navigationHistory),
        canNavigateBack: this.navigationHistory.canNavigateBack,
        canNavigateForward: this.navigationHistory.canNavigateForward
      };

      this.overlays.renderSlot('title', rootElem, React.createElement(NodeGraphComponentTrail, props));
    } else {
      this.overlays.renderSlot('title', rootElem, null);
    }
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
    if (this.readOnly) {
      this.notifyListeners('readOnlyNodeClicked', node.model);
      return;
    }

    // Always select the node in the selector if not already selected
    if (!node.selected) {
      this.clearSelection();
      this.commentLayer?.clearSelection();
      node.selected = true;
      this.selector.select([node]);
      this.repaint();
    }

    // Always switch to the node in the sidebar (fixes property panel stuck issue)
    SidebarModel.instance.switchToNode(node.model);

    // Handle double-click navigation
    if (this.leftButtonIsDoubleClicked) {
      if (node.model.type instanceof ComponentModel) {
        this.switchToComponent(node.model.type, { pushHistory: true });
      } else {
        const componentPorts = node.model
          .getPorts()
          .filter((p) => p.plug === 'input' && NodeLibrary.nameForPortType(p.type) === 'component');

        //check if there's a type with the component name, if so switch to it
        const component = componentPorts.map((port) => node.model.parameters[port.name]).filter((c) => c !== undefined);
        const type = component.length && NodeLibrary.instance.getNodeTypeWithName(component[0]);

        if (type) {
          // @ts-expect-error TODO: this is wrong!
          this.switchToComponent(type, { pushHistory: true });
        } else {
          //there was no type that matched, so forward the double click event to the sidebar
          SidebarModel.instance.invokeActive('doubleClick', node);
        }
      }
    }
  }

  setHighlightedNode(node: NodeGraphEditorNode, atPosition?) {
    // Node inspector
    if (this.model && !this.readOnly) {
      // Don't show node inspection in read only mode
      clearTimeout(this.showInspectorTimeout);
      if (node) {
        // We have a new node selected, show inspector
        if (!this.getInspectorForNode(node)) {
          this.showInspectorTimeout = setTimeout(() => {
            this.hideInspectors();

            //and add new inspector
            DebugInspector.InspectorsModel.instanceForProject(ProjectModel.instance).addInspectorForNode({
              node: node.model,
              position: atPosition
            });
          }, 200);
        }
      }
    }

    this.highlighted = node;
  }

  setHighlightedConnection(c: NodeGraphEditorConnection, atPosition?) {
    // Don't show connection inspection in read only mode
    if (this.readOnly) {
      return false;
    }

    // Connection inspector
    clearTimeout(this.showInspectorTimeout);
    if (c) {
      // We have a new connection selected, show inspector
      if (c.isHealthy() && !this.getInspectorForConnection(c)) {
        this.showInspectorTimeout = setTimeout(() => {
          this.hideInspectors();

          DebugInspector.InspectorsModel.instanceForProject(ProjectModel.instance).addInspectorForConnection({
            connection: c.model,
            position: c.findClosestPointOnCurve(atPosition)
          });
        }, 200);
      }
    }

    this.highlightedConnection = c;
  }

  //hide all other inspectors that aren't pinned
  hideInspectors() {
    const inspectorsToRemove = this.inspectors.filter((inspector) => !inspector.isPinned());
    for (const inspector of inspectorsToRemove) {
      inspector.remove();
    }
  }

  getInspectorForConnection(c) {
    return this.inspectors.find((p) => p.connection === c);
  }

  getInspectorForNode(node) {
    return this.inspectors.find((p) => p.node === node);
  }

  removeInspector(inspector) {
    const idx = this.inspectors.indexOf(inspector);
    if (idx !== -1) {
      inspector.dispose();
      this.inspectors.splice(idx, 1);
    }
  }

  isPointInsideNodes(pos: { x: number; y: number }, nodes: readonly NodeGraphEditorNode[]) {
    return HitTester.isPointInsideNodes(pos, nodes);
  }

  multiselectNodes(x, y, x2, y2, mode) {
    const selectRect = { x: Math.min(x, x2), y: Math.min(y, y2), width: Math.abs(x2 - x), height: Math.abs(y2 - y) };

    //select all comments
    this.commentLayer.performMultiSelect(selectRect, mode);

    // Select all nodes with a vertex inside of the multiselect area
    const selected = HitTester.nodesInRect(this.roots, selectRect);
    this.selector.select(HitTester.resolveMultiselect(mode, this.lastMultiselected, selected));
  }

  isHighlighted(node) {
    return this.highlighted === node || this.selector.isActive(node);
  }

  openConnectionPanels() {
    // Hide viewer
    ipcRenderer.send('viewer-hide');

    // If a single or multiselect node is selected, deselect them
    this.deselect();

    const _this = this;
    setTimeout(() => {
      const topLeft = function (obj) {
        let curleft = (_this.curtop = 0);
        if (obj.offsetParent) {
          do {
            curleft += obj.offsetLeft;
            _this.curtop += obj.offsetTop;
          } while ((obj = obj.offsetParent));
        }
        return [curleft, _this.curtop];
      };

      const canvas = this.$('#nodegraphcanvas')[0];
      const tl = topLeft(canvas);

      const panAndScale = this.getPanAndScale();

      const fromNode = this.draggingConnection.fromNode;
      const toNode = this.draggingConnection.toNode;

      const fromNodeXPos = fromNode.global.x - 10;

      fromNode.borderHighlighted = true;
      toNode.borderHighlighted = false;

      let activePanel = 'from';

      function isPanelActive(id: string) {
        return activePanel === id;
      }

      // Show source node port picker
      const fromProps = {
        model: fromNode.model,
        type: 'from',
        disabled: false,
        isPanelActive,
        onPortSelected: (fromPort) => {
          activePanel = 'to';
          // @ts-expect-error
          toProps.sourcePort = fromPort;
          toProps.disabled = false;
          toOverlay.update(React.createElement(ConnectionPopup, toProps));

          fromProps.disabled = true;
          fromOverlay.update(React.createElement(ConnectionPopup, fromProps));

          fromNode.borderHighlighted = false;
          toNode.borderHighlighted = true;
          this.repaint();
        }
      };
      const fromDiv = document.createElement('div');
      const fromOverlay = this.overlays.mount(fromDiv, React.createElement(ConnectionPopup, fromProps));

      const fromPosition = toNode.global.x > fromNodeXPos ? 'left' : 'right';

      ipcRenderer.send('viewer-hide');

      const fromPopout = PopupLayer.instance.showPopout({
        content: { el: $(fromDiv) },
        position: fromPosition,
        arrowColor: '#464648',
        attachToPoint: {
          x:
            (fromNode.global.x + panAndScale.x) * panAndScale.scale +
            tl[0] +
            fromNode.nodeSize.width * (fromPosition === 'left' ? 0 : 1.0) * panAndScale.scale,
          y: (fromNode.global.y + panAndScale.y) * panAndScale.scale + tl[1] + 20 * panAndScale.scale
        },
        onClose: () => {
          fromOverlay.unmount();
          ipcRenderer.send('viewer-show');
        }
      });

      // Show target node port picker
      const toProps = {
        model: toNode.model,
        fromNode: fromNode.model,
        type: 'to',
        disabled: true,
        isPanelActive,
        onPortSelected: (toPort) => {
          activePanel = 'from';
          // Make the connection
          // Create the connection, this must be undoable
          // @ts-expect-error
          if (toProps.sourcePort !== undefined) {
            const c = {
              fromId: fromNode.model.id,
              // @ts-expect-error
              fromProperty: toProps.sourcePort,
              toId: toNode.model.id,
              toProperty: toPort
            };

            this.model.addConnection(c, {
              undo: true,
              label: 'connect'
            });

            // @ts-expect-error
            toProps.sourcePort = undefined;
            toProps.disabled = true;
            toOverlay.update(React.createElement(ConnectionPopup, toProps));

            fromProps.disabled = false;
            fromOverlay.update(React.createElement(ConnectionPopup, fromProps));

            fromNode.borderHighlighted = true;
            toNode.borderHighlighted = false;
            this.repaint();
          }
        }
      };
      const toDiv = document.createElement('div');
      const toOverlay = this.overlays.mount(toDiv, React.createElement(ConnectionPopup, toProps));

      const toPosition = fromNodeXPos >= toNode.global.x ? 'left' : 'right';
      const toPopout = PopupLayer.instance.showPopout({
        content: { el: $(toDiv) },
        position: toPosition,
        arrowColor: '#464648',
        attachToPoint: {
          x:
            (toNode.global.x + panAndScale.x) * panAndScale.scale +
            tl[0] +
            toNode.nodeSize.width * (toPosition === 'left' ? 0 : 1.0) * panAndScale.scale,
          y: (toNode.global.y + panAndScale.y) * panAndScale.scale + tl[1] + 20 * panAndScale.scale
        },
        onClose: () => {
          toOverlay.unmount();
          this.clearSelection();
          this.repaint();
        }
      });
    }, 0);
  }

  closeConnectionPanels() {
    ipcRenderer.send('viewer-show');
  }

  detachNode(node) {
    this.model.detachNode(node, { undo: this.dragNodesUndoGroup });
  }

  attachNode(parent, node, index) {
    this.model.attachNode(parent, node, index, {
      undo: this.dragNodesUndoGroup
    });
  }

  nudgeNode(node: NodeGraphEditorNode, x: number, y: number) {
    const enabled = EditorSettings.instance.get('nodeGraphEditor.snapToGrid');
    if (!enabled) return;

    //nodes with parent's don't use their x and y coords, so just bail out
    if (node.parent || (node.x === x && node.y === y)) return;

    const startX = node.x;
    const startY = node.y;

    const startTime = performance.now();
    const anim = () => {
      const linearT = Math.min(1, (performance.now() - startTime) / 200);
      const easeOutT = 1 - Math.pow(1 - linearT, 4);

      node.x = startX * (1 - easeOutT) + x * easeOutT;
      node.y = startY * (1 - easeOutT) + y * easeOutT;

      this.relayout();
      this.repaint();

      if (easeOutT < 1) requestAnimationFrame(anim);
    };

    requestAnimationFrame(anim);
  }

  snapNodeToGrid(node: NodeGraphEditorNode) {
    const enabled = EditorSettings.instance.get('nodeGraphEditor.snapToGrid');
    if (!enabled) return;

    this.nudgeNode(
      node,
      Math.round(node.x / SnapSpacing) * SnapSpacing,
      Math.round(node.y / SnapSpacing) * SnapSpacing
    );
  }

  commitMoveNode(node) {
    const from = { x: node.model.x, y: node.model.y };
    const to = { x: node.x, y: node.y };

    const move = (to) => {
      node.model.set(to);

      node.x = to.x;
      node.y = to.y;

      this.snapNodeToGrid(node);

      this.relayout();
      this.repaint();
    };

    // Make sure we can undo move nodes
    if (from.x !== to.x || from.y !== to.y) {
      move(to);
      this.dragNodesUndoGroup.push({
        do: function () {
          move(to);
        },
        undo: function () {
          move(from);
        }
      });
    }
  }

  removeConnection(con) {
    this.model.removeConnection(con, { undo: true, label: 'disconnect' });
  }

  updateNodeToolbar() {
    this.hideNodeToolbar(); //hide existing toolbar, if any

    const selection = this.selector.nodes;

    if (selection.length > 0 && !selection[0].selected) {
      const aabb = this.calculateNodesAABB(selection);
      this.showNodeToolbar(selection, aabb);
    }
  }

  showNodeToolbar(selectedNodes: readonly NodeGraphEditorNode[], aabb: AABB) {
    const menuItems: PopupToolbarProps['menuItems'] = [];

    const canExtract = canExtractToComponent(this.model, selectedNodes);
    if (canExtract.allow) {
      menuItems.push({
        tooltip: 'Extract to component',
        icon: IconName.Component,
        onClick: () => {
          this.hideNodeToolbar();
          this.extractSelectionToComponent();
        }
      });
    }

    if (
      selectedNodes.length === 1 &&
      CreateNewNodePanel.shouldShow({
        component: this.model.owner,
        parentModel: selectedNodes[0].model
      })
    ) {
      menuItems.push({
        tooltip: 'Add new child',
        onClick: () => {
          this.hideNodeToolbar();

          this.createNewNodePanel = new CreateNewNodePanel({
            model: this.model,
            parentModel: this.highlighted ? this.highlighted.model : undefined,
            pos: { x: 0, y: 0 },
            runtimeType: this.runtimeType
          });
          this.createNewNodePanel.render();

          setTimeout(() => {
            PopupLayer.instance.showPopup({
              content: this.createNewNodePanel,
              position: 'screen-center',
              isBackgroundDimmed: true,
              onClose: () => this.createNewNodePanel.dispose()
            });
          }, 1);
        },
        icon: IconName.Plus
      });
    }

    const div = document.createElement('div');
    div.className = 'nodegraph-node-toolbar';
    this.domElementContainer.appendChild(div);

    const pos = {
      x: (aabb.minX + aabb.maxX) / 2,
      y: aabb.minY
    };

    div.style.width = 'max-content';
    div.style.transform = 'translate(-50%, calc(-100% - 10px))';
    div.style.position = 'absolute';
    div.style.left = pos.x + 'px';
    div.style.top = pos.y + 'px';
    this.toolbarOverlay = this.overlays.mount(
      div,
      React.createElement(PopupToolbar, {
        menuItems,
        contextMenuItems: this.getContextMenuActions()
      } as PopupToolbarProps)
    );
  }

  hideNodeToolbar() {
    this.toolbarOverlay?.unmount();
    this.toolbarOverlay = null;
    const toolbars = this.domElementContainer.querySelectorAll('.nodegraph-node-toolbar');
    for (const toolbar of toolbars) {
      this.domElementContainer.removeChild(toolbar);
    }
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

  getContextMenuActions() {
    const items = [];

    const selectedNodes = this.selector.nodes;

    const canExtract = canExtractToComponent(this.model, selectedNodes);
    items.push({
      label: 'Extract to component',
      icon: IconName.Component,
      onClick: () => this.extractSelectionToComponent(),
      isDisabled: !canExtract.allow,
      tooltip: canExtract.reason,
      tooltipShowAfterMs: 300
    });

    items.push('divider');

    // Data Lineage - DISABLED: Not production ready, requires more work
    // TODO: Re-enable when lineage filtering and event handling are fixed
    // items.push({
    //   label: 'Show Data Lineage',
    //   icon: IconName.Link,
    //   onClick: () => {
    //     const selectedNode = this.selector.nodes[0];
    //     if (selectedNode) {
    //       EventDispatcher.instance.emit('DataLineage.ShowForNode', {
    //         nodeId: selectedNode.model.id,
    //         componentName: this.activeComponent?.fullName
    //       });
    //       SidebarModel.instance.switch('data-lineage');
    //     }
    //   },
    //   isDisabled: selectedNodes.length !== 1,
    //   tooltip: selectedNodes.length !== 1 ? 'Select a single node to trace its data lineage' : undefined,
    //   tooltipShowAfterMs: 300
    // });
    // items.push('divider');

    if (
      selectedNodes.length === 1 &&
      CreateNewNodePanel.shouldShow({
        component: this.model.owner,
        parentModel: selectedNodes[0].model
      })
    ) {
      items.push({
        label: 'Add new child',
        onClick: () => {
          const selectedNode = this.selector.nodes[0];
          this.createNewNodePanel = new CreateNewNodePanel({
            model: this.model,
            parentModel: selectedNode?.model,
            pos: { x: 0, y: 0 },
            runtimeType: this.runtimeType
          });
          this.createNewNodePanel.render();

          PopupLayer.instance.showPopup({
            content: this.createNewNodePanel,
            position: 'screen-center',
            isBackgroundDimmed: true,
            onClose: () => this.createNewNodePanel.dispose()
          });
        },
        icon: IconName.Plus
      });
    }

    items.push({
      label: 'Delete',
      onClick: () => this.delete(),
      icon: IconName.Trash
    });

    return items;
  }

  openRightClickMenu() {
    showContextMenuInPopup({
      items: this.getContextMenuActions(),
      width: MenuDialogWidth.Default,
      renderDirection: DialogRenderDirection.Horizontal
    });
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
    this.updateHighlightOverlay();
    this.updateExecutionOverlay();
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
    const nodes = this.selector.nodes;

    // Make sure all nodes can be copied
    const _invalid = nodes.filter((n) => !n.model.canBeCopied());
    if (_invalid.length !== 0) {
      PopupLayer.instance.showToast('One of more of these nodes cannot be copied');
      return;
    }

    // Update coordinates so they are pasted correctly
    const nodeModels = nodes.map((n) => {
      n.x = n.global.x;
      n.y = n.global.y;
      n.updateModel();
      return n.model;
    });

    const nodeset = this.model.getNodeSetWithNodes(nodeModels);
    nodeset.comments = this.commentLayer.getSelectedComments();

    return nodeset;
  }

  extractSelectionToComponent() {
    const nodeset = this.nodesetFromSelection();
    const selection = this.selector.nodes;

    const aabb = this.calculateNodesAABB(selection);

    const pos = {
      x: (aabb.minX + aabb.maxX) / 2 - NodeGraphEditorNode.size.width / 2,
      y: aabb.minY
    };

    extractToComponent(ProjectModel.instance, this.model, nodeset, selection, pos);

    this.clearSelection();
    this.relayout();
    this.repaint();
  }
}
