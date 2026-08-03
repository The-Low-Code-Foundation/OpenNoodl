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
  /**
   * AIB-004 — other staged candidates from the same plan, spliced in beside the
   * subject.
   *
   * A plan's operations reference each other by design: the sign-up page the
   * agent authored instantiates the form component another operation authored,
   * and *neither* is in the project until the whole plan is applied. Without
   * these the preview boots a page whose child component does not exist, which
   * renders as a blank frame — the exact failure this preview was wired in to
   * answer. Ignored for the single-component loop, which has no siblings.
   */
  siblings?: ComponentFiles[];
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

/**
 * The candidate plus every component it instantiates, transitively.
 *
 * `extra` (AIB-004) are staged candidates from the same plan: they shadow a
 * project component of the same name, because the sandbox is running the
 * candidates, and a closure that sampled the project's version would describe a
 * component the preview is not showing.
 */
export function componentClosure(
  project: ProjectModel,
  root: ComponentModel,
  extra: ComponentModel[] = []
): ComponentModel[] {
  const byName = new Map(project.getComponents().map((c) => [c.name, c]));
  for (const component of extra) byName.set(component.name, component);
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
 * Whether a candidate has anything to render at all.
 *
 * AIB-004 asks this *before* opening a review document, to decide whether it
 * opens on the rendered preview or the diff — and at that point no preview
 * window exists to ask. Deliberately the same two lines `buildSandboxExport`
 * runs, so the tab and the frame can never disagree about what is renderable.
 */
export function candidateIsRenderable(files: ComponentFiles): boolean {
  const { component } = candidateComponent(files);
  return visualRoot(component, files) !== undefined;
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
  siblings = [],
  sampleData,
  useSampleData = true
}: SandboxExportOptions): SandboxExport {
  const { component, legacyName } = candidateComponent(files);

  const root = visualRoot(component, files);
  if (!root) {
    return {
      unrenderable: `${legacyName} has no visual root — there is nothing to render.`
    };
  }

  const json = Exporter.exportToJSON(project, { useBundles: false }) as unknown as SandboxExportJson | undefined;
  if (!json) {
    return { unrenderable: 'This project has no root component yet, so the runtime has nothing to boot.' };
  }

  // The plan's other staged candidates, reconstructed the same way the subject
  // is. Keyed by name so a sibling naming the subject (or another sibling twice)
  // cannot produce two components with one name in the export.
  const siblingsByName = new Map<string, ComponentModel>();
  for (const files of siblings) {
    const sibling = candidateComponent(files);
    if (sibling.legacyName === legacyName) continue;
    siblingsByName.set(sibling.legacyName, sibling.component);
  }
  const spliced = [component, ...siblingsByName.values()];
  const splicedNames = new Set([legacyName, ...siblingsByName.keys()]);

  // Splice the candidates in: replacing same-named components covers update
  // mode, where the project already holds the version being revised.
  json.components = json.components
    .filter((c) => !splicedNames.has(c.name))
    .concat(spliced.map((c) => Exporter.exportComponent(c) as { name: string }));
  json.rootComponent = legacyName;
  json.rootNode = root.id;

  // Routes are derived from the component set, so they have to be re-derived
  // from the set the sandbox is actually running.
  const components = project.getComponents().filter((c) => !splicedNames.has(c.name));
  json.routerIndex = Exporter.getRouterIndex([...components, ...spliced]);

  json.metadata = { ...(json.metadata ?? {}) };

  if (!useSampleData) {
    delete json.metadata[SANDBOX_METADATA_KEY];
    return { json, summary: 'Real backend — this preview uses your project’s live data.' };
  }

  const dataset = buildSandboxDataset({
    components: componentClosure(project, component, [...siblingsByName.values()]),
    sampleData
  });
  json.metadata[SANDBOX_METADATA_KEY] = dataset;

  return { json, summary: dataset.summary, notice: unknownShapeNotice(dataset.unknownShape) };
}
