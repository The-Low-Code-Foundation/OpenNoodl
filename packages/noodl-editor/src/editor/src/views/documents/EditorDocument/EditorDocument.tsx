import { useNodeGraphContext } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useKeyboardCommands } from '@noodl-hooks/useKeyboardCommands';
import usePrevious from '@noodl-hooks/usePrevious';
import { ipcRenderer } from 'electron';
import React, { useCallback, useEffect, useState } from 'react';

import { IDocumentProvider } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { EditorSettings } from '@noodl-utils/editorsettings';
import { KeyCode, KeyMod } from '@noodl-utils/keyboard/KeyCode';
import { KeyboardCommand } from '@noodl-utils/keyboardhandler';

import { Container, ContainerDirection } from '@noodl-core-ui/components/layout/Container';
import { FrameDivider, FrameDividerOwner } from '@noodl-core-ui/components/layout/FrameDivider';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { resizeBlocklyWorkspaces } from '../../BlocklyEditor/blocklyResize';
import { Frame } from '../../common/Frame';
import { EditorTopbar } from '../../EditorTopbar';
import { HelpCenter } from '../../HelpCenter';
import { NodeGraphEditor } from '../../nodegrapheditor';
import { panelHoldsCanvasSelection } from '../../nodegrapheditor/EditorEventBindings';
import { ScopePlanStrip } from '../../panels/AiAuthoringPanel/ScopePlanStrip';
import { showContextMenuInPopup } from '../../ShowContextMenuInPopup';
import { BENCH_MOUNT_EVENT } from '../../VisualCanvas/benchRequest';
import { useCanvasView } from './hooks/UseCanvasView';
import { useCaptureThumbnails } from './hooks/UseCaptureThumbnails';
import { useImportNodeset } from './hooks/UseImportNodeset';
import { useRoutes } from './hooks/UseRoutes';
import { useSetupNodeGraph } from './hooks/UseSetupNodeGraph';
import { TitleBar } from './titlebar';

type DocumentLayout = 'horizontal' | 'vertical' | 'detachedPreview';

