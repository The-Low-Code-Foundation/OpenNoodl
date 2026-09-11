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

import * as fs from 'fs';
import * as path from 'path';

import type { Diagnostic, FunctionSecurityPolicy, ValidationReport } from './editor-deps';
import {
  authoredNodes,
  authoredPreconditionDiagnostics,
  componentInterfaces,
  connectedInputs,
  declaredUrlPaths,
  dedupeDiagnostics,
  derivedPortIndices,
  DiagnosticCode,
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
/**
 * DEF-009 — the `functions` block of the project's `nodegx.security.json`.
 *
 * `null` when the project has no policy file (the check then reads every
 * function as having no entry, which is the truth) and also when the file will
 * not parse — a broken policy is a louder problem than a missing rate limit,
 * and refusing every component write over it would make the security file able
 * to brick authoring. Never `undefined` from this client: this server always
 * knows the project root, so "cannot see the policy" is not a state it is in.
 */
export function projectSecurity(store: ProjectStore): FunctionSecurityPolicy | null {
  try {
    const raw = fs.readFileSync(path.join(store.projectDir, 'nodegx.security.json'), 'utf8');
    const parsed = JSON.parse(raw) as { functions?: FunctionSecurityPolicy };
    return parsed && typeof parsed === 'object' && parsed.functions && typeof parsed.functions === 'object'
      ? parsed.functions
      : null;
  } catch {
    return null;
  }
}

/**
 * REL-002a — the project's `settings.bodyScroll`, in the three states
 * `checkPageScroll` distinguishes.
 *
 * Never `undefined` from this client, for the same reason `projectSecurity` is never undefined:
 * this server always knows the project root, so "cannot read the project file" is not a state it
 * is in. A missing or unreadable `nodegx.project.json` therefore reads as `null` — the project has
 * not set it — which is the honest answer for a directory with no project file to decide in.
 */
export function projectBodyScroll(store: ProjectStore): boolean | null {
  try {
    const raw = fs.readFileSync(path.join(store.projectDir, 'nodegx.project.json'), 'utf8');
    const parsed = JSON.parse(raw) as { settings?: Record<string, unknown> };
    const value = parsed?.settings?.bodyScroll;
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

/**
 * DEF-013 — component names that resolve although no component exists for them
 * yet, over and above the ones `views` carries.
 *
 * The plan door supplies its own declared operations here. They are names ONLY,
 * deliberately: a planned component has no nodes, and adding it to `views` would
 * give it an empty interface rather than no interface — turning "unknown, do not
 * check" into "this component has no ports" for every instance of it.
 */
export function preconditionDiagnostics(
  store: ProjectStore,
  legacyName: string,
  candidate: ComponentFiles,
  views: readonly ComponentNodesView[],
  alsoResolvable: readonly string[] = []
): Diagnostic[] {
  return authoredPreconditionDiagnostics({
    component: legacyName,
    // DEF-009 — null means "no policy file", never undefined: see projectSecurity.
    security: projectSecurity(store),
    // REL-002a — null means "the project has not set it", never undefined: see projectBodyScroll.
    bodyScroll: projectBodyScroll(store),
    nodes: authoredNodes(candidate.nodes.nodes),
    components: [...views.map((v) => v.name), legacyName, ...alsoResolvable],
    urlPaths: declaredUrlPaths(views),
    // LAS-001 — from the same views, so a component this plan is about to create
    // resolves as an interface exactly when it resolves as a navigation target.
    // `authoredProjectViews` already overlays the staged candidates, which is
    // what makes a correct multi-component plan validate instead of being
    // charged for the order its operations happened to run in.
    interfaces: componentInterfaces(views),
    // DEF-002 §1(b)/§1(c) — the same views again, read for what an editor
    // adapter would mint rather than for what a Component Inputs node declares.
    derived: derivedPortIndices(views),
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
  const diagnostics = dedupeDiagnostics([...report.diagnostics, ...preconditionDiagnostics(store, name, candidate, views)]);

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
      ...preconditionDiagnostics(store, baselineName, baseline, baselineViews)
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

/**
 * Info diagnostics that report **that a check did not run**, rather than that
 * something is wrong.
 *
 * Both are emitted unconditionally by their checkers, deliberately (CN-010), and
 * the sibling pipeline has always filtered them: `rules/parameterValue` drops
 * `severity === 'info'` unless `emitDynamicPortInfo`, and `--info` on
 * `scripts/validate-project.ts` is the flag that turns them back on. Composing
 * the preconditions here without the same filter would add **1,355** notes to a
 * single `validate_project` over the 94-project corpus — 93% of everything the
 * preconditions produce — and bury the 24 errors underneath them.
 *
 * ⚠️ Filtered by **code, not by severity**. `MonotoneTypography` is also an
 * `info` and it is a finding, not a skip note: it says a page renders every word
 * at one weight, which is true and worth reading. A severity filter — the shape
 * `rules/parameterValue` uses, correct there because `checkParameterValues`
 * emits no other info — would silently drop it here.
 */
const SKIP_NOTE_CODES: ReadonlySet<string> = new Set<string>([
  DiagnosticCode.DynamicPortSkipped,
  DiagnosticCode.UnknownTypeCheckSkipped
]);

/**
 * The precondition half, for components already on disk.
 *
 * A component whose files will not read is skipped rather than fatal — the same
 * convention `authoredProjectViews` follows directly above, for the same reason:
 * a corrupt neighbour means one fewer name resolves, not that the project cannot
 * be reported on.
 */
function onDiskPreconditions(
  store: ProjectStore,
  views: readonly ComponentNodesView[],
  targets: readonly { key: string; name: string }[],
  emitSkipNotes: boolean
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const target of targets) {
    let files: ComponentFiles;
    try {
      files = store.readComponent(target.key).files;
    } catch {
      continue;
    }
    for (const diagnostic of preconditionDiagnostics(store, target.name, files, views)) {
      if (!emitSkipNotes && SKIP_NOTE_CODES.has(diagnostic.code)) continue;
      out.push(diagnostic);
    }
  }
  return out;
}

/**
 * On-demand validation of the current on-disk project or one component.
 *
 * 🔴 **DEF-002 AC6 — this ran the `SemanticValidator` and stopped**, so all
 * thirteen precondition checks were invisible to `validate_component` and
 * `validate_project` while `validateCandidate`, the door that lets a write in,
 * composed every one of them. **An agent calling `validate_project` to check its
 * own work got a strictly weaker answer than the gate that accepted it**, and no
 * amount of new `rules/` could have changed that: a precondition is precisely the
 * question `NormNode` cannot carry the data to ask.
 *
 * The measured consequence, on the project this server was bound to while the
 * fix was written: `Puppy test 3`'s `/Pages/Admin` wires `query.items` into the
 * Function node port `items`, and a Function node's ports are prefixed
 * (`in-items`, `out-text` — `simplejavascript.ts` registers them that way). The
 * wire reaches nothing and the canvas says "Target port doesn't exist".
 * `nonexistentPort` is right to skip it, because those ports are mined from the
 * script rather than declared; `checkFunctionNodePorts` is the check that can see
 * it, and it did not run here. `validate_project` called that project clean.
 *
 * ## Calibrated before switching on, because the population is not the write
 * gate's
 *
 * Several of these checks were calibrated against graphs an agent had just
 * written, and this door also runs over hand-authored and imported projects, so
 * the cost was measured rather than assumed —
 * `scripts/def-002-corpus-preconditions.ts`, one pass, all thirteen at once,
 * counting only diagnostics the semantic validator does not **already** report
 * (`rules/parameterValue` has run `checkParameterValues` here since D13, so the
 * naive count double-counts it badly):
 *
 * | population | errors | warnings | skip notes |
 * |---|---|---|---|
 * | 94-project corpus | **24** | 69 | 1,355 → filtered |
 * | the 3 shipped examples | **0** | **0** | 12 → filtered |
 *
 * All 24 errors were read: 16 `unprefixed-function-port` (verified against the
 * runtime's `in-`/`out-` registration and against the wires on disk), 5
 * `repeater-without-template`, 3 `repeater-with-visual-children`. Every one is a
 * true positive on a graph that does not do what its author wrote. D13's
 * precedent applies exactly — *"expect this to go red on real projects; that is
 * the point, and it must not be softened"* — and it costs nothing to be red
 * here: this door **reports**, it does not reject, so a backlog surfaces without
 * blocking anybody's edit. The write gate's policy set
 * (`AUTHORED_BLOCKING_WARNINGS`) is untouched and still applies only where a
 * write is being accepted.
 *
 * `backend` stays unsupplied, as in {@link preconditionDiagnostics}: this server
 * cannot see `cloudservices`, and an omitted backend reads as "do not check"
 * rather than "there is no backend".
 */
export function validateOnDisk(
  store: ProjectStore,
  options: { component?: string; strict?: boolean; emitSkipNotes?: boolean }
): { report: ValidationReport; target?: string } {
  const project = store.buildNormProject();
  const validatorOptions = { strict: options.strict ?? false };
  const views = authoredProjectViews(store, new Map());
  const emitSkipNotes = options.emitSkipNotes === true;

  if (options.component !== undefined) {
    const stored = store.readComponent(options.component);
    const name = stored.files.component.path ?? stored.key;
    const report = validator().validateComponent(project, name, validatorOptions);
    return {
      report: withPreconditions(report, onDiskPreconditions(store, views, [{ key: stored.key, name }], emitSkipNotes)),
      target: stored.key
    };
  }

  const report = validator().validate(project, validatorOptions);
  const targets = store.listComponents().map((row) => ({ key: row.path, name: row.legacyName }));
  return { report: withPreconditions(report, onDiskPreconditions(store, views, targets, emitSkipNotes)) };
}

/**
 * Merge the precondition findings into a semantic report and re-count.
 *
 * 🔴 Deduped, and that is load-bearing rather than tidy. The two sources overlap
 * on purpose since D13 — `rules/parameterValue` runs the same
 * `checkParameterValues` the precondition set does — so a naive concatenation
 * reports **every parameter-value finding twice**, in the readable list and in
 * `summary.errors` alike. A rejection naming one mistake twice reads as two
 * mistakes. `diagnosticKey` is what makes the two copies collapse.
 *
 * `nodesChecked` and `endpointsChecked` are carried through untouched: the
 * preconditions examined the same nodes, so adding to those counters would
 * report the project as twice its size.
 */
function withPreconditions(report: ValidationReport, preconditions: readonly Diagnostic[]): ValidationReport {
  if (preconditions.length === 0) return report;
  const diagnostics = dedupeDiagnostics([...report.diagnostics, ...preconditions]);
  return {
    diagnostics,
    summary: {
      ...report.summary,
      errors: diagnostics.filter((d) => d.severity === 'error').length,
      warnings: diagnostics.filter((d) => d.severity === 'warning').length,
      infos: diagnostics.filter((d) => d.severity === 'info').length
    }
  };
}
