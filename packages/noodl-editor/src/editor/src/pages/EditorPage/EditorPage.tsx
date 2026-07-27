import { NodeGraphContextProvider } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { ProjectDesignTokenContextProvider } from '@noodl-contexts/ProjectDesignTokenContext';
import { useKeyboardCommands } from '@noodl-hooks/useKeyboardCommands';
import { useModel } from '@noodl-hooks/useModel';
import { ipcRenderer } from 'electron';
import React, { useEffect, useRef, useState } from 'react';
import { platform } from '@noodl/platform';

import { App } from '@noodl-models/app';
import { AppRegistry } from '@noodl-models/app_registry';
import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';
import { ProjectModel } from '@noodl-models/projectmodel';
import { projectFromDirectory, unzipIntoDirectory } from '@noodl-models/projectmodel.editor';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { UndoQueue } from '@noodl-models/undo-queue-model';
import { exportProjectComponents } from '@noodl-utils/exportProjectComponents';
import FileSystem from '@noodl-utils/filesystem';
import { KeyCode, KeyMod } from '@noodl-utils/keyboard/KeyCode';
import { LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';
import { migrateExternalBrokersStorage } from '@noodl-utils/migrateExternalBrokersStorage';
import ProjectValidator from '@noodl-utils/projectvalidator';
import SchemaHandler from '@noodl-utils/schemahandler';
import { guid } from '@noodl-utils/utils';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { ErrorBoundary } from '@noodl-core-ui/components/common/ErrorBoundary';
import { FrameDivider } from '@noodl-core-ui/components/layout/FrameDivider';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { installSidePanel, installDocuments } from '../../router.setup';
import { ViewerConnection } from '../../ViewerConnection';
import { Frame } from '../../views/common/Frame';
import { ImportFlowCancelled, openImportFlow } from '../../views/ImportFlow';
import { LessonLayer } from '../../views/lessonlayer2';
import PopupLayer from '../../views/popuplayer';
import { SidePanel } from '../../views/SidePanel';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';
import { BaseWindow } from '../../views/windows/BaseWindow';
import { whatsnewRender } from '../../whats-new';
import { IRouteProps } from '../AppRoute';
import { useSetupSettings } from './useSetupSettings';
import { SidePanelLayoutProvider, useSidePanelLayout } from './useSidePanelLayout';


if (import.meta.webpackHot) {
  import.meta.webpackHot.accept('../../router.setup', () => {
    const activeId = SidebarModel.instance.getCurrent()?.id;

    SidebarModel.instance.reset();

    setupSidePanels();

    SidebarModel.instance.notifyListeners(SidebarModelEvent.HotReload);

    if (activeId) {
      SidebarModel.instance.switch(activeId);
    }
  });
}

function setupSidePanels() {
  const isLesson = ProjectModel.instance.isLesson();

  installSidePanel({ isLesson });
}

export type EditorPageProps = IRouteProps;

export function EditorPage({ route }: EditorPageProps) {
  const [isLoading, setIsLoading] = useState(true);

  const appRegistry = useModel(AppRegistry.instance, ['documentChanged']);

  const Document = appRegistry.getActiveDocument();

  const [lesson, setLesson] = useState(null);

  // PNL-003: the side panel's width. This replaces an effect that reset the
  // width to 380px on every `activeChanged` *and* every `window.resize`, and
  // never persisted it — the reset loop behind "I'm constantly expanding and
  // shrinking the side panel". Width is now per panel, per project, and stays.
  const sidePanelLayout = useSidePanelLayout();

  // `useKeyboardCommands` registers once on mount, so the handlers below read
  // the layout through a ref rather than closing over the first render's copy.
  const sidePanelLayoutRef = useRef(sidePanelLayout);
  sidePanelLayoutRef.current = sidePanelLayout;

  useEffect(() => {
    // Display latest whats-new-post if the user hasn't seen one after it was last published
    whatsnewRender();

    // UIX-013: the node picker's news carousel is gone — its right pane
    // previews the node you are about to place instead of a product promo — so
    // there is no longer a slide index to reset here.

    SchemaHandler.instance = new SchemaHandler();

    // WF-007: one-time cleanup of the retired Cloud Services panel's local
    // storage (scrubs stored master keys). Safe to call every editor mount —
    // it's a no-op after the first run.
    migrateExternalBrokersStorage();

    setupSidePanels();
    installDocuments();

    const eventGroup = {};

    //broadcast new project name over udp to noodl-shells on the same network
    ipcRenderer.send('project-opened', ProjectModel.instance.name);

    // Listen to exit editor
    App.instance.off(this).on(
      'exitEditor',
      () => {
        route.router.route({ to: 'projects' });

        //close viewer window and broadcast that no project is open
        ipcRenderer.send('project-closed');
      },
      this
    );

    // Listen to project changed on disk, reload editor
    EventDispatcher.instance.on('projectChangedOnDisk', () => reloadProjectFromDisk(), eventGroup);
    EventDispatcher.instance.on('importFromUrl', (url) => importFromUrl(url), eventGroup);

    EventDispatcher.instance.on(
      'ProjectModel.saveFailedRetryScheduled',
      () => {
        ToastLayer.showError('Failed to save project, retrying...', 3000);
      },
      eventGroup
    );

    setIsLoading(false);

    return function () {
      EventDispatcher.instance.off(eventGroup);

      if (SchemaHandler.instance) {
        SchemaHandler.instance.dispose();
        SchemaHandler.instance = null;
      }

      SidebarModel.instance.reset();

      UndoQueue.instance.clear();
    };
  }, []);

  useKeyboardCommands(() => [
    {
      handler: () => SidebarModel.instance.switch('search'),
      keybinding: KeyMod.CtrlCmd | KeyCode.KEY_F
    },
    {
      handler: () => EventDispatcher.instance.emit('viewer-open-devtools'),
      keybinding: KeyMod.CtrlCmd | KeyCode.KEY_D
    },
    {
      handler: () => EventDispatcher.instance.emit('viewer-refresh'),
      keybinding: KeyMod.CtrlCmd | KeyCode.KEY_R
    },
    {
      // Refresh viewer and node library
      handler: () => {
        NodeLibraryImporter.instance.clear();
        EventDispatcher.instance.emit('viewer-refresh');

        ToastLayer.showInteraction('Refresh Node Library and viewers');
      },
      keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_X
    },
    {
      handler: () => exportProjectComponents(),
      keybinding: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_E
    },
    {
      // PNL-003: widen the panel and back. `KeyboardHandler` already declines to
      // run commands while a focusable element has focus, so this does not fire
      // while you are typing in a panel field.
      handler: () => sidePanelLayoutRef.current.toggleWide(),
      keybinding: KeyMod.CtrlCmd | KeyCode.US_BACKSLASH,
      // Must still fire right after you clicked the rail icon or the header
      // button, which in Chromium leaves that button focused.
      worksWhenFocused: true
    },
    {
      handler: () => sidePanelLayoutRef.current.toggleHidden(),
      keybinding: KeyMod.CtrlCmd | KeyCode.KEY_B,
      worksWhenFocused: true
    }
  ]);

  useSetupSettings();

  // Attach lesson
  useEffect(() => {
    if (!ProjectModel.instance.isLesson()) return;

    const lessonLayer = new LessonLayer();

    const projectModel = ProjectModel.instance;
    const element = lessonLayer.startLesson(projectModel.getLessonModel());
    setLesson({ el: element });

    return () => {
      lessonLayer.dispose();
    };
  }, []);

  return (
    <NodeGraphContextProvider>
      <ProjectDesignTokenContextProvider>
        <BaseWindow>
          {isLoading ? (
            <ActivityIndicator />
          ) : (
            <SidePanelLayoutProvider value={sidePanelLayout}>
              <FrameDivider
                first={<SidePanel />}
                second={<ErrorBoundary>{Boolean(Document) && <Document />}</ErrorBoundary>}
                sizeMin={sidePanelLayout.dividerSizeMin}
                size={sidePanelLayout.dividerSize}
                horizontal
                onDragStart={sidePanelLayout.onDividerDragStart}
                onDragEnd={sidePanelLayout.onDividerDragEnd}
                onSizeChanged={sidePanelLayout.onDividerSizeChanged}
                onDividerDoubleClick={sidePanelLayout.toggleWide}
              />

              {Boolean(lesson) && <Frame instance={lesson} isContentSize isFitWidth />}
            </SidePanelLayoutProvider>
          )}
        </BaseWindow>
      </ProjectDesignTokenContextProvider>
    </NodeGraphContextProvider>
  );
}

function importFromUrl(url) {
  const activityId = 'import-from-url';

  PopupLayer.instance.hidePopup();

  ToastLayer.showActivity('Importing from url', activityId);

  const tmp = platform.getUserDataPath() + '/tmp/' + guid();
  FileSystem.instance.makeDirectory(tmp, function (r) {
    if (r.result !== 'success') {
      ToastLayer.hideActivity(activityId);
      ToastLayer.showError('Import failed');
      return;
    }

    unzipIntoDirectory(
      url,
      tmp,
      function (r) {
        ToastLayer.hideActivity(activityId);

        if (r.result !== 'success') {
          ToastLayer.showError("Couldn't load project from URL");
          return;
        }

        const validator = new ProjectValidator();
        validator.validateProjectDirectory(tmp);
        if (validator.hasErrors()) {
          ToastLayer.showError('This is not a valid Noodl project');
          return;
        }

        _importProject(tmp);
      },
      { skipLoad: true, noAuth: true }
    );
  });
}

/**
 * Import a project unpacked from a URL. LIB-005: the flow owns selection,
 * collision resolution and the result summary — including, at last, actually
 * honouring what the user unticked (the legacy URL path built a collision
 * dialog and then threw its answer away).
 */
function _importProject(dirEntry: string) {
  openImportFlow({
    title: 'Import project',
    subtitle: 'From the downloaded archive',
    sourceDir: dirEntry,
    // Historic behaviour: components and files start ticked, everything else
    // arrives through the dependency closure.
    initialSelection: ['component', 'resource']
  }).then(
    (result) => {
      if (result.result !== 'success') ToastLayer.showError(result.message ?? 'Import failed');
    },
    (err: unknown) => {
      if (err instanceof ImportFlowCancelled) return;
      ToastLayer.showError(err instanceof Error ? err.message : 'Import failed');
    }
  );
}

function reloadProjectFromDisk() {
  const hasActiveProject = ProjectModel.instance && ProjectModel.instance._retainedProjectDirectory;
  if (!hasActiveProject) {
    return;
  }
  ViewerConnection.instance.setWatchModelChangesEnabled(false);
  ProjectModel.setSaveOnModelChange(false);

  ProjectModel.instance.dispose(); // Unload current project

  projectFromDirectory(ProjectModel.instance._retainedProjectDirectory, (reloaded) => {
    ViewerConnection.instance.setWatchModelChangesEnabled(true);

    if (reloaded) {
      reloaded.id = ProjectModel.instance.id;
      ProjectModel.instance = reloaded;

      // Make sure the correct projects model tracks changes
      LocalProjectsModel.instance.bindProject(reloaded);

      ProjectModel.setSaveOnModelChange(true);
    }
  });
}