function EditorDocument() {
  const titlebarViewInstance = TitleBar.instance;

  const { nodeGraph } = useNodeGraphContext();
  // this never changes, so saving it in a state
  // this way it doesnt have to check for it every render
  const [isLesson] = useState(ProjectModel.instance.isLesson());

  useKeyboardCommands(() => createKeyboardCommands(nodeGraph), [nodeGraph]);

  const routes = ['/'].concat(useRoutes(ProjectModel.instance, EventDispatcher.instance));

  const [documentLayout, setDocumentLayout] = useState<DocumentLayout>(isLesson ? 'vertical' : 'horizontal');
  const previousDocumentLayout = usePrevious(documentLayout);

  const [zoomFactor, setZoomFactor] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: null, height: null, deviceName: null });
  const [frameDividerSize, setFrameDividerSize] = useState(undefined);

  const [selectedNodeId, setSelectedNodeId] = useState(null); //The ID of the selected node, as highlighted by the viewer

  const [hasLoadedEditorSettings, setHasLoadedEditorSettings] = useState(false);

  const [navigationState, setNavigationState] = useState({
    canGoBack: false,
    canGoForward: false,
    route: '/'
  });

  const [previewMode, setPreviewMode] = useState(true);

  const viewerDetached = documentLayout === 'detachedPreview';

  const canvasView = useCanvasView(setNavigationState);

  useKeyboardCommands(() => [
    {
      handler: () => setPreviewMode((previewMode) => !previewMode),
      keybinding: KeyMod.CtrlCmd | KeyCode.KEY_T
    }
  ]);

  useImportNodeset(nodeGraph);

  //close detached viewer when EditorDocmument unmounts
  useEffect(() => {
    return () => {
      ipcRenderer.send('viewer-attach', {});
    };
  }, []);

  useEffect(() => {
    if (!viewportSize.width && !zoomFactor) {
      setZoomFactor(1);
    }
  }, [zoomFactor, viewportSize]);

  useSetupNodeGraph(nodeGraph);

  //track which nodes is currently selected. A hack that relies on the side panel to tell us.
  useEffect(() => {
    const eventGroup = {};
    SidebarModel.instance.on(
      SidebarModelEvent.nodeSelected,
      (nodeId) => {
        setSelectedNodeId(nodeId);
      },
      eventGroup
    );

    SidebarModel.instance.on(
      SidebarModelEvent.activeChanged,
      (activeId) => {
        // Same allow-list as the canvas deselect, deliberately shared: this is
        // what the detached viewer highlights, and it drifting from what is
        // selected on canvas is how the two used to disagree (FH-008).
        if (panelHoldsCanvasSelection(activeId) === false) {
          setSelectedNodeId(null);
        }
      },
      eventGroup
    );

    return () => {
      SidebarModel.instance.off(eventGroup);
    };
  }, [nodeGraph]);

  useEffect(() => {
    if (viewerDetached) {
      ipcRenderer.send('viewer-detach', {
        zoomFactor,
        route: navigationState.route,
        viewportSize,
        inspectMode: previewMode ? false : true,
        selectedNodeId
      });

      const onViewerInspectNode = (_event, nodeId) => {
        EventDispatcher.instance.emit('inspectNodes', { nodeIds: [nodeId] });
      };

      ipcRenderer.on('viewer-inspect-node', onViewerInspectNode);
      return () => {
        ipcRenderer.off('viewer-inspect-node', onViewerInspectNode);
      };
    } else {
      ipcRenderer.send('viewer-attach', {});
    }
  }, [viewerDetached, canvasView]);

  useEffect(() => {
    const inspectMode = previewMode ? false : true;
    ipcRenderer.send('viewer-set-inspect-mode', inspectMode);
    canvasView?.setInspectMode(inspectMode);

    if (previewMode) {
      canvasView?.setNodeSelected(null);
      ipcRenderer.send('viewer-select-node', null);
    }
  }, [previewMode, canvasView]);

  useEffect(() => {
    if (!previewMode) {
      canvasView?.setNodeSelected(selectedNodeId);
      ipcRenderer.send('viewer-select-node', selectedNodeId);
    }
  }, [selectedNodeId, canvasView, previewMode]);

  const onRouteChanged = useCallback(
    (route) => {
      canvasView?.setCurrentRoute(route);
      ipcRenderer.send('viewer-set-route', route);
    },
    [canvasView]
  );

  const onUrlNavigateBack = useCallback(() => {
    ipcRenderer.send('viewer-navigate-back');
    canvasView?.navigateBack();
  }, [canvasView]);

  const onUrlNavigateForward = useCallback(() => {
    ipcRenderer.send('viewer-navigate-forward');
    canvasView?.navigateForward();
  }, [canvasView]);

  const onPreviewSizeChanged = useCallback((width, height, deviceName) => {
    setViewportSize({ width, height, deviceName });
  }, []);

  useEffect(() => {
    ipcRenderer.send('viewer-set-zoom-factor', zoomFactor);
    canvasView?.setZoomFactor(zoomFactor);
  }, [zoomFactor, canvasView]);

  useEffect(() => {
    canvasView?.setViewportSize(viewportSize);
    ipcRenderer.send('viewer-set-viewport-size', viewportSize);
  }, [viewportSize, canvasView]);

  useEffect(() => {
    const eventGroup = {};

    if (documentLayout === 'detachedPreview') {
      EventDispatcher.instance.on(
        'viewer-closed',
        () => {
          setDocumentLayout(previousDocumentLayout || 'horizontal');
        },
        eventGroup
      );
    }

    EventDispatcher.instance.on(
      'viewer-open-devtools',
      () => {
        if (documentLayout === 'detachedPreview') {
          ipcRenderer.send('viewer-open-devtools');
        } else {
          canvasView?.openDevTools();
        }
      },
      eventGroup
    );

    EventDispatcher.instance.on('viewer-refresh', () => canvasView?.refresh(), eventGroup);

    /**
     * BEN-004 — the bench is a mode of the *docked* preview surface (R1), so
     * "Preview in isolation" cannot be honoured while the preview is its own
     * window: `VisualCanvas` is not rendered at all, and the request would land
     * nowhere and read as a dead menu item.
     *
     * Re-attaching is intrusive, and it is still the only way to show what was
     * asked for. `benchRequest` parks the target so the surface picks it up
     * when it mounts, which is after this state change rather than during it.
     */
    EventDispatcher.instance.on(
      BENCH_MOUNT_EVENT,
      () => {
        if (documentLayout === 'detachedPreview') {
          setDocumentLayout(previousDocumentLayout === 'vertical' ? 'vertical' : 'horizontal');
        }
      },
      eventGroup
    );

    //refresh viewer when cloud services are changed
    ProjectModel.instance.on(
      'cloudServicesChanged',
      () => {
        EventDispatcher.instance.notifyListeners('viewer-refresh');
      },
      eventGroup
    );

    //this is sent by viewers in design mode, and lessons
    EventDispatcher.instance.on(
      'inspectNodes',
      (args) => {
        if (args.nodeIds.length === 1) {
          // Select node
          const node = ProjectModel.instance.findNodeWithId(args.nodeIds[0]);

          // Did we find a node that belongs to a component
          if (node && node.owner && node.owner.owner) {
            const component = node.owner.owner;
            nodeGraph.switchToComponent(component, { node: node, pushHistory: true });
          }
        } else {
          const nodes = args.nodeIds.map((id) => ProjectModel.instance.findNodeWithId(id)).filter((node) => !!node);

          const components = [nodes[0]];
          for (let i = 1; i < nodes.length; i++) {
            if (components[components.length - 1].owner.owner !== nodes[i].owner.owner) {
              components.push(nodes[i]);
            }
          }

          if (documentLayout === 'detachedPreview') {
            ipcRenderer.send(
              'viewer-show-inspect-menu',
              components.map((node) => ({
                label: node.owner.owner.name + ' - ' + node.label,
                nodeId: node.id
              }))
            );
          } else {
            const items = components.map((node) => ({
              label: node.owner.owner.name + ' - ' + node.label,
              onClick: () => {
                const component = node.owner.owner;
                nodeGraph.switchToComponent(component, { node: node, pushHistory: true });
              }
            }));
            showContextMenuInPopup({ title: 'Nodes behind cursor', items, width: MenuDialogWidth.Large });
          }
        }
      },
      eventGroup
    );

    //used by lessons
    EventDispatcher.instance.on(
      'setPreviewRoute',
      (args) => {
        onRouteChanged(args.url);
      },
      eventGroup
    );

    EventDispatcher.instance.on(
      'selectComponent',
      (args) => {
        const component = ProjectModel.instance.getComponentWithName(args.componentName);
        if (component) {
          nodeGraph.switchToComponent(component, { pushHistory: true });
        }
      },
      eventGroup
    );

    return () => {
      EventDispatcher.instance.off(eventGroup);
      // Cleared-not-replaced singleton: see ProjectDesignTokenContext.
      ProjectModel.instance?.off(ProjectModel);
    };
  }, [documentLayout, canvasView, previewMode, nodeGraph]);

  useEffect(() => {
    const onViewerNavigationState = (event, state) => {
      setNavigationState(state);
      //make sure canvas view is updated as well so the route matches if layout is changed
      canvasView?.setCurrentRoute(state.route);
    };

    ipcRenderer.on('viewer-navigation-state', onViewerNavigationState);

    return () => {
      ipcRenderer.off('viewer-navigation-state', onViewerNavigationState);
    };
  }, [canvasView]);

  // Save settings
  useEffect(() => {
    if (!hasLoadedEditorSettings) {
      return;
    }

    EditorSettings.instance.setMerge(ProjectModel.instance.id, {
      documentLayout,
      viewportSize,
      frameDividerSize,
      previewMode
    });

    const eventGroup = {};

    nodeGraph.on(
      'activeComponentChanged',
      ({ model }) =>
        EditorSettings.instance.setMerge(ProjectModel.instance.id, { selectedComponentName: model.fullName }),
      eventGroup
    );

    return () => {
      nodeGraph.off(eventGroup);
    };
  }, [hasLoadedEditorSettings, documentLayout, viewportSize, frameDividerSize, previewMode, nodeGraph]);

  // Apply settings
  useEffect(() => {
    setHasLoadedEditorSettings(true);

    const settings = EditorSettings.instance.get(ProjectModel.instance.id);

    if (!settings) {
      return;
    }

    if (settings.documentLayout) {
      setDocumentLayout(settings.documentLayout);
    }

    if (settings.viewportSize) {
      setViewportSize(settings.viewportSize);
    }

    if (settings.frameDividerSize) {
      setFrameDividerSize(settings.frameDividerSize);
    }

    if (settings.selectedComponentName) {
      const component = ProjectModel.instance.getComponentWithName(settings.selectedComponentName);
      if (component) {
        nodeGraph.switchToComponent(component, { replaceHistory: true });
      }
    }

    setPreviewMode(settings.previewMode ? true : false);
  }, [nodeGraph]);


  useCaptureThumbnails(canvasView, viewerDetached);

  return (
    <Container direction={ContainerDirection.Vertical} isFill>
      <EditorTopbar
        instance={titlebarViewInstance}
        routes={routes}
        onRouteChanged={onRouteChanged}
        setDocumentLayout={setDocumentLayout}
        documentLayout={documentLayout}
        zoomFactor={zoomFactor}
        setZoomFactor={setZoomFactor}
        onUrlNavigateBack={onUrlNavigateBack}
        onUrlNavigateForward={onUrlNavigateForward}
        navigationState={navigationState}
        onPreviewSizeChanged={onPreviewSizeChanged}
        previewSize={viewportSize}
        onPreviewModeChanged={setPreviewMode}
        previewMode={previewMode}
        nodeGraph={nodeGraph}
        deployIsDisabled={ProjectModel.instance.isLesson()}
      />
      {/*
        AIB-005: a project created from a scoping conversation opens on an empty
        hello-world page, which reads as the plan having failed. The user's eye
        is here, not on the sidebar rail. Renders nothing for every other
        project — see `scopePlanAnnouncement`.
      */}
      <ScopePlanStrip />
      {hasLoadedEditorSettings && (
        <ViewComponent
          documentLayout={documentLayout}
          canvasViewInstance={canvasView}
          nodeGraphEditorInstance={nodeGraph}
          frameDividerSize={frameDividerSize}
          onSizeUpdated={(size) => {
            setFrameDividerSize(size);
          }}
        />
      )}

      <HelpCenter />
    </Container>
  );
}

