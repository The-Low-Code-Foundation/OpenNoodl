import { AppRegistry } from '@noodl-models/app_registry';
import { SidebarModel } from '@noodl-models/sidebar';
import { Keybinding } from '@noodl-utils/keyboard/Keybinding';
import { KeyCode, KeyMod } from '@noodl-utils/keyboard/KeyCode';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import config from '../../shared/config/config';
import { AuthoringPreviewDocumentProvider } from './views/documents/AuthoringPreviewDocument';
import { ChangeReviewDocumentProvider } from './views/documents/ChangeReviewDocument';
import { ComponentDiffDocumentProvider } from './views/documents/ComponentDiffDocument';
import { EditorDocumentProvider } from './views/documents/EditorDocument';
import { AppSetupPanel } from './views/panels/AppSetupPanel/AppSetupPanel';
import { BackendServicesPanel } from './views/panels/BackendServicesPanel/BackendServicesPanel';
import { AiAuthoringPanel, AiAuthoringPanel_ID } from './views/panels/AiAuthoringPanel';
import { ComponentPortsComponent } from './views/panels/componentports';
import { ComponentsPanel } from './views/panels/componentspanel';
import { ComponentXRayPanel } from './views/panels/ComponentXRayPanel';
// DataLineagePanel retired from reach (DEBT-012) — registration below is dead;
// import kept commented so the panel code (one release cycle) still compiles.
// import { DataLineagePanel } from './views/panels/DataLineagePanel';
import { DesignTokenPanel } from './views/panels/DesignTokenPanel/DesignTokenPanel';
import { EditorSettingsPanel } from './views/panels/EditorSettingsPanel/EditorSettingsPanel';
import { ExplainPanel, ExplainPanel_ID, startExplainTargetTracking } from './views/panels/ExplainPanel';
import { FileExplorerPanel } from './views/panels/FileExplorerPanel';
import { ExecutionHistoryPanel } from './views/panels/ExecutionHistoryPanel';
import { GitHubPanel } from './views/panels/GitHubPanel';
import { NodeReferencesPanel_ID } from './views/panels/NodeReferencesPanel';
import { NodeReferencesPanel } from './views/panels/NodeReferencesPanel/NodeReferencesPanel';
import { ProblemsPanel_ID } from './views/panels/ProblemsPanel';
import { ProblemsPanel } from './views/panels/ProblemsPanel/ProblemsPanel';
import { ProjectSettingsPanel } from './views/panels/ProjectSettingsPanel/ProjectSettingsPanel';
import { PropertyEditor } from './views/panels/propertyeditor';
import { SearchPanel } from './views/panels/search-panel/search-panel';
// import { TopologyMapPanel } from './views/panels/TopologyMapPanel'; // Disabled - shelved feature
import { TriggerChainDebuggerPanel } from './views/panels/TriggerChainDebuggerPanel';
import { UndoQueuePanel } from './views/panels/UndoQueuePanel/UndoQueuePanel';
import { VersionControlPanel_ID } from './views/panels/VersionControlPanel';
import { VersionControlPanel } from './views/panels/VersionControlPanel/VersionControlPanel';

export interface SetupEditorOptions {
  isLesson: boolean;
}

