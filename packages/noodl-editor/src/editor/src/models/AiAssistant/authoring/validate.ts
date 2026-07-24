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
  buildComponentRefs,
  normalizeV2Component,
  SemanticValidator,
  sortDiagnostics
} from '../../../validation';
import type { Diagnostic, NormComponent, NormProject, ValidationReport } from '../../../validation';
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
 * Validate a candidate component against the project it would join. Strict:
 * unknown node types are errors (with suggestions), because the agent chose
 * every type from the catalog it was shown.
 */
export function validateCandidateComponent(
  graph: ExplainGraph,
  legacyName: string,
  files: ComponentFiles
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
  const errors: Diagnostic[] = report.diagnostics.filter((d) => d.severity === 'error');

  return {
    ok: errors.length === 0,
    diagnostics: sortDiagnostics(report.diagnostics),
    errors,
    summary: {
      errors: report.summary.errors,
      warnings: report.summary.warnings,
      infos: report.summary.infos
    }
  };
}