function ViewComponent({
  canvasViewInstance,
  documentLayout,
  nodeGraphEditorInstance,
  onSizeUpdated,
  frameDividerSize
}: TSFixme) {
  const [frameBounds, setFrameBounds] = useState(undefined);

  /**
   * LGC-008: the only route by which this splitter reaches Blockly.
   *
   * The node graph pane hosts the Logic Builder's Blockly workspace, and Blockly re-measures
   * itself on a **window** resize only — never on a container resize (verified in
   * `blockly_compressed.js`; the reasoning is written out in `blocklyResize.ts`). So before
   * this, dragging this divider with a Logic Builder open left the workspace at its injected
   * size: blocks fell outside the visible SVG or a strip of dead space appeared beside them,
   * and it corrected itself only if you happened to resize the whole window afterwards.
   *
   * ⚠️ It hangs off `onDrag` — which `FrameDivider` calls synchronously from its `mousemove`,
   * after it has already written the new container widths as CSS variables — and deliberately
   * **not** off `onResize`, which is fed by a `ResizeObserver`. An occluded Electron renderer
   * fires zero `ResizeObserver` callbacks and clamps timers ~1000×, so an observer-based or
   * `requestAnimationFrame`-deferred version works whenever the window is focused and fails
   * exactly where it is needed. Stable identity: `FrameDivider` lists `onDrag` in two
   * dependency arrays.
   */
  const onDividerDrag = useCallback(() => {
    resizeBlocklyWorkspaces();
  }, []);

  const horizontal = documentLayout === 'horizontal';
  const totalSize = frameBounds ? (horizontal ? frameBounds.height : frameBounds.width) : undefined;

  if (documentLayout === 'detachedPreview') {
    return <Frame instance={nodeGraphEditorInstance} onResize={(bounds) => nodeGraphEditorInstance.resize(bounds)} />;
  } else {
    const firstInstance = horizontal ? canvasViewInstance : nodeGraphEditorInstance;
    const secondInstance = horizontal ? nodeGraphEditorInstance : canvasViewInstance;

    return (
      <FrameDivider
        splitOwner={horizontal ? FrameDividerOwner.First : FrameDividerOwner.Second}
        horizontal={!horizontal}
        first={<Frame instance={firstInstance} onResize={(bounds) => firstInstance.resize(bounds)} />}
        second={<Frame instance={secondInstance} onResize={(bounds) => secondInstance.resize(bounds)} />}
        sizeMin={100}
        sizeMax={totalSize ? totalSize - 100 : undefined}
        size={frameDividerSize}
        onDrag={onDividerDrag}
        onSizeChanged={(size) => {
          onSizeUpdated(size);
          // The drag has ended and the containers have settled; one last measurement so a
          // workspace that was mid-flight during the last mousemove lands on the final size.
          resizeBlocklyWorkspaces();
        }}
        onBoundsChanged={setFrameBounds}
      />
    );
  }
}

