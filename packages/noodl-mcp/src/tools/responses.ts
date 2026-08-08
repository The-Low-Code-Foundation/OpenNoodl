/**
 * The JSON payloads the tools return.
 *
 * SUB-008's design note says error responses are as much of the API surface as
 * success responses; the same is true of the success payloads, which an external
 * agent parses field by field. They were built as inline object literals, so
 * nothing named them and nothing checked them — the end-to-end specs asserted
 * against `any` and would have kept passing through a rename.
 *
 * Each handler annotates the object it hands to `jsonResult`, so a payload that
 * drifts from what is documented here fails to compile at the producer rather
 * than silently at the consumer.
 */

import type { CatalogExample, ExampleRow, NodeTypeDetail, NodeTypeLookupMiss, NodeTypeRow, NodeTypeSummary } from '../catalog';
import type { ComponentDescription } from '../describe';
import type { ComponentV2File, ConnectionV2, Diagnostic, NodeV2, RegistryV2File, ValidationReport } from '../editor-deps';
import type { ToolError } from '../errors';
import type { NodeIdRemap } from '../project/nodeIds';
import type { ComponentListRow, Usage } from '../project/ProjectStore';
import type { StructuralFailure, WriteValidation } from '../validate';

/**
 * The envelope `errorResult` produces. Always accompanied by `isError: true`.
 * `D` is the `details` bag, which varies by `code` — see the two named below.
 */
export interface ToolErrorPayload<D = Record<string, unknown>> {
  error: {
    code: ToolError['code'];
    message: string;
    details?: D;
  };
}

/** `details` for a `validation-failed` rejection from create/update_component. */
export interface ValidationFailureDetails {
  /** One human-readable line per blocking problem. */
  readable: string[];
  structural?: StructuralFailure[];
  /** The errors this change would have introduced — the reason for the refusal. */
  newErrors: Diagnostic[];
  allDiagnostics: Diagnostic[];
}

/** `details` when delete_component refuses because the component is still used. */
export interface DeletionRefusalDetails {
  usages: Usage[];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export interface ProjectInfoResponse {
  name?: string;
  id?: string;
  version?: string;
  runtimeVersion?: string;
  settings?: Record<string, unknown>;
  rootComponent?: { path: string };
  routes?: unknown;
  styles?: { colors?: unknown; textStyles?: string[]; variantCount?: number };
  stats: RegistryV2File['stats'] | { totalComponents: number };
  mode: 'read-write' | 'read-only';
  note: string;
  /**
   * AAQ-008 — the decomposition doctrine, verbatim from the shared module the
   * in-editor planner is prompted with. Present only on a read-write server:
   * a read-only client has nothing to apply it to, and it is not small.
   */
  authoringDoctrine?: string;
  /**
   * Phase 54 — the design doctrine, verbatim from the same shared module. Same
   * read-write gate and the same reason as `authoringDoctrine`: it is the only
   * orientation an external agent gets before it draws anything.
   */
  designDoctrine?: string;
}

export interface ListComponentsResponse {
  components: ComponentListRow[];
  /** Present only when a `type` filter matched nothing but the project has components. */
  note?: string;
}

export interface GetComponentResponse {
  path: string;
  legacyName: string;
  type: string;
  description?: string;
  displayName?: string;
  ports?: ComponentV2File['ports'];
  revision: string;
  nodes: NodeV2[];
  visualRoots?: string[];
  comments?: unknown[];
  connections: ConnectionV2[];
  /** Only when `include_usages` was set. */
  usages?: Usage[];
}

export interface SearchMatch {
  component: string;
  nodeId: string;
  nodeType: string;
  label?: string;
  matchedOn?: string;
}

export interface SearchProjectResponse {
  matches: SearchMatch[];
  /** Present only when the result cap was hit. */
  truncated?: boolean;
}

export type ExplainComponentResponse = ComponentDescription;

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface ListNodeTypesResponse {
  nodeTypes: NodeTypeRow[];
  categories: string[];
}

export interface GetNodeTypeResponse {
  types: Array<NodeTypeDetail | NodeTypeSummary | NodeTypeLookupMiss>;
  /** Types degraded to summaries because the full response would blow the
   * host's tool-result cap (DEBT-009). Re-request these individually. */
  summarized?: string[];
  hint?: string;
}

export interface ListExamplesResponse {
  examples: ExampleRow[];
}

export type GetExampleResponse = CatalogExample;

// ─── Validate ─────────────────────────────────────────────────────────────────

export interface ValidateComponentResponse {
  /** Absent when the requested component could not be resolved to a target. */
  target?: string;
  summary: ValidationReport['summary'];
  diagnostics: Diagnostic[];
}

export interface ValidateProjectResponse {
  summary: ValidationReport['summary'];
  diagnostics: Diagnostic[];
}

// ─── Author ───────────────────────────────────────────────────────────────────

/**
 * The validation block attached to a successful write. Errors never appear here
 * — a write carrying new errors is rejected — so `diagnostics` holds warnings and
 * infos only, and `preexistingErrors` the ones that were already on disk.
 */
export interface WriteValidationSummary {
  validation: {
    summary: WriteValidation['summary'];
    diagnostics?: Diagnostic[];
    preexistingErrors?: Diagnostic[];
    note?: string;
  };
}

/**
 * AAQ-005 — what a write did to the project's page router, when it did anything.
 *
 * Reported rather than performed silently: registration writes a *second*
 * component (the one holding the Router), and a tool that quietly edits a file
 * the caller did not name has to say so. The sentence is the editor's own
 * `describePageRegistration`, so the two clients narrate the same act the same
 * way.
 */
export interface PageRegistrationSummary {
  registeredPages?: {
    /** Legacy name of the component holding the router that was written. */
    router: string;
    /** Pages added to `routes`, in write order. May be empty when only the start page moved. */
    added: string[];
    /** Set when the app now opens on a different page. */
    startPage?: string;
    /** One human-readable sentence: what happened, in the user's terms. */
    summary: string;
  };
}

/**
 * AAQ-011/F12 — node ids this write had to move, and why.
 *
 * Present only when something moved. The rewrite is safe to do silently (a node
 * id is never referenced from outside its own component) but not honest to
 * *report* silently: a caller that intends a follow-up `update_component` keyed
 * on the id it just sent needs to know the id changed. See
 * `project/nodeIds.ts`.
 */
export interface NodeIdRemapSummary {
  remappedNodeIds?: NodeIdRemap[];
  remapNote?: string;
}

export interface CreateComponentResponse extends WriteValidationSummary, PageRegistrationSummary, NodeIdRemapSummary {
  created: string;
  legacyName: string;
  type: string;
  revision: string;
  registry: 'updated';
}

export interface UpdateComponentResponse extends WriteValidationSummary, PageRegistrationSummary, NodeIdRemapSummary {
  updated: string;
  revision: string;
  /** Present for the `operations` form; absent for `set`. */
  applied?: string[];
}

export interface DeleteComponentResponse {
  deleted: string;
  removedFiles: string[];
  registry: 'updated';
  /**
   * Both present only on a forced delete that broke references. These are
   * diagnostics against the *other* components, not the deleted one's usages.
   */
  brokenReferences?: Diagnostic[];
  note?: string;
}
