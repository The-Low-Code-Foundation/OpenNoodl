/**
 * Write-gate validation (SUB-008 policy, see docs/DESIGN.md):
 *
 *  1. Structural: Ajv schema check of the three candidate files.
 *  2. Semantic:   SUB-006 validator with `strict: true` — agents authoring
 *     fresh graphs are exactly the population for whom a typo'd node type must
 *     hard-fail (the diagnostic carries a suggestion). `allow_unknown_types`
 *     relaxes this per call for module-provided types the catalog can't know.
 *  3. Preconditions: the four checks the semantic validator cannot make —
 *     parameter values, backend requirements, navigation targets, page shape.
 *  4. Policy: `severity === 'error'`, plus the three warnings that block
 *     *authored* output (AAQ-005).
 *  5. Baseline comparison: for updates, only diagnostics this change *introduced*
 *     reject the write. A component that already carried strict-mode errors
 *     (legitimate module nodes) or a pre-existing dead navigation must stay
 *     editable — the gate is "don't make it worse".
 *
 * ⚠️ Steps 3 and 4 arrived with AAQ-005 and are the whole of that task's first
 * slice. Before it, this gate ran step 2 and stopped: `checkParameterValues`,
 * `checkBackendRequirements`, `checkNavigation` and `checkPageShape` appeared
 * nowhere in this package. The task file recorded the editor/MCP difference as
 * a *policy* one — "gates on `severity === 'error'` only" — but the filter was
 * never the problem; there was nothing for it to filter. An agent driving
 * Claude Code could write `variant: "primary"` (an error in the editor, and the
 * exact defect that silently discarded a build's styling) and this gate called
 * it clean.
 */

import type { Diagnostic, ValidationReport } from './editor-deps';
import {
  authoredNodes,
  authoredPreconditionDiagnostics,
  componentInterfaces,
  connectedInputs,
  declaredUrlPaths,
  diagnosticKey,
  isBlockingForAuthoredOutput,
  SCHEMA_IDS,
  SchemaValidator,
  SemanticValidator,
  sortDiagnostics
} from './editor-deps';
import type { ComponentNodesView } from './editor-deps';
import { catalogGeneration, catalogIndex } from './catalog';
import type { ComponentFiles } from './graph';
import type { ProjectStore } from './project/ProjectStore';

let semanticValidator: SemanticValidator | undefined;
let validatorGeneration = -1;
function validator(): SemanticValidator {
  // Built over the *enriched* catalog index so validation and the catalog
  // tools can never disagree about a type.
  //
  // 🔴 CN-003 — re-built when the catalog changes. The project overlay is
  // installed at bind, which is *after* this module is loaded; a validator
  // memoised for the life of the process would be one built over built-ins
  // only, and its failure mode is invisible — it looks exactly like a project
  // whose kit types are unknown, which is the state the overlay exists to end.
  if (!semanticValidator || validatorGeneration !== catalogGeneration()) {
    semanticValidator = new SemanticValidator(catalogIndex());
    validatorGeneration = catalogGeneration();
  }
  return semanticValidator;
}

export interface StructuralFailure {
  file: 'component.json' | 'nodes.json' | 'connections.json';
  errors: Array<{ path: string; message: string }>;
}

export interface WriteValidation {
  ok: boolean;
  /** Present when the structural (schema) check failed — semantic never ran. */
  structural?: StructuralFailure[];
  /** Diagnostics for the candidate component (sorted). */
  diagnostics: Diagnostic[];
  /**
   * Blocking diagnostics that did not exist before this change — these are what
   * reject a write. Named `newErrors` since SUB-008; since AAQ-005 the set is
   * "errors plus the three warnings that block authored output", which is what
   * the editor's loop has always rejected on.
   */
  newErrors: Diagnostic[];
  /** Blocking diagnostics that already existed on disk (updates only) — reported, not blocking. */
  preexistingErrors: Diagnostic[];
  summary: { errors: number; warnings: number; infos: number };
}