function createKeyboardCommands(nodeGraph: NodeGraphEditor) {
  const copy: KeyboardCommand = {
    handler: () => nodeGraph.copy(),
    keybinding: KeyMod.CtrlCmd | KeyCode.KEY_C
  };

  const paste: KeyboardCommand = {
    handler: () => nodeGraph.paste(),
    keybinding: KeyMod.CtrlCmd | KeyCode.KEY_V
  };

  const cut: KeyboardCommand = {
    handler: () => nodeGraph.cut(),
    keybinding: KeyMod.CtrlCmd | KeyCode.KEY_X
  };

  const undo: KeyboardCommand = {
    handler: () => nodeGraph.undo(),
    keybinding: KeyMod.CtrlCmd | KeyCode.KEY_Z
  };

  const redo: KeyboardCommand = {
    handler: () => nodeGraph.redo(),
    keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_Z
  };

  const navBack: KeyboardCommand = {
    handler: () => nodeGraph.navigationHistory.goBack(),
    keybinding: KeyMod.CtrlCmd | KeyCode.US_OPEN_SQUARE_BRACKET
  };

  const navForward: KeyboardCommand = {
    handler: () => nodeGraph.navigationHistory.goForward(),
    keybinding: KeyMod.CtrlCmd | KeyCode.US_CLOSE_SQUARE_BRACKET
  };

  const deleteWithBackspace: KeyboardCommand = {
    handler: () => nodeGraph.delete(),
    keybinding: KeyCode.Backspace
  };

  const deleteWithDel: KeyboardCommand = {
    handler: () => nodeGraph.delete(),
    keybinding: KeyCode.Delete
  };

  const createComment: KeyboardCommand = {
    handler: () =>
      nodeGraph.activeComponent.graph.commentsModel.addComment(
        {
          text: '',
          fill: true,
          width: 150,
          height: 100,
          x: nodeGraph.getLatestMousePos().x,
          y: nodeGraph.getLatestMousePos().y
        },
        { undo: true, label: 'add comment', focusComment: true }
      ),
    keybinding: KeyMod.CtrlCmd | KeyCode.US_SLASH
  };

  return [copy, paste, cut, undo, redo, navBack, navForward, deleteWithBackspace, deleteWithDel, createComment];
}

export class EditorDocumentProvider implements IDocumentProvider {
  public static ID = 'EditorDocumentProvider';

  getComponent() {
    // React Component of the editor view (canvas, and node graph)
    return EditorDocument;
  }
}
