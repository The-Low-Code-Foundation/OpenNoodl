/**
 * AIX-008 — Sandbox preview: the export a preview window receives
 *
 * The staged candidate is a detached `ComponentModel` that never enters the
 * project — that is what makes "reject leaves no trace" the absence of a call
 * rather than a promise, and this module must not weaken it. So the sandbox
 * export is assembled from the *project's own export* with the candidate
 * spliced in as the root component. Nothing is added to `ProjectModel`, nothing
 * is written, and the live preview's export is not touched.
 *
 * Splicing rather than cloning is also what keeps this cheap enough to redo on
 * every refine round: `exportToJSON` already runs on every project change.
 *
 * @module AiAssistant/authoring/sandboxExport
 */

import { SANDBOX_METADATA_KEY } from '@noodl/runtime/src/sandbox/types';

import { legacyNameToPath } from '../../../io/ProjectExporter';
import { reconstructLegacyComponent, toLegacyName } from '../../../io/ProjectImporter';
import * as Exporter from '../../../utils/exporter';
import { ComponentModel } from '../../componentmodel';
import type { NodeGraphNode } from '../../nodegraphmodel';
import type { ProjectModel } from '../../projectmodel';
import { buildSandboxDataset, unknownShapeNotice } from './sandboxData';
import type { AgentSampleData, ComponentFiles } from './types';

/** How deep to follow component instances when collecting what to sample. */
const MAX_CLOSURE_DEPTH = 4;

export interface SandboxExportOptions {
  project: ProjectModel;
  files: ComponentFiles;
  /** `sample_data` from the authoring model, when it supplied any. */
  sampleData?: AgentSampleData;
  /** False for the "Real backend" toggle: ship no dataset, so nothing is faked. */
  useSampleData?: boolean;
}

/**
 * The subset of a project export this module reads or rewrites. `exportToJSON`
 * is untyped; naming the handful of fields that matter here is cheaper than
 * typing the whole export format and keeps the splice honest.
 */
export interface SandboxExportJson {
  components: Array<{ name: string }>;
  rootComponent?: string;
  rootNode?: string;
  routerIndex?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SandboxExport {
  /** The export to send, or undefined when there is nothing to render. */
  json?: SandboxExportJson;
  /** Why there is no render, in one sentence, when `json` is undefined. */
  unrenderable?: string;
  /** Toolbar line describing the data the preview is running on. */
  summary?: string;
  /**
   * A caveat about the data, when the preview renders but cannot be trusted to
   * look full — a class whose field shape could not be inferred. Present with
   * `json`, unlike `unrenderable`: the component runs, the data does not.
   */
  notice?: string;
}

/**
 * The candidate as a real (but unowned) `ComponentModel`, through the same
 * reconstruction path accept uses — so what the preview renders is what accept
 * would add, not a lookalike.
 */
export function candidateComponent(files: ComponentFiles): { component: ComponentModel; legacyName: string } {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);
  const legacy = reconstructLegacyComponent(registryPath, files.component, files.nodes, files.connections);
  return { component: ComponentModel.fromJSON(legacy), legacyName };
}

/** The candidate plus every project component it instantiates, transitively. */
export function componentClosure(project: ProjectModel, root: ComponentModel): ComponentModel[] {
  const byName = new Map(project.getComponents().map((c) => [c.name, c]));
  const collected = new Map<string, ComponentModel>();
  const visit = (component: ComponentModel, depth: number) => {
    if (depth > MAX_CLOSURE_DEPTH) return;
    component.graph.forEachNode((node: NodeGraphNode) => {
      const referenced = byName.get(String(node.typename ?? ''));
      if (!referenced || collected.has(referenced.name)) return;
      collected.set(referenced.name, referenced);
      visit(referenced, depth + 1);
    });
  };

  visit(root, 0);
  return [root, ...collected.values()];
}

/** The node the preview renders from: the candidate's declared visual root. */
function visualRoot(component: ComponentModel, files: ComponentFiles): NodeGraphNode | undefined {
  const declared = files.nodes.visualRoots?.[0];
  const roots = component.graph.roots ?? [];
  const byDeclaration = declared ? roots.find((node: NodeGraphNode) => node.id === declared) : undefined;
  if (byDeclaration) return byDeclaration;
  return roots.find((node: NodeGraphNode) => node.type?.allowAsExportRoot);
}

/**
 * Build the export for one sandbox preview window.
 *
 * Returns `unrenderable` instead of an export when the candidate has no visual
 * root — a logic-only component has nothing to show, and saying so is better
 * than a white rectangle.
 */
export function buildSandboxExport({
  project,
  files,
  sampleData,
  useSampleData = true
}: SandboxExportOptions): SandboxExport {
  const { component, legacyName } = candidateComponent(files);

  const root = visualRoot(component, files);
  if (!root) {
    return {
      unrenderable: `${legacyName} has no visual root — there is nothing to render. The graph beside this shows what it does.`
    };
  }

  const json = Exporter.exportToJSON(project, { useBundles: false }) as unknown as SandboxExportJson | undefined;
  if (!json) {
    return { unrenderable: 'This project has no root component yet, so the runtime has nothing to boot.' };
  }

  // Splice the candidate in: replacing the same-named component covers update
  // mode, where the project already holds the version being revised.
  const exported = Exporter.exportComponent(component) as { name: string };
  json.components = json.components.filter((c) => c.name !== legacyName).concat([exported]);
  json.rootComponent = legacyName;
  json.rootNode = root.id;

  // Routes are derived from the component set, so they have to be re-derived
  // from the set the sandbox is actually running.
  const components = project.getComponents().filter((c) => c.name !== legacyName);
  json.routerIndex = Exporter.getRouterIndex([...components, component]);

  json.metadata = { ...(json.metadata ?? {}) };

  if (!useSampleData) {
    delete json.metadata[SANDBOX_METADATA_KEY];
    return { json, summary: 'Real backend — this preview uses your project’s live data.' };
  }

  const dataset = buildSandboxDataset({ components: componentClosure(project, component), sampleData });
  json.metadata[SANDBOX_METADATA_KEY] = dataset;

  return { json, summary: dataset.summary, notice: unknownShapeNotice(dataset.unknownShape) };
}