/**
 * Every component in the project as "name + nodes", with `overlay` (keyed by
 * legacy name) standing in for what is about to be written.
 *
 * The precondition checks need three project-wide facts the `NormProject` cannot
 * carry: which component names a navigation may resolve to, which `urlPath`
 * values exist, and (LAS-001) what each component's `Component Inputs` node
 * declares. The second needs node *parameters* and the third needs node *ports*,
 * neither of which normalization keeps.
 *
 * A component the registry lists but whose files will not read is skipped rather
 * than fatal, matching `review.ts`: a corrupt neighbour is not a reason to refuse
 * a write, it just means one fewer name resolves.
 */
export function authoredProjectViews(
  store: ProjectStore,
  overlay: ReadonlyMap<string, ComponentFiles>
): ComponentNodesView[] {
  const views: ComponentNodesView[] = [];
  const seen = new Set<string>();
  for (const row of store.listComponents()) {
    seen.add(row.legacyName);
    const staged = overlay.get(row.legacyName);
    if (staged) {
      views.push({ name: row.legacyName, nodes: staged.nodes.nodes });
      continue;
    }
    try {
      views.push({ name: row.legacyName, nodes: store.readComponent(row.path).files.nodes.nodes });
    } catch {
      views.push({ name: row.legacyName, nodes: [] });
    }
  }
  // Components the plan or this call is creating do not exist on disk yet.
  for (const [name, files] of overlay) {
    if (!seen.has(name)) views.push({ name, nodes: files.nodes.nodes });
  }
  return views;
}

/**
 * The precondition half of the gate, bound to this client (AAQ-005).
 *
 * `backend` is deliberately not supplied: this server has no view of the
 * project's `cloudservices` configuration, and the shared check reads an omitted
 * backend as "do not check" rather than "there is no backend" — the only honest
 * answer a caller that cannot tell can give.
 */
export function preconditionDiagnostics(
  legacyName: string,
  candidate: ComponentFiles,
  views: readonly ComponentNodesView[]
): Diagnostic[] {
  return authoredPreconditionDiagnostics({
    component: legacyName,
    nodes: authoredNodes(candidate.nodes.nodes),
    components: [...views.map((v) => v.name), legacyName],
    urlPaths: declaredUrlPaths(views),
    // LAS-001 — from the same views, so a component this plan is about to create
    // resolves as an interface exactly when it resolves as a navigation target.
    // `authoredProjectViews` already overlays the staged candidates, which is
    // what makes a correct multi-component plan validate instead of being
    // charged for the order its operations happened to run in.
    interfaces: componentInterfaces(views),
    // LAS-012 — a `template` fed by a wire is a working list, and only the
    // candidate's own connections can say so.
    connections: connectedInputs(candidate.connections.connections),
    // FIX-007 — the same connections undigested. `connectedInputs` has dropped
    // the source port by the time it arrives, and a Function node's outputs are
    // half of what this checks.
    wires: candidate.connections.connections,
    catalog: catalogIndex()
  });
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
      failures.push({
        file,
        errors: result.errors.map((e) => ({ path: e.path, message: e.message }))
      });
    }
  }
  return failures;
}

/**
 * The two diagnostic sources overlap, and since D13 they overlap on purpose.
 *
 * 🔴 **Measured 2026-08-18, driving CN-009 AC5.** `validateCandidate` merges the
 * semantic validator's report with `preconditionDiagnostics`. D13 registered
 * `rules/parameterValue`, which runs `checkParameterValues` — the same function
 * the precondition set has always run. The result was every parameter-value
 * finding appearing **twice** in `diagnostics`, in the `readable` list an agent
 * is shown, and in `summary.errors`/`warnings`. A rejection naming one mistake
 * twice reads as two mistakes.
 *
 * ⚠️ **Deduped rather than un-overlapped, deliberately.** Removing
 * `checkParameterValues` from the precondition set would silently drop it for
 * any caller that runs the preconditions alone — the editor's authoring loop
 * does exactly that — and that is a bigger change made for a cosmetic reason.
 * The overlap is now harmless and each source stays independently complete.
 *
 * `diagnosticKey` is the identity this file already trusts for baseline
 * exemption (code + node + port + plug + connection + message), so two entries
 * sharing it are the same finding by the definition already in use here.
 */
function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diagnostic);
  }
  return out;
}

