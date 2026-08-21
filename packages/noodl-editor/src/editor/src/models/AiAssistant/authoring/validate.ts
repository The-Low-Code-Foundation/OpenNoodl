/**
 * AIX-002 — The Authoring Loop: validation gate
 *
 * The same policy as the MCP server's write-gate (SUB-008), built from the same
 * shared parts: Ajv structural check of the three files first, then SUB-006's
 * semantic validator in strict mode — an agent authoring a fresh graph is
 * exactly the population for whom a typo'd node type must hard-fail, and the
 * diagnostic carries the suggestion that makes the repair round cheap.
 *
 * Pure and renderer-safe: the project arrives as an `ExplainGraph` (plain
 * data), the candidate as in-memory v2 files. Nothing here reads disk or
 * touches an editor model.
 *
 * @module AiAssistant/authoring/validate
 */

import { SCHEMA_IDS, SchemaValidator } from '../../../schemas';
import {
  authoredNodes,
  authoredPreconditionDiagnostics,
  buildComponentRefs,
  catalogGeneration,
  componentInterfaces,
  connectedInputs,
  declaredUrlPaths as collectUrlPaths,
  dedupeDiagnostics,
  diagnosticKey,
  isBlockingForAuthoredOutput,
  loadDefaultCatalog,
  normalizeV2Component,
  SemanticValidator,
  sortDiagnostics
} from '../../../validation';
import type {
  ComponentNodesView,
  Diagnostic,
  NormComponent,
  NormProject,
  ProjectBackendFacts,
  ValidationReport
} from '../../../validation';
import type { GraphComponent, ExplainGraph } from '../explain/types';
import type { CandidateValidation, ComponentFiles, StructuralFailure } from './types';

let semanticValidator: SemanticValidator | undefined;
/**
 * CN-003: memoised against the catalog generation, not forever.
 *
 * A `SemanticValidator` captures its `CatalogIndex` at construction, and this
 * one is a module singleton that outlives every project opened in the session.
 * Held across a project catalog overlay change it would validate the new
 * project's kit nodes against the previous project's catalog — silently, and
 * only in the checks it then skips, which looks exactly like a project whose
 * kits are unknown.
 */
let validatorGeneration = -1;
function validator(): SemanticValidator {
  if (!semanticValidator || validatorGeneration !== catalogGeneration()) {
    semanticValidator = new SemanticValidator();
    validatorGeneration = catalogGeneration();
  }
  return semanticValidator;
}

function structuralCheck(files: ComponentFiles): StructuralFailure[] {
  const schemaValidator = new SchemaValidator();
  const failures: StructuralFailure[] = [];
  const checks: Array<[StructuralFailure['file'], string, unknown]> = [
    ['component.json', SCHEMA_IDS.COMPONENT, files.component],
    ['nodes.json', SCHEMA_IDS.NODES, files.nodes],
    ['connections.json', SCHEMA_IDS.CONNECTIONS, files.connections]
  ];
  for (const [file, schemaId, data] of checks) {
    const result = schemaValidator.validate(schemaId as Parameters<SchemaValidator['validate']>[0], data);
    if (!result.valid) {
      failures.push({ file, errors: result.errors.map((e) => ({ path: e.path, message: e.message })) });
    }
  }
  return failures;
}

/** The explain-side graph shape and the validator's normalized shape coincide. */
function toNormComponent(component: GraphComponent): NormComponent {
  return {
    name: component.name,
    nodes: component.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      parent: n.parent,
      children: [...n.children],
      instancePorts: [...n.instancePorts]
    })),
    connections: component.connections.map((c) => ({
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty
    }))
  };
}

export interface ValidateCandidateOptions {
  /**
   * Update mode: the component as it exists today. Errors the base ALREADY has
   * are not charged to the agent's candidate.
   *
   * Without this, an update session is judged against a standard its own
   * subject does not meet, and the agent — correctly told to take diagnostics
   * literally and never argue with one — repairs a defect it did not cause, in
   * the only way it can. Measured on a real project: a component holding three
   * `Markdown` nodes and one `module.inlineHtml` (module-provided types the
   * catalog does not carry) came back with all four RETYPED to `Text` under the
   * same node ids, in both live plan runs. That reads as a modification in the
   * diff, not a removal, so "100% of node ids kept" scored it as a clean
   * revision while the content model had been quietly destroyed.
   *
   * A pre-existing error is still reported — in `preExisting` and in
   * `diagnostics` — it just does not reject the submission.
   */
  baseline?: ComponentFiles;
  /**
   * AIB-007 — what the project can offer a Cloud Data or User node.
   *
   * **Omitted means "do not check"**, not "there is no backend". A caller that
   * does not know cannot produce a true answer, and defaulting to
   * `hasBackend: false` would make every existing caller — the MCP write gate,
   * every spec, `reviewComponent` — start reporting a missing backend on
   * projects that have one. The editor's authoring panel binds it; nothing else
   * has to.
   */
  backend?: ProjectBackendFacts;
  /**
   * AAQ-001 — component names a plan in flight will create, on top of the ones
   * the graph already has.
   *
   * Only the navigation check reads them, and only to avoid charging the agent
   * for the order the fan-out ran in. Omitted is correct for a standalone
   * session: nothing is coming, so nothing extra resolves.
   */
  plannedComponents?: readonly string[];
}

