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
  declaredUrlPaths,
  diagnosticKey,
  isBlockingForAuthoredOutput,
  SCHEMA_IDS,
  SchemaValidator,
  SemanticValidator,
  sortDiagnostics
} from './editor-deps';
import type { ComponentNodesView } from './editor-deps';
import { catalogIndex } from './catalog';
import type { ComponentFiles } from './graph';
import type { ProjectStore } from './project/ProjectStore';

let semanticValidator: SemanticValidator | undefined;
function validator(): SemanticValidator {
  // Built over the *enriched* catalog index so validation and the catalog
  // tools can never disagree about a type.
  if (!semanticValidator) semanticValidator = new SemanticValidator(catalogIndex());
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
 * The precondition checks need two project-wide facts the `NormProject` cannot
 * carry: which component names a navigation may resolve to, and which `urlPath`
 * values exist — and the second one needs node *parameters*, which normalization
 * deliberately drops.
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
  const diagnostics = [...report.diagnostics, ...preconditionDiagnostics(name, candidate, views)];

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
    const baselineDiagnostics = [
      ...baselineReport.diagnostics,
      ...preconditionDiagnostics(baselineName, baseline, baselineViews)
    ];
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
