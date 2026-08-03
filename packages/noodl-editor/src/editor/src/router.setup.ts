import { installPlanSessionPersistence } from '@noodl-models/AiAssistant/authoring/installPlanSessionPersistence';
import { AppRegistry } from '@noodl-models/app_registry';
import { installProjectDocs } from '@noodl-models/ProjectDocs';
import { installImportReport } from '@noodl-utils/import-engine/legacy/loadReport';
import { SidebarModel } from '@noodl-models/sidebar';
import { Keybinding } from '@noodl-utils/keyboard/Keybinding';
import { KeyCode, KeyMod } from '@noodl-utils/keyboard/KeyCode';

import { IconName } from '@noodl-core-ui/components/common/Icon';

import config from '../../shared/config/config';
import { CloudFunctionDeployer } from './services/CloudFunctionDeployer';
import { AuthoringPreviewDocumentProvider } from './views/documents/AuthoringPreviewDocument';
import { ChangeReviewDocumentProvider } from './views/documents/ChangeReviewDocument';
import { ComponentDiffDocumentProvider } from './views/documents/ComponentDiffDocument';
import { EditorDocumentProvider } from './views/documents/EditorDocument';
import { AiAuthoringPanel, AiAuthoringPanel_ID } from './views/panels/AiAuthoringPanel';
import { BackendServicesPanel } from './views/panels/BackendServicesPanel/BackendServicesPanel';
import { installBackendSurfacePanels } from './views/panels/BackendServicesPanel/LocalBackendCard/backendSurfaces';
import { ComponentPortsComponent } from './views/panels/componentports';
import { ComponentsPanel } from './views/panels/componentspanel';
import { ComponentXRayPanel } from './views/panels/ComponentXRayPanel';
// DataLineagePanel retired from reach (DEBT-012) — registration below is dead;
// import kept commented so the panel code (one release cycle) still compiles.
// import { DataLineagePanel } from './views/panels/DataLineagePanel';
import { DesignTokenPanel } from './views/panels/DesignTokenPanel/DesignTokenPanel';
import { DocsPanel, DocsPanel_ID } from './views/panels/DocsPanel';
import { ExecutionHistoryPanel } from './views/panels/ExecutionHistoryPanel';
import { WorkflowsPanel, WorkflowsPanel_ID } from './views/panels/WorkflowsPanel';
import { ExplainPanel, ExplainPanel_ID, startExplainTargetTracking } from './views/panels/ExplainPanel';
import { FileExplorerPanel } from './views/panels/FileExplorerPanel';
import { NodeReferencesPanel_ID } from './views/panels/NodeReferencesPanel';
import { NodeReferencesPanel } from './views/panels/NodeReferencesPanel/NodeReferencesPanel';
import { ProblemsPanel_ID } from './views/panels/ProblemsPanel';
import { ProblemsPanel } from './views/panels/ProblemsPanel/ProblemsPanel';
import { PropertyEditor } from './views/panels/propertyeditor';
import { ProvenancePanel } from './views/panels/ProvenancePanel';
import { SearchPanel } from './views/panels/search-panel/search-panel';
import { SETTINGS_PANEL_ID, SettingsPanel } from './views/panels/SettingsPanel';
// import { TopologyMapPanel } from './views/panels/TopologyMapPanel'; // Disabled - shelved feature
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
    defaultWidth: 280,
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
        showSheetList: true
        // WFA-001: `hideSheets: ['__cloud__']` used to be here, and it filtered
        // cloud functions out of both the sheet dropdown and the tree — the
        // first of the four cuts that made everything phases 19 and 22 built
        // unreachable from the editor. The cloud sheet is now a first-class,
        // always-listed sheet; it is still kept out of the flattened "All" tree,
        // but that is `useComponentsPanel`'s decision about runtime boundaries
        // rather than a panel option. See WFA-001-NOTES.md decision 1.
      }
    },
    panel: ComponentsPanel
  });

  SidebarModel.instance.register({
    id: 'search',
    defaultWidth: 340,
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

  // WFA-001: also at boot, and for the same class of reason — cloud functions
  // must reach a running backend whether or not the Backend Services panel has
  // ever been opened. Subscribes to project saves; pushes nothing until there
  // is a running backend and a cloud function to push.
  CloudFunctionDeployer.start();

  SidebarModel.instance.register({
    experimental: true,
    id: ExplainPanel_ID,
    defaultWidth: 400,
    name: 'Explain',
    description:
      'Ask what the selected node, selection, or whole component does. Read-only — the explanation cites ' +
      'nodes by name, and clicking one jumps to it on canvas.',
    order: 4.6,
    // Not MagicWand: a wand means "generate", and Explain is read-only. It is also
    // the app-wide AI-action mark (AiAuthoringPanel, NodeContextMenu), so the rail
    // was colliding with it. `Explain` is a node card being asked a question.
    icon: IconName.Explain,
    panel: ExplainPanel
  });

  SidebarModel.instance.register({
    experimental: true,
    id: AiAuthoringPanel_ID,
    defaultWidth: 400,
    name: 'Build',
    description:
      'Describe a new component and watch an AI build it as nodes, validated against your project. ' +
      'Nothing is added until you accept — rejecting leaves no trace, accepting is undoable.',
    order: 4.7,
    // Was Pencil, which said "edit" and nothing more — this is the panel that
    // actually authors a graph. Explain and Build were effectively swapped.
    icon: IconName.BuildAi,
    panel: AiAuthoringPanel
  });

  // AIX-009: the authoring loop reads the project's docs at session
  // construction, which happens long before anyone opens this panel — so the
  // provider is installed at boot, like the explain-target tracking above, not
  // at panel mount.
  installProjectDocs();

  // LIB-006: same reasoning, same seam. A session authoring against a legacy
  // import needs to know what the importer could not convert, and it is
  // constructed long before anyone opens a panel.
  installImportReport();

  // AIB-003 slice 4: and again — a `PlanRun` staging candidates publishes them
  // whether or not the Build panel is mounted, so the thing that writes them to
  // disk cannot be installed by a mount.
  installPlanSessionPersistence();

  SidebarModel.instance.register({
    experimental: true,
    id: DocsPanel_ID,
    defaultWidth: 420,
    name: 'Docs',
    description:
      "This project's docs/ folder — the brief, the architecture decisions, and the conventions the AI follows " +
      'when it builds here. Owned by you and tracked by git; AI-proposed changes arrive as diffs you accept or ' +
      'reject.',
    order: 4.8,
    // Was File, which read as "a file" rather than "documentation".
    icon: IconName.BookOpen,
    panel: DocsPanel
  });

  SidebarModel.instance.register({
    experimental: true,
    id: ProblemsPanel_ID,
    defaultWidth: 420,
    name: 'Problems',
    description:
      'Validates the project against the node catalog: unknown node types, nonexistent ports, ' +
      'dangling/incompatible connections, orphaned nodes, and unresolved component references. ' +
      'Click a problem to jump to the offending node.',
    order: 4.7,
    // Same triangle, stroked: the filled one is the inline severity mark, and in
    // the rail it was the only filled glyph among eleven stroked ones.
    icon: IconName.WarningTriangleLine,
    panel: ProblemsPanel
  });

  // AIB-008 slice 4: ONE rail entry over one repository. The `github` slot that
  // sat beside this at order 5.5 is gone, and its contents — the remote, the
  // connect-and-create flow, and the issues and pull requests — are sections of
  // this panel.
  //
  // ⚠️ `GitBranch` and not the pull-request glyph the GitHub slot carried. The
  // panel must not read as *GitHub*: it is a git panel that has a GitHub section
  // when the remote happens to be there, and it works perfectly well for a
  // project that will never have a GitHub account (slice 4's own instruction).
  //
  // The id is unchanged, which is what keeps saved sidebar layouts working
  // (criterion 6). A layout that pinned `github` simply names a panel that no
  // longer exists, which `SidebarModel` already tolerates the same way it
  // tolerates a panel disabled for lessons.
  SidebarModel.instance.register({
    id: VersionControlPanel_ID,
    name: 'Version control',
    order: 5,
    // StructureCircle is an org chart, not a git glyph — and Workflows below was
    // using the identical file, so the rail carried the same mark twice.
    icon: IconName.GitBranch,
    panel: VersionControlPanel
  });

  SidebarModel.instance.register({
    id: 'backend-services',
    defaultWidth: 560,
    name: 'Backend Services',
    isDisabled: isLesson === true,
    order: 8,
    // Was RestApi — a `{ }` braces glyph, i.e. "code". This panel is now the
    // database, auth, email, storage, search and triggers; REST is one facet of it.
    icon: IconName.Database,
    panel: BackendServicesPanel
  });

  // PNL-009: Schema, Data, Access, Triggers, Email, Sign-in providers and
  // Search. Transient, so they take no rail slot — they are opened from a local
  // backend's card and land in full mode. They used to be `createPortal` calls
  // into a fixed overlay; see `backendSurfaces.tsx` for what that cost.
  installBackendSurfacePanels();

  // WFA-002: no longer experimental. It has a main-process handler, real data
  // from every running backend, and a working detail view — the flag was a
  // leftover from before any of that was true, and it kept the only surface
  // that can explain a backend run out of the rail.
  SidebarModel.instance.register({
    id: 'execution-history',
    name: 'Execution History',
    description: 'Watch a cloud function or workflow run, step by step, with the data each step received.',
    isDisabled: isLesson === true,
    order: 8.8,
    // Was Bug — a literal insect, for a panel that is a run timeline and not a
    // debugger, as the WFA-002 note directly above says.
    icon: IconName.History,
    panel: ExecutionHistoryPanel
  });

  // WFA-004: where a workflow is found and opened onto the canvas. Beside
  // Execution History deliberately — authoring and watching a run are the same
  // question asked twice, and both are about a backend rather than the project.
  SidebarModel.instance.register({
    id: WorkflowsPanel_ID,
    name: 'Workflows',
    description: 'Author a backend workflow as a graph: steps as nodes, routes as connections.',
    isDisabled: isLesson === true,
    order: 8.9,
    // The other half of the StructureCircle duplication. Two steps and the route
    // between them — deliberately not circles-and-a-curve, which would read as the
    // git glyph now four slots above.
    icon: IconName.Workflow,
    panel: WorkflowsPanel
  });

  // OBS-002. Not `experimental`: it answers a question on a cold editor with nothing recorded,
  // and it is the surface the Trigger Chain Debugger below was reaching for.
  SidebarModel.instance.register({
    id: 'provenance',
    name: 'Provenance',
    description: 'Walks backwards from a port to show where its value came from, and where it stopped.',
    order: 9.5,
    icon: IconName.Search,
    panel: ProvenancePanel
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

  /*
   * PNL-008: three settings destinations became one.
   *
   *   `app-setup`       (Sliders, order 8.5)            ─┐
   *   `settings`        (Setting/a sun, order 9)         ├─→ this
   *   `editor-settings` (SlidersHorizontal, bottom)     ─┘
   *
   * The surviving id is `settings`, so the projects already sitting on it keep
   * their place; the other two are mapped on read in `settingsPanelRoute.ts`.
   * Placement follows the phase-25 mock, which puts the one gear below the rail
   * spacer — the slot Editor settings already occupied, and where an editor's
   * settings are conventionally found.
   *
   * `IconName.Setting` still, but its glyph is now a cog rather than a sun. All
   * eight of its call sites mean "settings"; none meant "appearance".
   *
   * No `isDisabled: isLesson` (which `app-setup` carried): this panel is also
   * the only route to the theme switch and the AI provider, and hiding those in
   * a lesson would be a functional loss, not a simplification.
   */
  SidebarModel.instance.register({
    id: SETTINGS_PANEL_ID,
    defaultWidth: 460,
    name: 'Settings',
    order: 1,
    placement: 'bottom',
    icon: IconName.Setting,
    panel: SettingsPanel
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
      AppRegistry.instance.registerDocumentProvider(
        ChangeReviewDocumentProvider.ID,
        new ChangeReviewDocumentProvider()
      );
    });
  }
}
