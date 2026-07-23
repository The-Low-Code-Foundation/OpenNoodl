/**
 * Write-gate validation (SUB-008 policy, see docs/DESIGN.md):
 *
 *  1. Structural: Ajv schema check of the three candidate files.
 *  2. Semantic:   SUB-006 validator with `strict: true` — agents authoring
 *     fresh graphs are exactly the population for whom a typo'd node type must
 *     hard-fail (the diagnostic carries a suggestion). `allow_unknown_types`
 *     relaxes this per call for module-provided types the catalog can't know.
 *  3. Baseline comparison: for updates, only *new* errors reject the write. A
 *     component that already carried strict-mode errors (e.g. legitimate
 *     module nodes) must stay editable — the gate is "don't make it worse".
 */

import type { Diagnostic, ValidationReport } from './editor-deps';
import { SCHEMA_IDS, SchemaValidator, SemanticValidator, sortDiagnostics } from './editor-deps';
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
  /** Errors that did not exist before this change — these are what reject a write. */
  newErrors: Diagnostic[];
  /** Errors that already existed on disk (updates only) — reported, not blocking. */
  preexistingErrors: Diagnostic[];
  summary: { errors: number; warnings: number; infos: number };
}

function diagnosticKey(d: Diagnostic): string {
  const l = d.location;
  return JSON.stringify([d.code, l.nodeId, l.port, l.plug, l.connection, d.message]);
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

function componentErrors(report: ValidationReport): Diagnostic[] {
  return report.diagnostics.filter((d) => d.severity === 'error');
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

  let preexistingKeys = new Set<string>();
  if (baseline) {
    const baselineName = baseline.component.path ?? key;
    const baselineProject = store.buildNormProject({ replace: { key, files: baseline } });
    const baselineReport = validator().validateComponent(baselineProject, baselineName, validatorOptions);
    preexistingKeys = new Set(componentErrors(baselineReport).map(diagnosticKey));
  }

  const errors = componentErrors(report);
  const newErrors = errors.filter((d) => !preexistingKeys.has(diagnosticKey(d)));
  const preexistingErrors = errors.filter((d) => preexistingKeys.has(diagnosticKey(d)));

  return {
    ok: newErrors.length === 0,
    diagnostics: sortDiagnostics(report.diagnostics),
    newErrors,
    preexistingErrors,
    summary: report.summary
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