/**
 * Validate a candidate component against the project it would join. Strict:
 * unknown node types are errors (with suggestions), because the agent chose
 * every type from the catalog it was shown — except for the ones it did not
 * choose, which is what `options.baseline` is for.
 */
export function validateCandidateComponent(
  graph: ExplainGraph,
  legacyName: string,
  files: ComponentFiles,
  options: ValidateCandidateOptions = {}
): CandidateValidation {
  const structural = structuralCheck(files);
  if (structural.length > 0) {
    return {
      ok: false,
      structural,
      diagnostics: [],
      errors: [],
      summary: { errors: structural.reduce((n, f) => n + f.errors.length, 0), warnings: 0, infos: 0 }
    };
  }

  const components: NormComponent[] = [
    ...graph.components.filter((c) => c.name !== legacyName).map(toNormComponent),
    normalizeV2Component(legacyName, files.nodes, files.connections)
  ];
  const project: NormProject = {
    components,
    componentRefs: buildComponentRefs(components.map((c) => c.name))
  };

  const report: ValidationReport = validator().validateComponent(project, legacyName, { strict: true });
  // AIB-001: the precondition checks run over the candidate's own v2 nodes and
  // their diagnostics join the report's, so they flow through the repair loop,
  // the baseline exemption and the summary by exactly the same paths.
  //
  // 🔴 The reason recorded here used to be stronger — *"the semantic validator
  // reasons about types and connectivity and has no view of parameter VALUES —
  // its normalized model does not carry them"* — and **D13 ended that on
  // 2026-08-18**: `NormNode` carries `parameters` and `rules/parameterValue`
  // runs `checkParameterValues`, the same function the precondition set runs.
  // The two sources now OVERLAP, so this join doubled every parameter-value
  // finding — a rejection naming one mistake twice, which is what exhausted the
  // repair loop in `AIX-006` and made `AIX-011` count 2 blocking warnings where
  // the agent caused 1. `dedupeDiagnostics` is the same fix CN-009 AC5 made in
  // `noodl-mcp/src/validate.ts` on the day D13 landed; it never reached here.
  //
  // AAQ-005: the four of them, and the policy below, are now one shared
  // definition (`validation/authoredCandidate.ts`) that the MCP write gate and
  // the MCP plan gate call too. Before that they existed here and nowhere else,
  // so an agent driving Claude Code through `noodl-mcp` had no parameter-value
  // check at all.
  const diagnostics = dedupeDiagnostics([
    ...report.diagnostics,
    ...preconditionDiagnostics(graph, legacyName, files, options)
  ]);
  // The blocking-warning policy and its reasoning now live with the checks, in
  // `validation/authoredCandidate.ts` — including why `PageWithoutPageNode` is
  // still deliberately absent from it (AAQ-011 F7).
  const allErrors: Diagnostic[] = diagnostics.filter(isBlockingForAuthoredOutput);

  const inherited = options.baseline
    ? baselineErrorKeys(graph, legacyName, options.baseline, options)
    : undefined;
  const preExisting = inherited ? allErrors.filter((d) => inherited.has(diagnosticKey(d))) : [];
  const errors = inherited ? allErrors.filter((d) => !inherited.has(diagnosticKey(d))) : allErrors;

  return {
    ok: errors.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
    errors,
    ...(preExisting.length > 0 ? { preExisting } : {}),
    summary: {
      errors: diagnostics.filter((d) => d.severity === 'error').length,
      warnings: diagnostics.filter((d) => d.severity === 'warning').length,
      infos: diagnostics.filter((d) => d.severity === 'info').length
    }
  };
}

/**
 * The editor's binding of the shared precondition set (AAQ-005).
 *
 * Everything specific to *this* client is here and nothing else is: the project
 * arrives as an `ExplainGraph`, the catalog is the editor's default one, and the
 * navigation names are the project's plus the candidate's own (a page may link to
 * itself) plus whatever the plan in flight will create — that last one so an
 * agent is never charged for the order the fan-out happened to run in.
 *
 * The url paths come from every `Page` node the project declares plus the
 * candidate's, with the candidate's stale on-disk copy left out because the
 * candidate replaces it.
 */