/**
 * Validate a candidate create/update for `key`. `baseline` is the on-disk
 * files before the change (undefined for creates).
 */
export function validateCandidate(
  store: ProjectStore,
  key: string,
  candidate: ComponentFiles,
  baseline: ComponentFiles | undefined,
  options: { allowUnknownTypes?: boolean } = {}
): WriteValidation {
  const structural = structuralCheck(candidate);
  if (structural.length > 0) {
    return {
      ok: false,
      structural,
      diagnostics: [],
      newErrors: [],
      preexistingErrors: [],
      summary: { errors: structural.reduce((n, f) => n + f.errors.length, 0), warnings: 0, infos: 0 }
    };
  }

  const validatorOptions = { strict: !options.allowUnknownTypes };
  const name = candidate.component.path ?? key;
  const candidateProject = store.buildNormProject({ replace: { key, files: candidate } });
  const report = validator().validateComponent(candidateProject, name, validatorOptions);

  const views = authoredProjectViews(store, new Map([[name, candidate]]));
  const diagnostics = dedupeDiagnostics([...report.diagnostics, ...preconditionDiagnostics(name, candidate, views)]);

  let preexistingKeys = new Set<string>();
  if (baseline) {
    const baselineName = baseline.component.path ?? key;
    const baselineProject = store.buildNormProject({ replace: { key, files: baseline } });
    const baselineReport = validator().validateComponent(baselineProject, baselineName, validatorOptions);
    // Exempted on **blocking** identity, not on `severity === 'error'`, and
    // over the same four preconditions the candidate is judged by — the editor's
    // rule, and the correction AAQ-005 made to it after this package's own
    // fixture proved the cost. `/Pages/Home` there carries a `RouterNavigate`
    // with no target; adding one unrelated Text node to that component was
    // rejected for a dead button the agent had never touched, and its only
    // available repair would have been to delete the node.
    //
    // Baselining the project-relative checks is safe because the baseline is
    // validated against *today's* project: a link broken by someone else's
    // deletion is already in this set and forgiven, while one the candidate
    // breaks itself is not and still blocks.
    const baselineViews = authoredProjectViews(store, new Map([[baselineName, baseline]]));
    const baselineDiagnostics = dedupeDiagnostics([
      ...baselineReport.diagnostics,
      ...preconditionDiagnostics(baselineName, baseline, baselineViews)
    ]);
    preexistingKeys = new Set(baselineDiagnostics.filter(isBlockingForAuthoredOutput).map(diagnosticKey));
  }

  const blocking = diagnostics.filter(isBlockingForAuthoredOutput);
  const newErrors = blocking.filter((d) => !preexistingKeys.has(diagnosticKey(d)));
  const preexistingErrors = blocking.filter((d) => preexistingKeys.has(diagnosticKey(d)));

  return {
    ok: newErrors.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
    newErrors,
    preexistingErrors,
    summary: {
      errors: diagnostics.filter((d) => d.severity === 'error').length,
      warnings: diagnostics.filter((d) => d.severity === 'warning').length,
      infos: diagnostics.filter((d) => d.severity === 'info').length
    }
  };
}

/**
 * Validate the effect of deleting `key`: diagnostics that would appear in
 * *other* components (unresolved component refs).
 */
export function validateDeletion(store: ProjectStore, key: string): Diagnostic[] {
  const before = validator().validate(store.buildNormProject(), {});
  const beforeKeys = new Set(before.diagnostics.map(diagnosticKey));
  const after = validator().validate(store.buildNormProject({ remove: key }), {});
  return after.diagnostics.filter((d) => !beforeKeys.has(diagnosticKey(d)));
}

/** On-demand validation of the current on-disk project or one component. */
export function validateOnDisk(
  store: ProjectStore,
  options: { component?: string; strict?: boolean }
): { report: ValidationReport; target?: string } {
  const project = store.buildNormProject();
  const validatorOptions = { strict: options.strict ?? false };
  if (options.component !== undefined) {
    const stored = store.readComponent(options.component);
    const name = stored.files.component.path ?? stored.key;
    return { report: validator().validateComponent(project, name, validatorOptions), target: stored.key };
  }
  return { report: validator().validate(project, validatorOptions) };
}
