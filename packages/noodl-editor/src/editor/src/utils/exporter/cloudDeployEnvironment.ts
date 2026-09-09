/**
 * HLS-013 — what a project needs around it before its cloud functions can be
 * exported, for a caller that is not the editor.
 *
 * ## Why a headless export is not just "call the export function"
 *
 * `exportComponent` **drops every connection `getConnectionHealth` calls
 * unhealthy**, and a connection is unhealthy when its port does not resolve. In
 * the editor, ports resolve because a whole environment was built at boot: the
 * cloud node library is loaded, the project is registered as a module, the
 * dynamic-port adapters have run, and the canvas has evaluated graph health.
 *
 * A plain Node process has none of that, and — this is the trap — **it does not
 * fail**. `NodeLibrary.loadLibrary()` with no `window` silently loads `{}`;
 * nothing resolves; every wire is unhealthy; the export succeeds and ships a
 * graph with no connections in it. A deploy built that way would publish
 * functions that are wired to nothing and answer nothing, and every step of it
 * would report success.
 *
 * SB-017 is the same defect from the other side: two paths, the same graphs,
 * opposite outcomes, because one of them built its bundle in a different
 * environment. This module exists so there is exactly one answer to "what does
 * the export need around it", and so the headless door gets the editor's answer
 * rather than its own.
 *
 * ## The measurement that says it works
 *
 * Prepared this way, a plain Node process exports the site-builder template's
 * nine cloud components with **every connection the template holds on disk** —
 * 5, 9, 9, 22, 32, 21, 21, 5, 19. Unprepared, the same call ships far fewer and
 * says nothing about it. That comparison is `hls013-headless-parity.test.ts`,
 * and it is measured against the template on disk rather than against the
 * editor, for the reason SB-017 gives: the two paths cannot run in one process,
 * so they are both measured against the same third thing.
 *
 * @module noodl-editor/utils/exporter/cloudDeployEnvironment
 */

import { CLOUD_DYNAMIC_PORT_ADAPTERS } from '@noodl-models/NodeTypeAdapters/CloudDynamicPortsAdapter';
import { NamedPortsAdapter } from '@noodl-models/NodeTypeAdapters/NamedPortsAdapter';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import cloudNodeLibrary from '@noodl-models/nodelibrary/cloud-node-library.json';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';

/**
 * Put a freshly loaded project into the state the editor's own deploy exports
 * from.
 *
 * ⚠️ **This mutates process-wide singletons** — `NodeLibrary.instance`,
 * `ProjectModel.instance` and `WarningsModel.instance` are all one per process.
 * That is fine in a CLI or an MCP server, which open one project and exit; it is
 * why nothing in the *editor* calls this, where the environment already exists
 * and installing the cloud library over the real one would change what the
 * author sees.
 */
export function prepareProjectForCloudExport(project: ProjectModel): void {
  // 🔴 A deploy must never write to the author's project.
  //
  // This is not defensive: preparing a project MUTATES it — the adapters below
  // add dynamic ports to nodes — and a model change schedules an autosave, whose
  // `doWriteProjectToDisk` calls `project.toDirectory(project._retainedProjectDirectory)`.
  // So without this, *reading* a project in order to deploy it rewrites every
  // component file on disk, from a process the author never opened.
  //
  // Measured on the way in: the first headless probe exited 1 on
  // `ReferenceError: localStorage is not defined` from exactly this scheduled
  // write — visible only because the probe had no project directory, which is
  // the harmless half of the same bug.
  //
  // `_isReadOnly` is the editor's own guard for this and short-circuits the save
  // before it touches the filesystem.
  project._isReadOnly = true;

  WarningsModel.instance.clearAllWarnings();

  // The library the editor really serves for cloud components — the generated
  // artefact, not a fixture, so a regeneration that changed a port set changes
  // this export too rather than passing against a stale copy.
  NodeLibrary.instance.loadLibrary(cloudNodeLibrary);

  ProjectModel.instance = project;
  NodeLibrary.instance.registerModule(project);

  // WFA-009's `pm-` sweep, which the editor gets from `registeradapters.ts` at
  // boot. Constructed and driven directly rather than importing that module,
  // which would register every adapter the editor has — including ones that
  // reach the renderer.
  new NamedPortsAdapter().events.projectLoaded();

  // SB-017's cloud adapters. Three, not one, because `setDynamicPorts` REPLACES
  // a node's dynamic port list, so the families are partitioned by node type and
  // each type has exactly one writer.
  CLOUD_DYNAMIC_PORT_ADAPTERS.forEach((Adapter) => new Adapter().events.projectLoaded());

  // What opening the project does. `exportComponent` reads `WarningsModel`, and
  // in the editor this pass is debounce-scheduled from the canvas — so a caller
  // that skipped it would export with no health signal at all.
  project.getComponents().forEach((component) => component.graph.evaluateHealth());
}