export function installSidePanel({ isLesson }: SetupEditorOptions) {
  const appRegistry = AppRegistry.instance;

  SidebarModel.instance.register({
    transient: true,
    id: 'PropertyEditor',
    name: 'Properties',
    // @ts-expect-error
    panel: PropertyEditor
  });

  SidebarModel.instance.register({
    transient: true,
    id: 'PortEditor',
    name: 'Ports',
    panel: ComponentPortsComponent
  });

  SidebarModel.instance.register({
    id: 'components',
    name: 'Components',
    order: 1,
    icon: IconName.Components,
    onOpen: () => {
      if (appRegistry.CurrentDocumentId !== EditorDocumentProvider.ID) {
        appRegistry.openDocument(EditorDocumentProvider.ID);
      }
    },
    panelProps: {
      // This is a temporary solution so we can keep the state of open folder etc
      options: {
        showSheetList: true,
        hideSheets: ['__cloud__']
      }
    },
    panel: ComponentsPanel
  });

  SidebarModel.instance.register({
    id: 'search',
    name: 'Search',
    fineType: new Keybinding(KeyMod.CtrlCmd, KeyCode.KEY_F).label,
    order: 2,
    icon: IconName.Search,
    panel: SearchPanel
  });

  // Topology Map Panel - Disabled (shelved for future development)
  // See: dev-docs/tasks/phase-4-canvas-visualisation-views/VIEW-001-topology-map/SHELVED.md
  // SidebarModel.instance.register({
  //   experimental: true,
  //   id: 'topology',
  //   name: 'Topology',
  //   order: 3,
  //   icon: IconName.StructureCircle,
  //   panel: TopologyMapPanel
  // });

  SidebarModel.instance.register({
    experimental: true,
    id: 'component-xray',
    name: 'Component X-Ray',
    description:
      'Shows comprehensive information about the active component: usage, interface, structure, and dependencies.',
    order: 4,
    icon: IconName.SearchGrid,
    panel: ComponentXRayPanel
  });

  // Data Lineage — RETIRED FROM REACH (DEBT-012, 2026-07-25).
  // The tracing algorithm enumerates every port instead of following wires
  // (40+ noise steps for a 3-node chain); five documented fix attempts failed
  // and the decision (DEBT-012) is NOT to patch it — a reachable panel that
  // confidently shows wrong data-flow answers is worse than none, especially
  // next to Explain Mode, which answers the same question correctly.
  // The panel/engine code stays one release cycle behind this dead registration,
  // then is deleted in the next cleanup batch (recorded for DEBT-010). A
  // deterministic lineage rebuild, if wanted, goes to
  // dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md.
  // SidebarModel.instance.register({
  //   experimental: true,
  //   id: 'data-lineage',
  //   name: 'Data Lineage',
  //   description:
  //     'Traces where data values come from (upstream sources) and where they go to (downstream destinations), crossing component boundaries.',
  //   order: 4.5,
  //   icon: IconName.Link,
  //   panel: DataLineagePanel
  // });

  // Must start at boot, not at panel mount: the selection Explain needs to see
  // is cleared by the sidebar switch that mounts the panel. See explainTarget.ts.
  startExplainTargetTracking();

  SidebarModel.instance.register({
    experimental: true,
    id: ExplainPanel_ID,
    name: 'Explain',
    description:
      'Ask what the selected node, selection, or whole component does. Read-only — the explanation cites ' +
      'nodes by name, and clicking one jumps to it on canvas.',
    order: 4.6,
    icon: IconName.MagicWand,
    panel: ExplainPanel
  });

  SidebarModel.instance.register({
    experimental: true,
    id: AiAuthoringPanel_ID,
    name: 'Build',
    description:
      'Describe a new component and watch an AI build it as nodes, validated against your project. ' +
      'Nothing is added until you accept — rejecting leaves no trace, accepting is undoable.',
    order: 4.7,
    icon: IconName.Pencil,
    panel: AiAuthoringPanel
  });

  SidebarModel.instance.register({
    experimental: true,
    id: ProblemsPanel_ID,
    name: 'Problems',
    description:
      'Validates the project against the node catalog: unknown node types, nonexistent ports, ' +
      'dangling/incompatible connections, orphaned nodes, and unresolved component references. ' +
      'Click a problem to jump to the offending node.',
    order: 4.7,
    icon: IconName.WarningTriangle,
    panel: ProblemsPanel
  });

  SidebarModel.instance.register({
    id: VersionControlPanel_ID,
    name: 'Version control',
    order: 5,
    icon: IconName.StructureCircle,
    panel: VersionControlPanel
  });

  SidebarModel.instance.register({
    id: 'github',
    name: 'GitHub',
    order: 5.5,
    icon: IconName.Link,
    panel: GitHubPanel
  });

  SidebarModel.instance.register({
    id: 'backend-services',
    name: 'Backend Services',
    isDisabled: isLesson === true,
    order: 8,
    icon: IconName.RestApi,
    panel: BackendServicesPanel
  });

  SidebarModel.instance.register({
    experimental: true,
    id: 'execution-history',
    name: 'Execution History',
    description: 'View workflow execution history, inspect node data, and debug failed runs.',
    isDisabled: isLesson === true,
    order: 8.8,
    icon: IconName.Bug,
    panel: ExecutionHistoryPanel
  });

  SidebarModel.instance.register({
    id: 'app-setup',
    name: 'App Setup',
    isDisabled: isLesson === true,
    order: 8.5,
    icon: IconName.Sliders,
    panel: AppSetupPanel
  });

  SidebarModel.instance.register({
    id: 'settings',
    name: 'Project settings',
    order: 9,
    icon: IconName.Setting,
    panel: ProjectSettingsPanel
  });

  SidebarModel.instance.register({
    experimental: true,
    id: 'trigger-chain-debugger',
    name: 'Trigger Chain Debugger',
    description: 'Records and visualizes chains of events triggered from user interactions in the preview.',
    order: 10,
    icon: IconName.Play,
    panel: TriggerChainDebuggerPanel
  });

  if (config.devMode) {
    SidebarModel.instance.register({
      experimental: true,
      id: 'file-explorer',
      name: 'File Explorer',
      order: 19,
      icon: IconName.FolderOpen,
      panel: FileExplorerPanel
    });

    SidebarModel.instance.register({
      experimental: true,
      id: 'design-tokens',
      name: 'Design Tokens',
      order: 20,
      icon: IconName.Palette,
      panel: DesignTokenPanel
    });

    SidebarModel.instance.register({
      experimental: true,
      id: 'undo-queue',
      name: 'Undo Queue',
      order: 21,
      icon: IconName.Reset,
      panel: UndoQueuePanel
    });
  }

  SidebarModel.instance.register({
    experimental: true,
    id: NodeReferencesPanel_ID,
    name: 'Node References',
    description: 'Node References Panel is showing how many times each core node and component is used.',
    order: 23,
    icon: IconName.Component,
    panel: NodeReferencesPanel
  });

  SidebarModel.instance.register({
    id: 'editor-settings',
    name: 'Editor settings',
    order: 1,
    placement: 'bottom',
    icon: IconName.SlidersHorizontal,
    panel: EditorSettingsPanel
  });
}