function preconditionDiagnostics(
  graph: ExplainGraph,
  legacyName: string,
  files: ComponentFiles,
  options: ValidateCandidateOptions
): Diagnostic[] {
  const candidateView: ComponentNodesView = { name: legacyName, nodes: files.nodes.nodes };
  const projectViews: ComponentNodesView[] = graph.components
    .filter((c) => c.name !== legacyName)
    .map((c) => ({ name: c.name, nodes: c.nodes }));
  const views = [...projectViews, candidateView];

  return authoredPreconditionDiagnostics({
    component: legacyName,
    nodes: authoredNodes(files.nodes.nodes),
    components: [...graph.components.map((c) => c.name), legacyName, ...(options.plannedComponents ?? [])],
    urlPaths: collectUrlPaths(views),
    // LAS-001 — from the same views as the url paths, and for the same reason:
    // the candidate replaces its own stale on-disk copy, so an interface it is
    // adding in this very submission counts. `GraphNode.ports` carries the plug
    // this needs; `instancePorts` alone cannot tell an input from a backwards one.
    interfaces: componentInterfaces(views),
    // LAS-012 — a `template` fed by a wire is a working list, and only the
    // candidate's own connections can say so.
    connections: connectedInputs(files.connections.connections),
    // FIX-007 — the same connections undigested. `connectedInputs` has dropped
    // the source port by the time it arrives, and a Function node's outputs are
    // half of what this checks.
    wires: files.connections.connections,
    catalog: loadDefaultCatalog(),
    backend: options.backend
  });
}

/**
 * The blocking-diagnostic keys the component ALREADY has, validated the same way
 * and in the same project context as the candidate.
 *
 * The base is normalised first, and only for the *identity* fields the agent
 * cannot express — the same backfill `buildCandidate` performs. A legacy
 * component with no `id` would otherwise fail this structural check and yield
 * an empty key set, which reads as "nothing is pre-existing" rather than as
 * "we could not tell", and would silently reinstate the retype pressure on
 * exactly the components most likely to carry module nodes.
 *
 * A base that is broken for any *other* reason yields no keys, deliberately:
 * that is a judgement we genuinely cannot make.
 */
function baselineErrorKeys(
  graph: ExplainGraph,
  legacyName: string,
  base: ComponentFiles,
  options: ValidateCandidateOptions
): Set<string> {
  const id = base.component.id ?? base.nodes.componentId ?? 'baseline-identity';
  const normalised: ComponentFiles = {
    component: { ...base.component, id },
    nodes: { ...base.nodes, componentId: base.nodes.componentId ?? id },
    connections: { ...base.connections, componentId: base.connections.componentId ?? id }
  };
  if (structuralCheck(normalised).length > 0) return new Set();
  const components: NormComponent[] = [
    ...graph.components.filter((c) => c.name !== legacyName).map(toNormComponent),
    normalizeV2Component(legacyName, base.nodes, base.connections)
  ];
  const project: NormProject = {
    components,
    componentRefs: buildComponentRefs(components.map((c) => c.name))
  };
  const report = validator().validateComponent(project, legacyName, { strict: true });
  // Parameter-value errors are baselined for the same reason type errors are,
  // and this one bites harder: a component saved years ago carrying
  // `sizeMode: "childSize"` — an enum option that no longer exists — would
  // otherwise be unrevisable, because every submission inherits the parameter
  // and the agent is told never to argue with a diagnostic.
  // AIB-007: baselined for the same reason, and this one is the likeliest of the
  // three to bite. The very scenario this task exists for — a project full of
  // Sign Up and Log In nodes and no backend — makes every one of those
  // components unrevisable otherwise: the agent inherits the nodes, is told
  // never to argue with a diagnostic, and can only satisfy it by deleting them.
  //
  // AAQ-005 corrected two things here, and both were found by binding this gate
  // to `noodl-mcp` and watching a real fixture fail.
  //
  // The exemption now covers **blocking warnings**, not only `severity: 'error'`.
  // It was errors-only because the blocking set arrived later, and the omission
  // reinstates on warnings the exact defect the docblock above describes for
  // types: a component carrying a pre-existing `UnknownParameter` — which the
  // 96-project corpus is full of, on imported nodes the catalog cannot see — is
  // charged for it on every revision, and an agent told never to argue with a
  // diagnostic can only satisfy it by deleting the parameter. Proven on
  // `noodl-mcp`'s own fixture: `/Pages/Home` ships a `RouterNavigate` with no
  // target, and adding one unrelated Text node to that component was rejected
  // for it.
  //
  // And navigation and page shape are baselined too, rather than being treated
  // as unexemptable because they are project-relative. The baseline is validated
  // against *today's* project, so a link broken by a component someone else
  // deleted is already in this set and correctly forgiven, while one the
  // candidate breaks itself is not in it and correctly blocks. The comparison
  // does that work on its own; special-casing the codes only removed the
  // forgiveness.
  const diagnostics = [
    ...report.diagnostics,
    ...preconditionDiagnostics(graph, legacyName, normalised, options)
  ];
  return new Set(diagnostics.filter(isBlockingForAuthoredOutput).map(diagnosticKey));
}
