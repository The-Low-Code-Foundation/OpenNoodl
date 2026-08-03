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

import type { NodeV2 } from '../../../schemas';
import { SCHEMA_IDS, SchemaValidator } from '../../../schemas';
import {
  buildComponentRefs,
  checkBackendRequirements,
  checkParameterValues,
  loadDefaultCatalog,
  normalizeV2Component,
  SemanticValidator,
  sortDiagnostics
} from '../../../validation';
import type { Diagnostic, NormComponent, NormProject, ProjectBackendFacts, ValidationReport } from '../../../validation';
import type { GraphComponent, ExplainGraph } from '../explain/types';
import type { CandidateValidation, ComponentFiles, StructuralFailure } from './types';

let semanticValidator: SemanticValidator | undefined;
function validator(): SemanticValidator {
  if (!semanticValidator) semanticValidator = new SemanticValidator();
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

/**
 * A diagnostic's identity for baseline comparison: the rule, what it is about,
 * and the message. The message is in the key on purpose — "unknown node type
 * Markdown" and "unknown node type Foo" are different problems on the same
 * node, and only the first can be pre-existing.
 *
 * Byte-for-byte the same key the MCP write-gate uses
 * (`noodl-mcp/src/tools/planTools.ts`), which has had this exemption since
 * AIX-011 landed. Keeping the two identical is deliberate: they are twins of
 * one policy, and this is the cheap half of not letting them drift.
 */
function diagnosticKey(d: Diagnostic): string {
  const l = d.location;
  return JSON.stringify([d.code, l.nodeId, l.port, l.plug, l.connection, d.message]);
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
  // AIB-001: the semantic validator reasons about types and connectivity and
  // has no view of parameter VALUES — its normalized model does not carry them.
  // The value check runs over the candidate's own v2 nodes and its diagnostics
  // join the report's, so they flow through the repair loop, the baseline
  // exemption and the summary by exactly the same paths.
  const diagnostics = [
    ...report.diagnostics,
    ...parameterDiagnostics(legacyName, files),
    ...backendDiagnostics(legacyName, files, options.backend)
  ];
  const allErrors: Diagnostic[] = diagnostics.filter((d) => d.severity === 'error');

  const inherited = options.baseline
    ? baselineErrorKeys(graph, legacyName, options.baseline, options.backend)
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
 * AIB-001 — parameter values, checked against the wire format the catalog's
 * port type implies.
 *
 * Runs on the v2 nodes rather than the normalized model because the normalized
 * model deliberately does not carry parameters: SUB-006 reasons about the graph
 * (types, ports, wires), and a value's *shape* is a different question asked of
 * different data. Keeping it here rather than as a validator rule also keeps it
 * off every existing project — the crash class this closes is authored output
 * reaching a live adapter, and `validate:project` gaining a new error class
 * across the corpus is a separate decision from fixing it.
 */
function parameterDiagnostics(legacyName: string, files: ComponentFiles): Diagnostic[] {
  const nodes = files.nodes.nodes.map((n: NodeV2) => ({
    id: n.id,
    type: n.type,
    ...(n.label !== undefined ? { label: n.label } : {}),
    parameters: (n.parameters ?? null) as Record<string, unknown> | null
  }));
  return checkParameterValues(nodes, loadDefaultCatalog(), { component: legacyName });
}

/**
 * AIB-007 — Cloud Data and User nodes against a project that may have nowhere
 * to put them.
 *
 * Runs on the v2 nodes for the same reason `parameterDiagnostics` does, and it
 * is a *precondition* check rather than a catalog rule for a sharper reason: the
 * answer depends on the project's configuration, not on the graph. Two identical
 * candidates are correct in one project and broken in another, which is not
 * something the semantic validator's model can express — it has no view of
 * `cloudservices` and should not gain one.
 */
function backendDiagnostics(
  legacyName: string,
  files: ComponentFiles,
  backend: ProjectBackendFacts | undefined
): Diagnostic[] {
  if (!backend) return [];
  return checkBackendRequirements(
    files.nodes.nodes.map((n: NodeV2) => ({
      id: n.id,
      type: n.type,
      ...(typeof n.label === 'string' && n.label ? { label: n.label } : {})
    })),
    { ...backend, component: legacyName }
  );
}

/**
 * The error keys the component ALREADY has, validated the same way and in the
 * same project context as the candidate.
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
  backend?: ProjectBackendFacts
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
  const diagnostics = [
    ...report.diagnostics,
    ...parameterDiagnostics(legacyName, normalised),
    ...backendDiagnostics(legacyName, normalised, backend)
  ];
  return new Set(diagnostics.filter((d) => d.severity === 'error').map(diagnosticKey));
}