export function installDocuments() {
  const appRegistry = AppRegistry.instance;

  // Register EditorDocumentProvider
  appRegistry.registerDocumentProvider(EditorDocumentProvider.ID, new EditorDocumentProvider());
  appRegistry.openDocument(EditorDocumentProvider.ID);

  appRegistry.registerDocumentProvider(ComponentDiffDocumentProvider.ID, new ComponentDiffDocumentProvider());
  appRegistry.registerDocumentProvider(ChangeReviewDocumentProvider.ID, new ChangeReviewDocumentProvider());
  appRegistry.registerDocumentProvider(AuthoringPreviewDocumentProvider.ID, new AuthoringPreviewDocumentProvider());

  if (import.meta.webpackHot) {
    import.meta.webpackHot.accept('./views/documents/EditorDocument', () => {
      AppRegistry.instance.registerDocumentProvider(EditorDocumentProvider.ID, new EditorDocumentProvider());
    });
    import.meta.webpackHot.accept('./views/documents/ComponentDiffDocument', () => {
      AppRegistry.instance.registerDocumentProvider(
        ComponentDiffDocumentProvider.ID,
        new ComponentDiffDocumentProvider()
      );
    });
    import.meta.webpackHot.accept('./views/documents/ChangeReviewDocument', () => {
      AppRegistry.instance.registerDocumentProvider(ChangeReviewDocumentProvider.ID, new ChangeReviewDocumentProvider());
    });
  }
}
