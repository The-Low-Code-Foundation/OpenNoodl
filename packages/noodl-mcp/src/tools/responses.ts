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

import type {
  CatalogExample,
  ExampleRow,
  NodeTypeDetail,
  NodeTypeExportForPorts,
  NodeTypeLookupMiss,
  NodeTypeRow,
  NodeTypeSummary
} from '../catalog';
import type { ComponentDescription } from '../describe';
import type {
  AttachedExample,
  ComponentV2File,
  ConnectionV2,
  Diagnostic,
  NodeV2,
  RegistryV2File,
  ValidationReport
} from '../editor-deps';
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
  /**
   * LAS-007 §1 — validated graphs that already do what the rejection is asking
   * for, attached rather than offered. Present only when the shared
   * `DIAGNOSTIC_EXAMPLES` table has an entry for one of the blocking codes; the
   * graph itself appears on the first rejection of a code per session and its id
   * alone thereafter.
   */
  examples?: {
    note: string;
    recipes: AttachedExample[];
  };
}

/** `details` when delete_component refuses because the component is still used. */
export interface DeletionRefusalDetails {
  usages: Usage[];
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export interface ProjectInfoResponse {
  name?: string;
  /**
   * FIX-008 E — **the directory these tools actually read and write.**
   *
   * 🔴 A server bound to the wrong project is otherwise undetectable in-session. The bound path is
   * announced once, in the `initialize` instructions, and nothing in any tool result repeats it —
   * so a user with a stale or user-scope registration gets a server that answers every question
   * confidently about somebody else's project, and accepts every write. Naming the directory in the
   * one tool an agent is told to call first is what makes the mismatch visible at all.
   */
  projectDirectory?: string;
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
   * LAS-007 §3 — the seven silent failures, ahead of both doctrines. Same
   * read-write gate and the same shared-module rule as the two below.
   */
  authoringTraps?: string;
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
  /**
   * CMP-001 — the component interface playbook: what to put ON a component,
   * which `authoringDoctrine` never said. Same read-write gate and the same
   * shared-module rule as the fields around it. Phase 85's measurement is the
   * reason it ships at all — 26% of the corpus's components publish any
   * outputs against 84% of the shipped library's — and the reason it ships
   * HERE is the one SB-002 gives: the instruction surface is budgeted, a
   * result field is not.
   */
  interfaceDoctrine?: string;
  /**
   * SB-002 — the backend doctrine, verbatim from the same family of shared
   * modules. Same read-write gate. Exists because the frontend guidance
   * actively misleads on cloud graphs ("a component's interface is a Component
   * Inputs node" is false for a cloud function), and because the surface
   * budget gate rules the `instructions` channel out.
   */
  backendDoctrine?: string;
  /**
   * CN-003 — the project's own node kits, and what reading them produced.
   *
   * **Omitted entirely for a project with no `noodl_modules` directory**, which
   * is nearly all of them: this is per-response cost on the one tool an agent is
   * told to call first, and a field saying "no kits" on a project that was never
   * going to have any is noise. Present the moment there is a kit — or a reason
   * we cannot say.
   *
   * 🔴 `unavailable` is the field that matters. Empty `modules` means the
   * project declares no kit node types; `unavailable` means we could not find
   * out, and the two must never be read as the same answer. That distinction is
   * CN-002's whole subject, applied one layer down to the mechanism CN-002's
   * diagnostics measure.
   */
  kits?: ProjectKitsReport;
  /**
   * FIX-021 slice B — the person this is being built for, when they have written
   * it down. `<userData>/PREFERENCES.md`, rendered by the same function the
   * editor's own authoring turn uses (see `../userProfile`).
   *
   * **Omitted whenever the user has written nothing** — no registration variable,
   * no file, or a file still holding only its seeded prompts. The empty case is
   * the common one and it costs nothing, which is the entire reason a global
   * always-doc is affordable at all.
   *
   * ⚠️ Not gated on `allowWrites`, unlike the two doctrines above. Those are
   * instructions for authoring and a read-only client has nothing to apply them
   * to; this file's first heading is *"how I like to be talked to"*, which is
   * about the conversation rather than the build. A read-only server still has
   * that conversation.
   *
   * 🔴 The precedence is stated in the value, not assumed from the field name:
   * these rank below the project's own `docs/CONVENTIONS.md` and above the
   * model's defaults. The in-editor prompt says the same sentence beside the
   * same block, and for the same reason — position is a caching decision and
   * reads as priority if nobody says otherwise.
   */
  userPreferences?: { note: string; preferences: string };
}

export interface ProjectKitsReport {
  /** Kits that loaded, with the node types each contributed to the catalog. */
  modules: Array<{ name: string; dirPath: string; nodeTypes: string[] }>;
  /**
   * Kit types whose name is already a shipped type.
   *
   * ⚠️ **The built-in wins *in the catalog* only** — the kit's node is not in it,
   * and this is where that is said. 🔴 **At runtime the kit wins instead**
   * (`NodeRegister.register` overwrites, and module nodes register after
   * built-ins), so a collision means validation and the running app disagree
   * about what the type is. Measured in CN-015; `kitDiagnostics` in
   * `@nodegx/kit-catalog` is the wording that states both halves.
   */
  collisions?: Array<{ typeName: string; kitModule: string }>;
  /** Kits that threw at import or failed to register. Their nodes are absent. */
  failures?: Array<{ kitModule: string; message: string }>;
  /** Malformed or unreadable `manifest.json` files, from the shared scanner. */
  warnings?: string[];
  /** 🔴 Set when extraction could not run. Not the same as "there are none". */
  unavailable?: string;
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
  /** AWP-001 §3 — true when the file had no `visualRoots` and the server derived
   * it, so an agent can tell "this is what renders" from "this is what was written". */
  visualRootsDerived?: boolean;
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
  /**
   * FLD-013 — the payload-level half of the export reading.
   *
   * 🔴 **A row's `export` field is absent far more often than it is present, and absence has to
   * mean something a caller can read.** This says what: the headline coverage the product prints
   * beside its own alpha warning, and one sentence saying that a silent row is a translated type
   * that refuses on no port. Without it, silence is indistinguishable from a server that does not
   * carry the field at all.
   */
  exportCoverage: {
    exportable: number;
    placeable: number;
    percent: number;
    notice: string;
    note: string;
  };
}

/**
 * AWP-005 §2 — what `get_node_type({ports: [...]})` returns per type.
 *
 * 🔴 CMP-009 — this path short-circuits above the summary, and for four fields
 * that was a hole rather than a saving. Measured over the 27 real type-requests
 * on it (every transcript on the authoring machine, 25 files, all post-dating
 * `detail` shipping 2026-07-25): **26 of 27 were COLD** — the session had never
 * surveyed that type. The cheap path is a FIRST contact, not a top-up, so
 * everything it withholds is withheld from someone who has seen nothing else.
 *
 * What it costs to answer that properly, measured through these functions on
 * that traffic against a 1,193 B/request base: `export` ports-filtered ~11
 * tok/request, `summary` ~31, `antiPatterns` ~23, `deprecated` 0. ~65 together.
 *
 * ⚠️ `examples` is deliberately NOT carried: 8,739 B — **27.1% of the base, the
 * single most expensive dropped field and the least port-scoped**. Carrying
 * everything the summary carries costs +58.3% and undercuts the only reason
 * this path exists. Recorded here rather than silently omitted, the way
 * CMP-006 AC3 recorded `patterns`.
 */
export interface NodeTypePortsView {
  typeName: string;
  displayName: string;
  /**
   * CMP-009 §4 — one line saying what the type is. 26 of 27 callers on this
   * path had never surveyed it.
   */
  summary?: string;
  /**
   * CMP-009 §3 — the type is retired. 30 of the 176 catalog types are, and this
   * path said nothing about any of them: `getNodeTypePorts('Animation', …)`
   * returned a clean, detailed, entirely unqualified answer.
   *
   * ⚠️ `antiPatterns` does NOT cover this — **1 of the 30 carries one**. The row
   * that proposed `summary` + `antiPatterns` as the whole fix would have warned
   * on 1 deprecated type in 30.
   */
  deprecated?: true;
  /**
   * CMP-009 §2 — the port-scoped half of FLD-013's `export`, filtered to the
   * ports actually asked for.
   *
   * 🔴 `structurePorts`/`contentPorts` **name ports**: a value arriving on one
   * over a WIRE leaves the node out of the exported code. The path where you
   * are setting a port is the one place that matters, and it was the one place
   * that did not say. Three live hits in the 27 real requests — including
   * `net.noodl.visual.columns` asked for **nine ports, all nine of them
   * `structurePorts`**, answered with nine detailed port docs and no warning.
   *
   * Filtered rather than whole because the unfiltered field costs 7.2% against
   * 3.6%, and the ports the caller did not ask about are the summary's job.
   */
  export?: NodeTypeExportForPorts;
  inputs: NodeTypeDetail['inputs'];
  outputs: NodeTypeDetail['outputs'];
  runtimeBehavior?: string;
  /** Names that matched no port. Reported rather than dropped. */
  notFound?: string[];
  /**
   * DEF-003 (b) — why, for the misses where "no such port" is a dead end rather than a typo.
   * Keyed by the name in `notFound`; absent when nothing has a reason to give.
   */
  notFoundNotes?: Record<string, string>;
  /**
   * 🔴 CMP-009 §1 — `notFound` is an absence claim, and on a type with dynamic
   * ports it is made against a list that is incomplete **by construction**.
   *
   * **16 of the 27 real requests returned `notFound`; 13 of those 16 were on a
   * type with dynamic ports**, and only one carried a `notFoundNote`. The worst
   * case is the node this phase exists to teach: `Component Inputs` has **zero**
   * static inputs — every port on it is author-declared — and a real call asked
   * it for four ports and got `inputs: [], outputs: [], notFound: [all four]`.
   * A confidently empty answer.
   *
   * Emitted only alongside a non-empty `notFound`, because that is where the
   * claim is made: a request whose ports all resolved is asserting nothing and
   * pays nothing. A type with NO dynamic ports never gets it — there the
   * absence claim is sound, and qualifying it would teach a lie.
   *
   * See [[assert-an-absence-with-a-known-firing-signal-beside-it]].
   */
  notFoundCaveat?: string;
  /**
   * CMP-009 §4 — the shapes to avoid. s11 counted that `ports` short-circuits
   * above the summary, so 44 of the 45 recorded `get_node_type` calls returned
   * neither `patterns` nor `antiPatterns`; CMP-006 AC3 closed the summary half
   * and this closes the other.
   *
   * `patterns` stays off, where CMP-006 AC3 left it: 259 entries over 130 types
   * against 203 over 113, the larger half, and a session that wants it must
   * price it the same way.
   */
  antiPatterns?: string[];
}

export interface GetNodeTypeResponse {
  types: Array<NodeTypeDetail | NodeTypeSummary | NodeTypePortsView | NodeTypeLookupMiss>;
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
  /**
   * VIB-007 M1 — the completion block from `tools/completion.ts`. Loose because
   * it is the same shape on four doors and typing it four times is four things
   * to drift; `done` is always present on it, and the rest is the reason.
   */
  [completion: string]: unknown;
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

/**
 * AWP-001 §2 — what actually renders, reported back on every successful write.
 *
 * `visual_roots` had no `.describe()`, appeared in no tool description, and was
 * optional on all three doors: a model had no way to learn the field existed and
 * no consequence when it omitted one. Fifteen tokens in a result — `"visualRoots":
 * ["card"], "visualRootsDerived": true` — teach the concept at the only moment it
 * is relevant, which is the documentation this field should always have had.
 */
export interface VisualRootsSummary {
  /** The ids that will draw. Absent when the component has no visual node at all. */
  visualRoots?: string[];
  /** True when the server computed the list; absent when the caller supplied it. */
  visualRootsDerived?: boolean;
}

/**
 * AWP-006 — the backend tools arrived because the graph asked for them.
 *
 * Present only on the write that first introduced a node needing a backend, and
 * only when the backend group was still deferred. It is a disclosure event, not
 * a diagnostic: the write succeeded, and what changed is the surface the caller
 * can see from its next turn.
 */
export interface BackendDisclosureSummary {
  backendToolsRevealed?: string;
}

export interface CreateComponentResponse
  extends WriteValidationSummary,
    PageRegistrationSummary,
    NodeIdRemapSummary,
    BackendDisclosureSummary,
    VisualRootsSummary {
  created: string;
  legacyName: string;
  type: string;
  revision: string;
  registry: 'updated';
  /**
   * LAS-006 §4 — present only when this write created a **page** and no plan
   * exists in this server process. One sentence pointing at the plan door, on
   * the door a page most often comes through without one.
   */
  planAdvisory?: string;
}

export interface UpdateComponentResponse
  extends WriteValidationSummary,
    PageRegistrationSummary,
    NodeIdRemapSummary,
    BackendDisclosureSummary,
    VisualRootsSummary {
  updated: string;
  revision: string;
  /** Present for the `operations` form; absent for `set`. */
  applied?: string[];
}

/**
 * AWP-006 — `find_tools`' payload.
 *
 * `groups` is returned on every call, including the ones that reveal nothing,
 * because the inventory is the thing a model needs to decide what to ask for
 * next and it is cheaper to always send it than to make the model ask twice.
 */
export interface FindToolsResponse {
  /** Names revealed by this call. Empty when they were already advertised. */
  revealed: string[];
  groups: {
    group: string;
    title: string;
    purpose: string;
    tools: number;
    advertised: boolean;
  }[];
  /** Present only when something was revealed: how the client sees it. */
  note?: string;
}

/** BST-006 — one project the launcher has recorded. */
export interface ProjectListRow {
  name: string;
  /** Absolute, resolved. This is the argument a server is started with. */
  directory: string;
  /**
   * `v2` opens; `legacy` needs migrating in the editor first; `unrecognised` is
   * a directory the launcher remembers that no longer looks like a project.
   * Reported rather than filtered — see `listProjects.ts`.
   */
  format: 'v2' | 'legacy' | 'unrecognised';
  /** ISO, from the launcher's `latestAccessed`. Absent when it never recorded one. */
  lastOpened?: string;
}

export interface ListProjectsResponse {
  projects: ProjectListRow[];
  note: string;
  /** Only when the list is empty: the store files that were looked for, in order. */
  searched?: string[];
}

/** P79 K1 — routers that stopped listing a deleted component. */
export interface PageUnregistrationSummary {
  unregisteredPages?: Array<{
    /** Legacy name of the component holding the router that was written. */
    router: string;
    /** The route strings removed, as they were spelled in `routes`. */
    removed: string[];
    /** Present when the router's start page named the deleted component and is now unset. */
    startPageCleared?: true;
  }>;
}

export interface DeleteComponentResponse extends PageUnregistrationSummary {
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
